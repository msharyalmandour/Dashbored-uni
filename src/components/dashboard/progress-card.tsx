import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/dictionaries";
import { ImageFeatureCard } from "@/components/ui/image-feature-card";

/**
 * The one deliberately editorial panel in the command centre: a photograph
 * and the day's real figure, sitting between the schedule and the health
 * score.
 *
 * It still reports something true. The reference art shows "3/5 study
 * goals", but this app has no concept of a weekly study goal, so inventing
 * that number would be presenting fiction as data. What it shows instead is
 * the real figure it does have — tasks completed today against the tasks
 * that were due — labelled honestly as today rather than dressed up as a
 * week.
 *
 * The layering used to live here, inline. It is ImageFeatureCard now, because
 * a second image card was being added beside it and two hand-built stacks
 * drift apart the first time either is touched.
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
    <ImageFeatureCard
      image="/ambient/progress.jpg"
      label={dict.dashboard.todayLabel}
      /* The figure is the count, not the percentage: "2" of a planned 5 is
         what happened, and 40% is a reading of it. The bar below carries the
         proportion, so the number does not have to say it twice. */
      value={String(tasksCompletedToday)}
      caption={
        planned === 0
          ? dict.dashboard.nothingDueToday
          : format(dict.dashboard.tasksDoneOfPlanned, { done: tasksCompletedToday, planned })
      }
    >
      <div>
        <p className="font-display text-sm font-semibold leading-tight tracking-tight text-foreground/90">
          {dict.dashboard.progressNotPerfection}
        </p>
        {planned > 0 && (
          <div className="liquid-track mt-2 h-1.5">
            <div className="liquid-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    </ImageFeatureCard>
  );
}
