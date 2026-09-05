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
}: {
  now: Date;
  dict: Dictionary;
  locale: Locale;
  userName: string;
  topRecommendation?: Recommendation;
}) {
  const dateLabel = now.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
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
  );
}
