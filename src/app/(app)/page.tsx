import { getCurrentUserId } from "@/lib/current-user";
import { getDashboardData } from "@/lib/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getAiStatus } from "@/lib/ai/provider";
import { HomeSurface } from "@/components/home/home-surface";
import { ContinueReading } from "@/components/home/continue-reading";
import { LooseEnds } from "@/components/home/loose-ends";
import { DashboardView } from "@/components/dashboard/dashboard-view";

/**
 * Home. One of them, now.
 *
 * There were two. `/` held a greeting, a question and an orb, and read the
 * whole day's data only to show a single number out of it; `/today` — labelled
 * "Dashboard" in the sidebar — held the day itself. The reasoning at the time
 * was that the two questions are asked at different rates: "what now?" every
 * day in ten seconds, "how does it all look?" every few days for a few minutes.
 *
 * That reasoning was wrong in the way that only shows up in use. A student
 * opening the app does not know which of their two homes has the thing they
 * came for, and the one named Home was the one that had almost nothing. The
 * cost of guessing wrong every time is far higher than the cost of scrolling
 * past an orb.
 *
 * So: one page. The orb stays at the top, because a way in that is always in
 * the same place is worth a band of screen. Under it is the day — which is
 * what the student actually came for, and which each card carries a door into.
 *
 * Both halves come from one `getDashboardData` call, which is what they were
 * both doing separately before.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [data, ai] = await Promise.all([getDashboardData(userId, dict), Promise.resolve(getAiStatus())]);
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <HomeSurface aiConfigured={ai.configured} canTranscribe={ai.canTranscribe} />
      {/* The sidebar lost nine entries, which is only a simplification if what
          it held is now on Home. This is the first of those: Studio keeps its
          page, but the one sentence worth having from it — where you stopped
          reading — sits above the day. It renders nothing when there is nothing
          mid-read, rather than spending a band on an absence. */}
      <ContinueReading userId={userId} dict={dict} />
      {/* Below the dashboard, because it is about the shape of the material
          rather than about today. It renders nothing when nothing is loose. */}
      <LooseEnds userId={userId} dict={dict} />

      <DashboardView dict={dict} locale={locale} now={now} data={data} />
    </div>
  );
}
