import type { Collision } from "@/lib/time-intelligence";

/**
 * The end of the loop: what actually happened today, and what tomorrow is
 * shaping up to be.
 *
 * The rule this file exists to hold is that the evening is not a scoreboard.
 * A day with nothing recorded is not a failure to be reported back, and a day
 * with three tasks closed is not a victory lap — both are just facts the
 * student already lived. So there is no score, no streak, no encouragement,
 * and nothing stored about how they felt. What is worth saying in the evening
 * is the one thing they cannot see for themselves: whether tomorrow, as it is
 * currently shaped, will hold what is already pointed at it.
 *
 * Every number here comes from rows the student created. When there is no
 * evidence, the outcome says so rather than filling in a kind sentence.
 */

export type DayOutcome =
  /** No completions, no focus time — and nothing was due either. */
  | "NOTHING_RECORDED"
  /** No work recorded, and things due today are still open. */
  | "SLIPPED"
  /** Work happened, but today still has open items on it. */
  | "PARTIAL"
  /** Work happened and nothing due today is still outstanding. */
  | "CLEARED";

export interface EveningRead {
  outcome: DayOutcome;
  tasksCompleted: number;
  focusMinutes: number;
  /** Items due today that are still not done. */
  openDueToday: number;
  /** Items due tomorrow. */
  dueTomorrow: number;
  /** Does tomorrow's work fit tomorrow's actual free time? */
  tomorrow: Collision;
}

/**
 * Reads the evening.
 *
 * The ordering matters: whether anything was recorded is checked before
 * whether anything is outstanding, because "you did nothing and three things
 * are late" and "you worked and three things are still open" deserve
 * different sentences, and collapsing them into one would make the honest
 * case sound like the harsh one.
 */
export function readEvening(input: {
  tasksCompleted: number;
  focusMinutes: number;
  openDueToday: number;
  dueTomorrow: number;
  tomorrow: Collision;
}): EveningRead {
  const { tasksCompleted, focusMinutes, openDueToday } = input;
  const worked = tasksCompleted > 0 || focusMinutes > 0;

  const outcome: DayOutcome = !worked
    ? openDueToday > 0
      ? "SLIPPED"
      : "NOTHING_RECORDED"
    : openDueToday > 0
      ? "PARTIAL"
      : "CLEARED";

  return { ...input, outcome };
}

/** After this hour, the day is close enough to over to talk about tomorrow. */
export const EVENING_FROM_HOUR = 18;

/** Is it late enough in `now` to show the check-in at all? */
export function isEvening(now: Date): boolean {
  return now.getHours() >= EVENING_FROM_HOUR;
}
