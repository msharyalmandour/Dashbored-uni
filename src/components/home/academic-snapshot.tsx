import Link from "next/link";
import { GraduationCap, CheckSquare, RotateCcw, Lightbulb, ArrowUpRight } from "lucide-react";
import { snapshotTiles, heroRing, type SnapshotKind } from "@/lib/home-metrics";

/* The arc, drawn rather than animated. 44px radius, 2*pi*r = 276.46. */
const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;
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
  health,
}: {
  dict: Dictionary;
  /** Academic health, moved here from the hero — see hero.tsx. */
  health: { score: number };
  data: {
    activeSubjectsCount: number;
    activeTasksCount: number;
    reviewsDueTotal: number;
    gapsSummary: { unresolved: number };
  };
}) {
  const t = dict.home.snapshot;
  const tiles = snapshotTiles(data);
  const ring = heroRing(health);

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

      {/* ONE CARD WITH DIVIDERS, not four floating tiles.
      
          The reference draws these as cells of a single bar separated by
          hairlines, and the difference is what the row claims: four separate
          cards read as four unrelated things that happen to be adjacent, while
          one divided bar reads as one status line about the term — which is
          what it is. It also stops four rounded borders and four shadows from
          competing with the cards further down the page that are genuinely
          separate objects.
      
          The ring rides at the end, the way the reference closes its row. */}
      <div className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--card)] lg:grid-cols-5">
        {tiles.map((tile) => {
          const Icon = ICON[tile.kind];
          return (
            <Link
              key={tile.kind}
              href={tile.href}
              className={cn(
                "group relative flex flex-col justify-between gap-5 overflow-hidden p-4 transition-colors sm:p-5",
                /* Dividers instead of borders: a hairline on the leading edge
                   of every cell but the first, which is what makes the row one
                   object. `border-s` rather than `border-l` so it flips with
                   the writing direction. */
                "border-[color:var(--border)] [&:not(:first-child)]:border-s",
                "hover:bg-[color:var(--accent)]/40"
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

        {/* THE RING, closing the row as the reference closes its own.
        
            Under its own name. The reference labels this cell "68% Study
            Progress", and there is no such quantity in this schema — no
            semester, no credit load, no definition of done — so it keeps the
            name of what it actually is, and `verify-home-metrics.ts` asserts
            the words "semester progress" never appear.
        
            Spans both columns at phone width so it is not a half-width ring
            with a wrapped label beside four half-width numbers. */}
        <Link
          href="/"
          aria-label={t.ringLabel}
          className="col-span-2 flex items-center gap-4 border-[color:var(--border)] p-4 transition-colors hover:bg-[color:var(--accent)]/40 sm:p-5 lg:col-span-1 lg:border-s"
        >
          <span className="relative grid size-[68px] shrink-0 place-items-center">
            <svg viewBox="0 0 112 112" className="size-full -rotate-90" aria-hidden>
              <circle cx="56" cy="56" r={RING_R} fill="none" stroke="var(--border)" strokeWidth="9" />
              <circle
                cx="56"
                cy="56"
                r={RING_R}
                fill="none"
                stroke="url(#uos-ring)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - ring.pct / 100)}
              />
              <defs>
                <linearGradient id="uos-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ff8a00" />
                  <stop offset="45%" stopColor="#ff5a1f" />
                  <stop offset="100%" stopColor="#d92d00" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute font-display text-base font-semibold tabular-nums">
              <span dir="ltr">{ring.pct}%</span>
            </span>
          </span>
          <span className="min-w-0 text-xs leading-snug text-muted-foreground">{t.ringLabel}</span>
        </Link>
      </div>
    </section>
  );
}
