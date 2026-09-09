import { CalendarClock } from "lucide-react";
import { FocusNow } from "@/components/dashboard/focus-now";
import { ScheduleTimeline } from "@/components/dashboard/schedule-timeline";
import { AcademicHealthCard } from "@/components/dashboard/academic-health-card";
import { ProgressCard } from "@/components/dashboard/progress-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import type { DashboardData } from "@/lib/dashboard";

/**
 * The three questions a student opens this app to answer — but not as three
 * equal panels.
 *
 * This used to lay Focus Now, the schedule, progress and academic health out
 * as four siblings of comparable weight, which is a fair summary of the data
 * and the wrong answer to "what do I do?". A stressed student reading four
 * panels has to rank them before they can act, and ranking them is the work
 * the product exists to remove.
 *
 * So the one panel that says what to *do* now takes the full width and comes
 * first; what is coming next sits under it; and how things are going is
 * context that follows both, because it informs nothing the student can act
 * on in the next twenty minutes.
 */
export function TodayCommandCenter({
  dict,
  locale,
  data,
  now,
}: {
  dict: Dictionary;
  locale: Locale;
  data: DashboardData;
  now: Date;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* One action, full width, first. Everything else is context. */}
      <FocusNow dict={dict} recommendations={data.recommendations} decision={data.decision} />

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
        <Card variant="quiet" className="flex flex-col md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarClock className="size-4 text-primary" />
              {dict.dashboard.todaysSchedule}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <ScheduleTimeline
              dict={dict}
              locale={locale}
              tasks={data.upcomingTasks}
              reviews={data.reviewsDue}
              now={now}
            />
          </CardContent>
        </Card>

        <ProgressCard
          dict={dict}
          tasksCompletedToday={data.todayProgress.tasksCompletedToday}
          tasksDueToday={data.todayProgress.tasksDueToday}
        />
      </div>

      <AcademicHealthCard dict={dict} health={data.health} />
    </div>
  );
}
