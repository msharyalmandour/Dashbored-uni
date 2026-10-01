/**
 * How long a drop is likely to take, or an honest silence.
 *
 * WHY THIS IS NOT A PROGRESS BAR. The waiting state says "understanding" and
 * then "organising", and a student watching it cannot tell five seconds from
 * five minutes. The obvious fix is a bar that fills — and a bar that fills on
 * a timer is a lie with an animation, because nothing here knows the
 * denominator. What a student actually needs during a wait is whether to stay
 * on the screen, and that is answered by a number of seconds or by nothing.
 *
 * WHY IT COULD NOT BE BUILT BEFORE. Nothing recorded how long a run took.
 * `updatedAt - createdAt` is the tempting proxy and it is not a duration: it
 * moves on every later write, so a row the cron re-read reports a run that
 * lasted a fortnight. Measured on the real account, that proxy ranged from 14
 * seconds to 1,700,830 for work that plainly took under a minute.
 * `CaptureItem.durationMs` now records it directly.
 *
 * THE FLOOR IS THE POINT. Four observations, matching MIN_OBSERVATIONS in
 * patterns.ts for the same reason: one run is an anecdote, two is a line
 * through two points, and a student who is told "about 20 seconds" and waits
 * two minutes stops believing the next thing the screen says. Below the floor
 * this returns nothing and the interface says nothing, which is the honest
 * state and the one the app starts in.
 *
 * Pure: durations in, a verdict out. No database, no clock.
 */

/** Runs needed before a number is worth printing. Matches patterns.ts. */
export const MIN_RUNS_FOR_ESTIMATE = 4;

/**
 * How far past the typical run we promise.
 *
 * The median is the honest centre and it is the wrong thing to show: half of
 * all runs are slower than it, so half of all students would be told a number
 * they then beat. The upper quartile is quoted instead — most waits come in
 * under it, and the ones that do not are late against a promise that was
 * already generous rather than against an average.
 */
export const QUOTED_QUANTILE = 0.75;

export type DropEstimate =
  /** Enough runs to say something. Seconds, rounded to something sayable. */
  | { kind: "SECONDS"; seconds: number; fromRuns: number }
  /** Not enough measured runs. The interface says nothing about time. */
  | { kind: "UNKNOWN" };

/**
 * The quantile of a sample, by nearest rank.
 *
 * Nearest rank rather than interpolation on purpose: these are wall-clock
 * measurements of a handful of runs, and interpolating between two of them
 * invents a duration no run ever took. A real observation is the honest thing
 * to quote.
 */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil(q * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/**
 * What to tell someone who has just dropped something.
 *
 * Zero and negative durations are dropped rather than counted: the column is
 * written only for a run that happened, so a zero means something wrote the
 * wrong thing, and letting it into the sample would drag every estimate down.
 */
export function estimateFrom(durationsMs: readonly (number | null)[]): DropEstimate {
  const usable = durationsMs
    .filter((d): d is number => typeof d === "number" && Number.isFinite(d) && d > 0)
    .sort((a, b) => a - b);

  if (usable.length < MIN_RUNS_FOR_ESTIMATE) return { kind: "UNKNOWN" };

  const ms = quantile(usable, QUOTED_QUANTILE);
  return { kind: "SECONDS", seconds: sayableSeconds(ms), fromRuns: usable.length };
}

/**
 * A number a person would say out loud.
 *
 * "about 23 seconds" claims a precision this sample cannot support and reads
 * as a countdown the student will check. Rounded to 5 below a minute and to 10
 * above it, so the number looks like the estimate it is. Never below 5: a
 * promise of "about 2 seconds" is a promise to be wrong.
 */
export function sayableSeconds(ms: number): number {
  const s = ms / 1000;
  if (s <= 5) return 5;
  if (s < 60) return Math.round(s / 5) * 5;
  return Math.round(s / 10) * 10;
}
