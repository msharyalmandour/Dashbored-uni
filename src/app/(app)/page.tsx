import { getCurrentUserId } from "@/lib/current-user";
import { getDashboardData } from "@/lib/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getAiStatus } from "@/lib/ai/provider";
import { HomeSurface } from "@/components/home/home-surface";

/**
 * Home.
 *
 * Reads the same data the detailed day view reads — one query, already
 * written and already cached per request — but takes one number out of it.
 * The rest of that data is not thrown away; it is what /today renders, and
 * this page deliberately declines to show it.
 *
 * "What is due today" is the only figure Home states, because it is the only
 * one that changes what a student does in the next ten seconds. Everything
 * else was a statistic about them rather than an answer for them.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [data, ai] = await Promise.all([getDashboardData(userId, dict), Promise.resolve(getAiStatus())]);
  const now = new Date();

  return (
    <HomeSurface
      userName={data.userName}
      dueToday={data.todayProgress.tasksDueToday}
      aiConfigured={ai.configured}
      canTranscribe={ai.canTranscribe}
      now={now}
    />
  );
}
