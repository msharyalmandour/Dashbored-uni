import type { CommitmentKind } from "@prisma/client";

/**
 * The Time Intelligence engine.
 *
 * Every function here is pure and takes real rows in. That is deliberate: the
 * one thing this engine must never do is produce a confident number out of
 * nothing. A student who is told they have six free hours, plans against it,
 * and discovers it was a guess has been actively misled — worse off than if
 * the app had said nothing at all.
 *
 * So the rules are:
 *   - Time is only subtracted for commitments that genuinely exist as rows.
 *   - A task with no estimate stays *unknown*, and is reported as unknown.
 *     It is never filled in with an average to make a total look complete.
 *   - The one judgement call in here (STUDY_CAPACITY) is a named, documented
 *     constant rather than a quiet multiplier buried in a calculation, and
 *     the UI says out loud what it means.
 */

export const MINUTES_PER_DAY = 24 * 60;

/**
 * The share of genuinely free time that can realistically go to studying.
 *
 * Nobody studies every unclaimed minute of their day, and a planner that
 * assumes they will produces schedules that fail on contact with a real
 * week — which is exactly the "fake optimistic plan" this product is meant
 * to refuse. Two thirds is deliberately conservative and, importantly, is
 * shown to the student rather than applied behind their back.
 *
 * This is an assumption, not a measurement. When enough real session data
 * exists it should be replaced by the student's own observed ratio.
 */
export const STUDY_CAPACITY = 2 / 3;

export interface CommitmentRow {
  id: string;
  kind: CommitmentKind;
  label: string | null;
  /** 0 = Sunday … 6 = Saturday. Null means every day. */
  weekday: number | null;
  startMinute: number;
  endMinute: number;
}

/** A half-open span of minutes inside one day: [start, end). */
export interface Segment {
  start: number;
  end: number;
}

/**
 * The minutes a commitment occupies on a given weekday.
 *
 * A block whose end is at or before its start crosses midnight, which is the
 * normal shape of sleep rather than a rare edge case. Such a block lands on
 * *two* days: the evening portion on its own weekday, and the morning
 * portion on the day after. Both are returned for whichever day is asked
 * about, so 23:00–07:00 is correctly counted once in each.
 */
export function segmentsOnWeekday(commitment: CommitmentRow, weekday: number): Segment[] {
  const { startMinute, endMinute } = commitment;
  const appliesToday = commitment.weekday === null || commitment.weekday === weekday;
  const wraps = endMinute <= startMinute;

  if (!wraps) {
    return appliesToday ? [{ start: startMinute, end: endMinute }] : [];
  }

  const segments: Segment[] = [];

  // The evening half belongs to the day the block starts on.
  if (appliesToday) segments.push({ start: startMinute, end: MINUTES_PER_DAY });

  // The morning half belongs to the following day, so it shows up here when
  // *yesterday* is the day this commitment is scheduled for.
  const yesterday = (weekday + 6) % 7;
  const startedYesterday = commitment.weekday === null || commitment.weekday === yesterday;
  if (startedYesterday && endMinute > 0) segments.push({ start: 0, end: endMinute });

  return segments;
}

/**
 * Merges overlapping spans so double-booked commitments are not counted twice.
 *
 * Students really do enter overlapping blocks — a commute that runs into a
 * lecture, a meal during a shift. Summing them naively subtracts more than a
 * day contains and reports negative free time, so overlap has to collapse.
 */
