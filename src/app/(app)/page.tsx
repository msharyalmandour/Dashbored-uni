import { getCurrentUserId } from "@/lib/current-user";
import { getDashboardData } from "@/lib/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { CommandHeader } from "@/components/dashboard/command-header";
import { AmbientHero } from "@/components/dashboard/ambient-hero";
import { NextActions } from "@/components/dashboard/next-actions";
import { AcademicHealthCard } from "@/components/dashboard/academic-health-card";
import { DeadlinesCard } from "@/components/dashboard/deadlines-card";
import { ReviewTodayCard } from "@/components/dashboard/review-today-card";
import { KnowledgeGapsCard } from "@/components/dashboard/knowledge-gaps-card";

// Urgency and "what's due" are relative to the current moment, so this page
// must always render fresh rather than serve a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const data = await getDashboardData(userId);
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <AmbientHero now={now}>
        <CommandHeader
          now={now}
          dict={dict}
          locale={locale}
          userName={data.userName}
          topRecommendation={data.recommendations[0]}
          focusMinutesToday={data.todayProgress.focusMinutesToday}
          tasksDueToday={data.todayProgress.tasksDueToday}
        />
      </AmbientHero>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <NextActions dict={dict} recommendations={data.recommendations} />
        <AcademicHealthCard dict={dict} health={data.health} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DeadlinesCard dict={dict} tasks={data.upcomingTasks} />
        <ReviewTodayCard dict={dict} reviews={data.reviewsDue} />
        <KnowledgeGapsCard dict={dict} summary={data.gapsSummary} />
      </div>
    </div>
  );
}
