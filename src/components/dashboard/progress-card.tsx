import Image from "next/image";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/dictionaries";

/**
 * The one deliberately editorial panel in the command centre: a photograph
 * and a line about the nature of progress, sitting between the schedule and
 * the health score.
 *
 * It still reports something true. The reference art shows "3/5 study
 * goals", but this app has no concept of a weekly study goal, so inventing
 * that number would be presenting fiction as data. What it shows instead is
 * the real figure it does have — tasks completed today against the tasks
 * that were due — labelled honestly as today rather than dressed up as a
 * week.
 */
export function ProgressCard({
  dict,
  tasksCompletedToday,
  tasksDueToday,
}: {
  dict: Dictionary;
  tasksCompletedToday: number;
  tasksDueToday: number;
}) {
  const planned = tasksCompletedToday + tasksDueToday;
  const pct = planned === 0 ? 0 : Math.round((tasksCompletedToday / planned) * 100);

  return (
    <div className="relative isolate flex min-h-[220px] flex-col justify-end overflow-hidden rounded-xl border border-border-subtle">
      <Image
        src="/ambient/progress.jpg"
        alt=""
        fill
        sizes="(max-width: 1280px) 50vw, 300px"
        className="pointer-events-none object-cover"
      />
      {/* Weighted to the foot of the card, where the text sits, so the summit
          stays visible while the copy keeps its contrast. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-primary via-surface-primary/70 to-surface-primary/10"
      />

      <div className="relative flex flex-col gap-3 p-4">
        <p className="font-display text-lg font-semibold leading-tight tracking-tight">
          {dict.dashboard.progressNotPerfection}
        </p>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {dict.dashboard.todayLabel}
          </p>
          <p className="mt-0.5 text-xs text-foreground/80">
            {planned === 0
              ? dict.dashboard.nothingDueToday
              : format(dict.dashboard.tasksDoneOfPlanned, {
                  done: tasksCompletedToday,
                  planned,
                })}
          </p>
          {planned > 0 && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