export function mergeSegments(segments: Segment[]): Segment[] {
  const sorted = [...segments]
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const merged: Segment[] = [];
  for (const segment of sorted) {
    const last = merged[merged.length - 1];
    if (last && segment.start <= last.end) {
      last.end = Math.max(last.end, segment.end);
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

/** Total minutes already spoken for on a given date. */
export function committedMinutesOn(commitments: CommitmentRow[], date: Date): number {
  const weekday = date.getDay();
  const segments = commitments.flatMap((c) => segmentsOnWeekday(c, weekday));
  return mergeSegments(segments).reduce((total, s) => total + (s.end - s.start), 0);
}

export interface DayCapacity {
  /** Minutes left after every known commitment. Real, not estimated. */
  flexibleMinutes: number;
  /** The share of that this engine assumes can actually go to study work. */
  studyMinutes: number;
  /** Sum of known commitments, for showing the working. */
  committedMinutes: number;
  /**
   * True when the student has told the system nothing about their week. The
   * UI must treat this as "we don't know yet" and ask, never as "you are
   * completely free" — which is what an empty table literally computes to.
   */
  unknown: boolean;
}

/**
 * What a day realistically has left in it.
 *
 * With no commitments recorded this reports `unknown`, because the honest
 * answer to "how much time do you have?" when nothing is known is not
 * "twenty-four hours".
 */
export function dayCapacity(commitments: CommitmentRow[], date: Date): DayCapacity {
  const committedMinutes = committedMinutesOn(commitments, date);
  const flexibleMinutes = Math.max(0, MINUTES_PER_DAY - committedMinutes);

  return {
    committedMinutes,
    flexibleMinutes,
    studyMinutes: Math.round(flexibleMinutes * STUDY_CAPACITY),
    unknown: commitments.length === 0,
  };
}

/**
 * The part of a day that is still ahead.
 *
 * Planning at 9pm against a whole day's capacity is the same lie in a
 * different shape, so anything that answers "what should I do now" prorates
 * by how much of the day is actually left.
 */
export function remainingCapacityToday(commitments: CommitmentRow[], now: Date): DayCapacity {
  const weekday = now.getDay();
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();

  const remainingSegments = mergeSegments(
    commitments
      .flatMap((c) => segmentsOnWeekday(c, weekday))
      .map((s) => ({ start: Math.max(s.start, minuteOfDay), end: s.end }))
  );

  const committedMinutes = remainingSegments.reduce((total, s) => total + (s.end - s.start), 0);
  const minutesLeftInDay = MINUTES_PER_DAY - minuteOfDay;
  const flexibleMinutes = Math.max(0, minutesLeftInDay - committedMinutes);

  return {
    committedMinutes,
    flexibleMinutes,
    studyMinutes: Math.round(flexibleMinutes * STUDY_CAPACITY),
    unknown: commitments.length === 0,
  };
}

export interface WorkItem {
  id: string;
  title: string;
  deadline: Date;
  /** Null when nobody has estimated this. Counted as unknown, never guessed. */
  estimatedMinutes: number | null;
  /** 0-100. Work already done does not need planning for again. */
  completionPercentage: number;
}

export interface WorkloadSummary {
  /** Minutes of work that is actually estimated and still outstanding. */
  knownMinutes: number;
  /** Items with no estimate. Reported, never averaged into knownMinutes. */
  unestimated: WorkItem[];
  items: WorkItem[];
}

/**
 * Outstanding work in a window, separated into what is known and what is not.
 *
 * The separation is the whole point. "You need 9 hours" and "you need 9 hours
 * plus three things nobody has sized" are very different statements, and only
 * the second one is true when estimates are missing.
 */
export function summariseWorkload(items: WorkItem[], until: Date): WorkloadSummary {
  const inWindow = items.filter(
    (item) => item.deadline <= until && item.completionPercentage < 100
  );

  let knownMinutes = 0;
  const unestimated: WorkItem[] = [];

  for (const item of inWindow) {
    if (item.estimatedMinutes === null) {
      unestimated.push(item);
      continue;
    }
    // Only the unfinished share still needs time.
    const remaining = item.estimatedMinutes * (1 - item.completionPercentage / 100);
    knownMinutes += Math.max(0, Math.round(remaining));
  }

  return { knownMinutes, unestimated, items: inWindow };
}

export type CollisionVerdict = "FITS" | "TIGHT" | "OVERLOADED" | "UNKNOWN";

export interface Collision {
  verdict: CollisionVerdict;
  /** Minutes of estimated work that do not fit. Zero unless OVERLOADED. */
  deficitMinutes: number;
  availableMinutes: number;
  requiredMinutes: number;
  /** How many outstanding items nobody has sized. */
  unestimatedCount: number;
}

/**
 * Does the work fit in the time?
 *
 * Returns UNKNOWN rather than a verdict when the inputs cannot support one —
 * no recorded commitments, or nothing estimated. The product's promise is to
 * be honest about constraints, and inventing a reassuring "FITS" from missing
 * data would break that on the one screen where it matters most.
 */
export function detectCollision(
  available: DayCapacity,
  workload: WorkloadSummary
): Collision {
  const base = {
    availableMinutes: available.studyMinutes,
    requiredMinutes: workload.knownMinutes,
    unestimatedCount: workload.unestimated.length,
    deficitMinutes: 0,
  };

  if (available.unknown || (workload.knownMinutes === 0 && workload.unestimated.length > 0)) {
    return { ...base, verdict: "UNKNOWN" };
  }

  if (workload.knownMinutes === 0) return { ...base, verdict: "FITS" };

  const deficit = workload.knownMinutes - available.studyMinutes;
  if (deficit > 0) return { ...base, verdict: "OVERLOADED", deficitMinutes: deficit };

  // Within a quarter of capacity is not comfortable, and saying so early is
  // more useful than a green light followed by a scramble.
  const headroom = available.studyMinutes - workload.knownMinutes;
  if (headroom < available.studyMinutes * 0.25) return { ...base, verdict: "TIGHT" };

  return { ...base, verdict: "FITS" };
}

/** The unit suffixes, so a duration inside an Arabic sentence stays Arabic. */
export interface DurationUnits {
  hours: string;
  minutes: string;
}

const DEFAULT_UNITS: DurationUnits = { hours: "h", minutes: "m" };

/**
 * "1h 30m" / "45m" — for reading, not for arithmetic.
 *
 * Units are passed in rather than hardcoded because these strings get
 * interpolated into whole sentences ("fits the 2h 40m you have left"), and a
 * Latin "h" dropped into an Arabic sentence is exactly the mixed-language
 * bug this app has had to fix before. Callers holding a dictionary pass its
 * labels; the default is only for contexts that have none.
 */
export function formatMinutes(minutes: number, units: DurationUnits = DEFAULT_UNITS): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (hours === 0) return `${rest}${units.minutes}`;
  if (rest === 0) return `${hours}${units.hours}`;
  return `${hours}${units.hours} ${rest}${units.minutes}`;
}

/** "07:30" from minutes-since-midnight, for rendering a commitment. */
export function formatMinuteOfDay(minute: number): string {
  const safe = ((Math.round(minute) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}
