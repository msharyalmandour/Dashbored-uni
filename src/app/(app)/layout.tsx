import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/shared/app-shell";

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
