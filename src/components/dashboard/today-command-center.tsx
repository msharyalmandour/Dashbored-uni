import { CalendarClock, MapPin, CloudSun } from "lucide-react";
import { FocusNow } from "@/components/dashboard/focus-now";
import { EveningCheckIn } from "@/components/dashboard/evening-check-in";
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

      {/* The other end of the day. It sits directly under the one action
          because by evening that is the pair the student is choosing between:
          do one more thing, or stop. Rendered only once the day is actually
          winding down — a "how did today go" card at 9am is noise. */}
      {data.isEvening && (
        <EveningCheckIn
          dict={dict}
          evening={data.evening}
          dayKey={now.toISOString().slice(0, 10)}
          shortThing={
            // Only offered when something is genuinely still open today.
            // Otherwise the evening ends without a nudge, which is the point.
            data.evening.openDueToday > 0 && data.recommendations[0]
              ? {
                  title: data.recommendations[0].title,
                  subjectId: data.recommendations[0].subjectId,
                  why: data.recommendations[0].reason,
                }
              : undefined
          }
        />
      )}

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
        <Card variant="quiet" className="flex flex-col md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarClock className="size-4 text-primary" />
              {dict.dashboard.todaysSchedule}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {/* The next thing the student physically has to be at. Nothing
                rendered ScheduleEvent before this, so a timetable they had
                imported was invisible to them. */}
            {data.nextEvent && (
              <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-border-subtle bg-surface-secondary px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {dict.today.nextUp}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {data.nextEvent.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(data.nextEvent.startsAt).toLocaleString(locale, {
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {data.nextEvent.location && (
                  <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
                    <MapPin className="size-3" />
                    {data.nextEvent.location}
                  </span>
                )}
              </div>
            )}

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

      {/* One line on the week — the honest verdict from the time engine, said
          the way a person would say it, not as a "capacity" reading. */}
      <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <CloudSun className="size-3.5" />
        {dict.today.week[data.situation.week]}
      </p>

      <AcademicHealthCard dict={dict} health={data.health} />
    </div>
  );
}
