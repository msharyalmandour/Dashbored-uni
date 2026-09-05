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
    <div className="flex h-full flex-col justify-between gap-6">
      <div>
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
      </div>

      {/* Unboxed stat row — a thin logical-start border stands in for a
          divider instead of wrapping each number in its own card. */}
      <div className="flex items-center gap-6 text-sm">
        <div>
          <p className="font-display text-2xl font-semibold">{focusMinutesToday}</p>
          <p className="text-xs text-muted-foreground">{dict.dashboard.minStudiedToday}</p>
        </div>
        <div className="h-9 border-s border-border-subtle" />
        <div>
          <p className="font-display text-2xl font-semibold">{tasksDueToday}</p>
          <p className="text-xs text-muted-foreground">{dict.dashboard.dueToday}</p>
        </div>
      </div>
    </div>
  );
}
