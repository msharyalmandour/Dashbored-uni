import { Flame } from "lucide-react";
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
  focusMinutesToday,
  tasksDueToday,
}: {
  now: Date;
  dict: Dictionary;
  locale: Locale;
  userName: string;
  topRecommendation?: Recommendation;
  focusMinutesToday: number;
  tasksDueToday: number;
}) {
  const dateLabel = now.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting(now, dict)}, {userName.split(" ")[0]}
        </h1>
        {topRecommendation ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Flame className="size-4 text-destructive" />
            {dict.dashboard.todaysFocus}{" "}
            <span className="font-medium text-foreground">{topRecommendation.title}</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{dict.dashboard.noUrgentFocus}</p>
        )}
      </div>
      <div className="flex gap-3 text-sm">
        <div className="rounded-lg border border-border-subtle bg-surface-elevated px-4 py-2 text-center shadow-card">
          <p className="font-display text-lg font-semibold">{focusMinutesToday}</p>
          <p className="text-xs text-muted-foreground">{dict.dashboard.minStudiedToday}</p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-elevated px-4 py-2 text-center shadow-card">
          <p className="font-display text-lg font-semibold">{tasksDueToday}</p>
          <p className="text-xs text-muted-foreground">{dict.dashboard.dueToday}</p>
        </div>
      </div>
    </div>
  );
}
