import { Flame } from "lucide-react";
import type { Recommendation } from "@/lib/priority-engine";

function greeting(now: Date) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function CommandHeader({
  userName,
  topRecommendation,
  focusMinutesToday,
  tasksDueToday,
}: {
  userName: string;
  topRecommendation?: Recommendation;
  focusMinutesToday: number;
  tasksDueToday: number;
}) {
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting(now)}, {userName.split(" ")[0]}
        </h1>
        {topRecommendation ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Flame className="size-4 text-destructive" />
            Today&apos;s focus:{" "}
            <span className="font-medium text-foreground">{topRecommendation.title}</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing urgent — great day to get ahead on reviews.
          </p>
        )}
      </div>
      <div className="flex gap-4 text-sm">
        <div className="rounded-lg border border-border bg-card px-4 py-2 text-center">
          <p className="font-display text-lg font-semibold">{focusMinutesToday}</p>
          <p className="text-xs text-muted-foreground">min studied today</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-2 text-center">
          <p className="font-display text-lg font-semibold">{tasksDueToday}</p>
          <p className="text-xs text-muted-foreground">due today</p>
        </div>
      </div>
    </div>
  );
}
