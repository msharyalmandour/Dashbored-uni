import Link from "next/link";
import { GraduationCap, CheckSquare, RotateCcw, Lightbulb, ArrowUpRight } from "lucide-react";
import { snapshotTiles, type SnapshotKind } from "@/lib/home-metrics";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

const ICON: Record<SnapshotKind, typeof GraduationCap> = {
  courses: GraduationCap,
  tasks: CheckSquare,
  reviews: RotateCcw,
  gaps: Lightbulb,
};

/**
 * Four numbers, each one a door.
 *
 * Every figure comes from a count query rather than the length of a preview
 * array — the distinction that matters, because `subjectWorld` is capped at
 * four and reading its length would have printed "4 active courses" to a
 * student who has seven. See the counts added to getDashboardData.
 *
 * A zero is never printed as a zero. "0 reviews due" and "all caught up" are
 * the same fact and only one of them is worth the space; `snapshotTiles` marks
 * the empty ones and the tile swaps the figure for the sentence.
 *
 * Only tasks and reviews can take the accent, and only past a threshold, so
 * orange on this row always means "a pile is waiting" and never just "a number
 * exists". Seven courses is a fact; forty-two overdue reviews is a problem.
 */
export function AcademicSnapshot({
  dict,
  data,
}: {
  dict: Dictionary;
  data: {
    activeSubjectsCount: number;
    activeTasksCount: number;
    reviewsDueTotal: number;
    gapsSummary: { unresolved: number };
  };
}) {
  const t = dict.home.snapshot;
  const tiles = snapshotTiles(data);

  const EMPTY: Record<SnapshotKind, string> = {
    courses: t.emptyCourses,
    tasks: t.emptyTasks,
    reviews: t.emptyReviews,
    gaps: t.emptyGaps,
  };
  const LABEL: Record<SnapshotKind, string> = {
    courses: t.courses,
    tasks: t.tasks,
    reviews: t.reviews,
    gaps: t.gaps,
  };

  return (
    <section aria-labelledby="uos-snapshot">
      <h2
        id="uos-snapshot"
        className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
      >
        {t.heading}
      </h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = ICON[tile.kind];
          return (
            <Link
              key={tile.kind}
              href={tile.href}
              className={cn(
                "group relative flex flex-col justify-between gap-6 overflow-hidden rounded-[var(--radius-lg)] border p-4 transition-colors sm:p-5",
                "border-[color:var(--border)] bg-[color:var(--card)] hover:border-[color:var(--border-active)]",
                // The accent is a border and a bloom, never a fill. A filled
                // orange tile beside three dark ones stops reading as "urgent"
                // and starts reading as "selected".
                tile.accent && "border-[color:var(--border-active)]"
              )}
            >
              {tile.accent && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 -top-16 h-32 opacity-70"
                  style={{ backgroundImage: "var(--brand-glow)" }}
                />
              )}

              <span className="relative flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-[var(--radius-sm)] transition-colors",
                    tile.accent
                      ? "bg-[color:var(--accent)] text-[color:var(--primary)]"
                      : "bg-[color:var(--surface-elevated)] text-muted-foreground"
                  )}
                >
                  <Icon className="size-[18px]" />
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </span>

              <span className="relative min-w-0">
                {tile.empty ? (
                  /* The sentence replaces the number entirely. A greyed-out 0
                     with a caption under it says the same thing twice and
                     still leads with the least useful half. */
                  <span className="block text-sm font-medium leading-snug text-muted-foreground">
                    {EMPTY[tile.kind]}
                  </span>
                ) : (
                  <>
                    <span
                      dir="ltr"
                      className={cn(
                        "block font-display text-[2.25rem] font-semibold leading-none tracking-tight tabular-nums",
                        tile.accent && "text-[color:var(--primary)]"
                      )}
                    >
                      {tile.value}
                    </span>
                    <span className="mt-1.5 block text-xs leading-snug text-muted-foreground">
                      {LABEL[tile.kind]}
                    </span>
                  </>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
