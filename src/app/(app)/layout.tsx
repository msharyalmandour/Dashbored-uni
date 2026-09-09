import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/shared/app-shell";

/**
 * The execution ceiling for everything inside the app, and in practice a
 * ceiling for Server Actions rather than for rendering.
 *
 * It sits on the layout rather than on /inbox because the drop panel is part
 * of `AppShell` — a student can hand the system a timetable from the
 * dashboard, from a subject, from anywhere — so a limit that only covered the
 * inbox would leave the same call to be killed everywhere else. Next folds
 * each layout segment into the page's own config at build time
 * (`reduceAppConfig`), with a page free to override, so one declaration here
 * covers every route in the group.
 *
 * The number comes from measurement, not caution. Reading a photographed
 * timetable is a vision call that reasons over twenty-odd rows before it
 * answers; one observed run took 34 seconds and was still cut short by an
 * output budget that has since been raised. Letting the answer finish makes
 * that call longer, so keeping the old default would have traded one silent
 * failure for another. Time is billed as used, never as reserved.
 */
export const maxDuration = 120;

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // Shares the request-scoped verification with the page's getCurrentUser(),
  // so a page load verifies the session once instead of twice.
  const user = await getSessionUser();

  // Defense in depth alongside middleware — never render app data without a
  // verified session.
  if (!user) redirect("/login");

  // Name and email come from the session we already verified, so the sidebar
  // identity costs no extra query.
  const displayName =
    (user.user_metadata?.name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "";

  return (
    <AppShell userName={displayName} userEmail={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
