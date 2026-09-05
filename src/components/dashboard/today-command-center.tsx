import { CalendarClock } from "lucide-react";
import { FocusNow } from "@/components/dashboard/focus-now";
import { ScheduleTimeline } from "@/components/dashboard/schedule-timeline";
import { AcademicHealthCard } from "@/components/dashboard/academic-health-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import type { DashboardData } from "@/lib/dashboard";

/**
 * Deliberately asymmetric: Focus Now takes two-thirds of the row because
 * it's the one thing that matters most right now; the schedule + academic
 * status share the remaining third because they're "what's next" and
 * "how am I doing," not "what should I do" — three equal boxes would say
 * all three questions matter the same amount, which isn't true.
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
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <FocusNow dict={dict} recommendations={data.recommendations} />
      </div>
      <div className="flex flex-col gap-4">
        <Card variant="quiet" className="flex flex-1 flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarClock className="size-4 text-primary" />
              {dict.dashboard.todaysSchedule}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <ScheduleTimeline dict={dict} locale={locale} tasks={data.upcomingTasks} reviews={data.reviewsDue} now={now} />
          </CardContent>
        </Card>
        <AcademicHealthCard dict={dict} health={data.health} />
      </div>
    </div>
  );
}
