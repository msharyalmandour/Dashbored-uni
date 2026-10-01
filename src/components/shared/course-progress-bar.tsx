import { Progress } from "@/components/ui/progress";
import { progressFraction, type CourseProgress } from "@/lib/course-progress";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * How far through a course, drawn the one way everywhere.
 *
 * One component rather than the same three lines in the course card, the
 * academics list and the worlds panel, because the rule it enforces is easy to
 * lose in a copy: a percentage is printed only when the course has enough
 * lectures for one to mean anything, and a course with no material prints
 * nothing at all.
 *
 * The bar and the label are decided separately and deliberately. A bar filled
 * halfway for one lecture of two is true — that is what a half is — while the
 * *number* "50%" over two items claims a precision two items cannot support.
 * So the bar always draws and only the label steps down to a fraction.
 */
export function CourseProgressBar({
  progress,
  dict,
  className,
}: {
  progress: CourseProgress;
  dict: Dictionary;
  className?: string;
}) {
  const t = dict.academics.progress;

  /* Nothing to measure: no bar, no zero, no empty track.

     An empty track reads as a course the student has failed to start; four of
     the six courses on the real account have no lectures at all, so four
     empty tracks would put four rebukes on a screen where the true statement
     is "nothing has been dropped in here yet" — which is an invitation, and
     belongs in words rather than in a bar at zero. */
  if (progress.kind === "EMPTY") {
    return <p className={`text-xs text-muted-foreground ${className ?? ""}`}>{t.nothingYet}</p>;
  }

  const label =
    progress.kind === "PERCENT"
      ? `${progress.percent}%`
      : t.fraction.replace("{done}", String(progress.done)).replace("{total}", String(progress.total));

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Progress value={progressFraction(progress) * 100} />
      <p className="flex items-center justify-between text-xs text-muted-foreground">
        {/* The fraction is read out in words for a screen reader either way:
            "2 / 3" announced as digits either side of a slash is not a
            sentence, and "50%" on its own never says what of. */}
        <span className="tabular-nums">{label}</span>
        {progress.kind === "PERCENT" && (
          <span className="tabular-nums">
            {t.fraction.replace("{done}", String(progress.done)).replace("{total}", String(progress.total))}
          </span>
        )}
      </p>
    </div>
  );
}
