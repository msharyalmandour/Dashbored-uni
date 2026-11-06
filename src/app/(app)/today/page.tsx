import { getCurrentUserId } from "@/lib/current-user";
import { getDashboardData } from "@/lib/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { pageTitle } from "@/lib/i18n/page-title";

export const generateMetadata = pageTitle((dict) => dict.nav.items.dashboard.label);
export const dynamic = "force-dynamic";

/**
 * The day, in full.
 *
 * THIS ROUTE WAS A BARE REDIRECT TO `/`, and the comment that stood here
 * explained why: two homes is one too many, and the one called Home was the
 * one that had almost nothing. That reasoning was right and it has been
 * overtaken. Home is now the approved drawing — a greeting, four figures,
 * today beside what is coming, and what to pick back up — and the drawing
 * does not contain the long day panel.
 *
 * So the panel comes back here rather than being left referenced by nothing.
 * It holds the schedule timeline, focus-now, the evening check-in and the
 * academic worlds, none of which the drawing replaces, and deleting them
 * under cover of a reskin is not a thing a reskin may do.
 *
 * The redirect's own argument survives in the shape: Home answers "what
 * now", in ten seconds, and this answers "how does it all look", which is a
 * different question asked at a different rate.
 */
export default async function TodayPage() {
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const now = new Date();
  const data = await getDashboardData(userId, dict);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <DashboardView dict={dict} locale={locale} now={now} data={data} />
    </div>
  );
}
