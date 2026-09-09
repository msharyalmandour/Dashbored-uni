import type { Collision, DayCapacity } from "@/lib/time-intelligence";

/**
 * What today actually looks like, in one sentence.
 *
 * The homepage used to open with a line picked at random from five generic
 * encouragements — "Progress, not perfection." Pleasant, and completely
 * disconnected from the student's week, which means it says the same thing on
 * a quiet Tuesday and the morning of three deadlines. A greeting that cannot
 * be wrong is also a greeting that cannot be useful.
 *
 * Everything here is derived from data that already exists: the collision
 * verdict from the time engine, the capacity for the day, and how close the
 * nearest deadline is. Nothing is invented, and when there is not enough
 * recorded to say anything, it says nothing rather than manufacturing calm.
 */

export type DaySituation =
  /** Not enough recorded to describe the week honestly. */
  | "UNKNOWN"
  /** Real room today, and the week is not fighting for it. */
  | "ROOM_TODAY"
  /** The week is fine but today itself is mostly spoken for. */
  | "TIGHT_TODAY"
  /** Pressure is coming, but it is not here yet — the useful warning. */
  | "BUILDING"
  /** The week's work does not fit the week's time. */
  | "OVERLOADED";

export type WeekState = "CALM" | "BUILDING" | "HEAVY" | "UNKNOWN";

export interface DailySituation {
  situation: DaySituation;
  week: WeekState;
  /** Days until the nearest deadline or exam. Null when there is none. */
  daysToNearest: number | null;
}

/** Below this, today is not a day with study time in it worth planning around. */
const TIGHT_DAY_MINUTES = 45;

/** Inside this many days, an approaching deadline is worth mentioning today. */
const HORIZON_DAYS = 3;

/**
 * Reads the day.
 *
 * The distinction that earns its place here is BUILDING: the week still fits,
 * but something lands soon. That is the one state where a student can still
 * act cheaply, and every planner that only speaks up once the week is already
 * over capacity has missed the moment that mattered.
 */
export function readDay(input: {
  collision: Collision;
  today: DayCapacity;
  daysToNearest: number | null;
}): DailySituation {
  const { collision, today, daysToNearest } = input;

  const week: WeekState =
    collision.verdict === "OVERLOADED"
      ? "HEAVY"
      : collision.verdict === "TIGHT"
        ? "BUILDING"
        : collision.verdict === "FITS"
          ? "CALM"
          : "UNKNOWN";

  // Nothing recorded about the week: say so rather than describing a day
  // built from an empty table, which computes to "completely free".
  if (today.unknown || collision.verdict === "UNKNOWN") {
    return { situation: "UNKNOWN", week, daysToNearest };
  }

  if (collision.verdict === "OVERLOADED") {
    return { situation: "OVERLOADED", week, daysToNearest };
  }

  // Something lands soon while there is still room to do something about it.
  if (daysToNearest !== null && daysToNearest <= HORIZON_DAYS) {
    return { situation: "BUILDING", week, daysToNearest };
  }

  if (today.studyMinutes < TIGHT_DAY_MINUTES) {
    return { situation: "TIGHT_TODAY", week, daysToNearest };
  }

  return { situation: "ROOM_TODAY", week, daysToNearest };
}
