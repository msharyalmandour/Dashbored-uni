import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing).");
  return { url, key };
}

/**
 * Server-side Supabase client bound to the request's session cookies.
 * Use in Server Components, Server Actions, and Route Handlers.
 *
 * Wrapped in React `cache()` so one request reuses a single client rather
 * than constructing one per call site.
 */
export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = env();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component with no response to write to —
          // the middleware's session refresh already covers this case.
        }
      },
    },
  });
});

/**
 * The verified Supabase auth user for this request, or null when there is
 * no session.
 *
 * `auth.getUser()` revalidates the JWT against Supabase rather than
 * trusting the cookie, which is why it costs a network round trip — so it
 * must not run more than once per request. React `cache()` makes every
 * call site inside one request share a single verification. The security
 * property is unchanged: every incoming request is still verified, and the
 * middleware verifies independently before the request reaches here.
 */
export const getSessionUser = cache(async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The current session's Supabase auth user id (a UUID) — distinct from the
 * Prisma `User.id` (a cuid). Used to scope Storage object paths, since
 * Storage RLS policies check `auth.uid()` directly.
 */
export async function getAuthUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated.");
  return user.id;
}

/**
 * The current session's access token, for constructing a per-request
 * Supabase client that acts *as* the signed-in user (so Storage RLS
 * policies keyed on auth.uid() actually apply) rather than as the bare
 * anon role.
 */
export async function getAccessToken(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated.");
  return session.access_token;
}
