import { Flame, CheckCircle2, Timer } from "lucide-react";
import type { Recommendation } from "@/lib/priority-engine";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { getTimePeriod } from "@/lib/time-period";

function greeting(now: Date, dict: Dictionary) {
  switch (getTimePeriod(now)) {
    case "morning":
      return dict.dashboard.greetingMorning;
    case "day":
      return dict.dashboard.greetingAfternoon;
    case "evening":
      return dict.dashboard.greetingEvening;
    case "night":
      return dict.dashboard.greetingNight;
  }
}

export function CommandHeader({
  now,
  dict,
  locale,
  userName,
  topRecommendation,
  tagline,
  todayProgress,
}: {
  now: Date;
  dict: Dictionary;
  locale: Locale;
  userName: string;
  topRecommendation?: Recommendation;
  tagline: string;
  todayProgress: { tasksCompletedToday: number; tasksDueToday: number; focusMinutesToday: number };
}) {
  const dateLabel = now.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const { tasksCompletedToday, tasksDueToday, focusMinutesToday } = todayProgress;
  const plannedToday = tasksCompletedToday + tasksDueToday;
  const donePct = plannedToday === 0 ? 0 : Math.round((tasksCompletedToday / plannedToday) * 100);

  return (
    /* Greeting left, today's actual progress right. The right half of this
       banner used to be empty at desktop width, which read as unfinished
       rather than spacious — and the app already computes what belongs
       there. Every figure below is real: completed and due counts and
       focus minutes all come from getDashboardData. */
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          {greeting(now, dict)}, {userName.split(" ")[0]}
        </h1>
        {topRecommendation ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground sm:text-base">
            <Flame className="size-4 shrink-0 text-destructive" />
            {dict.dashboard.todaysFocus}{" "}
            <span className="font-medium text-foreground">{topRecommendation.title}</span>
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">{dict.dashboard.noUrgentFocus}</p>
        )}
        <p className="mt-2 text-xs italic text-muted-foreground/80">&ldquo;{tagline}&rdquo;</p>
      </div>

      <div className="w-full shrink-0 rounded-xl border border-border-subtle bg-surface-elevated/70 p-4 lg:w-64">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {dict.dashboard.todaySoFar}
        </p>
        <div className="mt-3 flex items-baseline gap-4">
          <span className="flex items-baseline gap-1.5">
            <CheckCircle2 className="size-3.5 shrink-0 translate-y-0.5 text-success" />
            <span className="font-display text-xl font-semibold leading-none">{tasksCompletedToday}</span>
            <span className="text-[11px] text-muted-foreground">{dict.dashboard.tasksDone}</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <Timer className="size-3.5 shrink-0 translate-y-0.5 text-module-planning" />
            <span className="font-display text-xl font-semibold leading-none">{focusMinutesToday}</span>
            <span className="text-[11px] text-muted-foreground">{dict.dashboard.minutesStudied}</span>
          </span>
        </div>
        {plannedToday > 0 && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success transition-all duration-700" style={{ width: `${donePct}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
