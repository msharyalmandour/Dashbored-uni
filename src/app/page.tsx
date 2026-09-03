import { getCurrentUserId } from "@/lib/current-user";
import { getDashboardData } from "@/lib/dashboard";
import { CommandHeader } from "@/components/dashboard/command-header";
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

  return (
    <div className="flex flex-col gap-6">
      <CommandHeader
        userName={data.userName}
        topRecommendation={data.recommendations[0]}
        focusMinutesToday={data.todayProgress.focusMinutesToday}
        tasksDueToday={data.todayProgress.tasksDueToday}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <NextActions recommendations={data.recommendations} />
        <AcademicHealthCard health={data.health} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DeadlinesCard tasks={data.upcomingTasks} />
        <ReviewTodayCard reviews={data.reviewsDue} />
        <KnowledgeGapsCard summary={data.gapsSummary} />
      </div>
    </div>
  );
}
