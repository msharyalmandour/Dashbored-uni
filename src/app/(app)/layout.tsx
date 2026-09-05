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

  return <AppShell>{children}</AppShell>;
}
