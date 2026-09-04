import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shared/app-shell";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense in depth alongside middleware — never render app data without a
  // verified session.
  if (!user) redirect("/login");

  return <AppShell>{children}</AppShell>;
}
