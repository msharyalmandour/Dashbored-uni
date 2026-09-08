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
 * The three questions a student opens this app to answer, side by side:
 * "what should I do right now", "what's coming today", "how am I doing".
 *
 * Deliberately asymmetric. Focus Now takes half the row on a wide screen
 * because it is the only one of the three that tells you what to *do*; the
 * other two are context. Earlier this stacked the schedule and health card
 * in a single narrow third, which buried the health card below the fold and
 * left the row feeling emptier than the information in it deserved — on a
 * wide display all three now sit in view at once.
 *
 * The column count steps rather than scaling: one stacked column on mobile,
 * two on tablet, and a twelve-column grid on desktop split 4/3/2/3 so the
 * four panels get the widths their content actually needs rather than four
 * equal quarters — Focus Now is the widest because it is the only one that
 * tells you what to do.
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
    <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-12">
      <div className="md:col-span-2 xl:col-span-4">
        <FocusNow dict={dict} recommendations={data.recommendations} />
      </div>

      <Card variant="quiet" className="flex flex-col xl:col-span-3">
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

      <div className="xl:col-span-2">
        <ProgressCard
          dict={dict}
          tasksCompletedToday={data.todayProgress.tasksCompletedToday}
          tasksDueToday={data.todayProgress.tasksDueToday}
        />
      </div>

      <div className="xl:col-span-3">
        <AcademicHealthCard dict={dict} health={data.health} />
      </div>
    </div>
  );
}
