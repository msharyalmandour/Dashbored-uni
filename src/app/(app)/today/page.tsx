import { getCurrentUserId } from "@/lib/current-user";
import { getDashboardData } from "@/lib/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { pageTitle } from "@/lib/i18n/page-title";
import { DashboardView } from "@/components/dashboard/dashboard-view";

/**
 * The detailed view of the day.
 *
 * This is the page Home used to be, moved here unchanged. Home is now the
 * question and the orb; this is where a student comes when they want the
 * whole picture — what is due, what the week looks like, what each course is
 * doing. Both are useful, and neither is a good version of the other: one is
 * asked every day in ten seconds, the other every few days for a few minutes.
 *
 * Nothing inside was redesigned. That is Phase 2's job, and moving a working
 * page is not the same as rewriting one.
 */
export const generateMetadata = pageTitle((dict) => dict.home.today);
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const data = await getDashboardData(userId, dict);
  const now = new Date();

  return <DashboardView dict={dict} locale={locale} now={now} data={data} />;
}
