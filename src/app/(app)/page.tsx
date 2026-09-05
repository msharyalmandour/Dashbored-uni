import { getCurrentUserId } from "@/lib/current-user";
import { getDashboardData } from "@/lib/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DashboardView } from "@/components/dashboard/dashboard-view";

// Urgency and "what's due" are relative to the current moment, so this page
// must always render fresh rather than serve a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const data = await getDashboardData(userId);
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const now = new Date();

  return <DashboardView dict={dict} locale={locale} now={now} data={data} />;
}
