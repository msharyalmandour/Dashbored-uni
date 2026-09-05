import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/auth/callback"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * True when the request carries no Supabase auth cookie at all.
 *
 * `@supabase/ssr` stores the session under `sb-<project-ref>-auth-token`,
 * splitting it into `.0`, `.1`, … chunks when it exceeds the per-cookie size
 * limit. If not one of those is present there is no session to validate, and
 * `auth.getUser()` would return `null` after a pointless network round trip
 * to Supabase. Deciding that locally is not a weaker check — a session that
 * was never sent cannot be valid — it only skips a remote call whose answer
 * is already known.
 */
function hasNoAuthCookie(request: NextRequest) {
  return !request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
}

/**
 * Refreshes the Supabase session cookie on every request and gates
 * unauthenticated access to the app. This is the app's primary route
 * protection; individual pages/actions still re-check ownership since
 * middleware alone cannot be trusted as the only boundary.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const onPublicPath = isPublicPath(pathname);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return supabaseResponse;

  function redirectTo(target: string, withNext = false) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = target;
    redirectUrl.search = "";
    if (withNext) redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // The auth callback exchanges a code for a session and writes the cookies
  // itself. Validating a session that by definition does not exist yet is
  // pure latency, and the path is public either way — the logic below would
  // fall through to an unconditional pass-through.
  if (pathname === "/auth/callback") return supabaseResponse;

  // No session cookie: the answer is already known without asking Supabase.
  if (hasNoAuthCookie(request)) {
    return onPublicPath ? supabaseResponse : redirectTo("/login", true);
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // Deliberately `getUser()` rather than `getClaims()`: this revalidates the
  // JWT against Supabase, so a session revoked server-side stops working
  // immediately instead of lasting until its access token expires.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthed = !!user;

  if (!isAuthed && !onPublicPath) return redirectTo("/login", true);
  if (isAuthed && (pathname === "/login" || pathname === "/register")) return redirectTo("/");

  return supabaseResponse;
}
