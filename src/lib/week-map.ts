/**
 * One week, assembled from every part of the app that has a time in it.
 *
 * The page called "your week" used to hold three apologies and an empty state:
 * "I don't know your week yet", "I can't judge yet", "5 without an estimate",
 * and then, under a heading called Your week, "you haven't added anything".
 * All of that was true and none of it was a week. The fix is not a nicer
 * apology — it is to draw the week out of the records the student already has,
 * which are spread across four tables and were never once shown together.
 *
 * Everything here is a pure function over rows the caller has already fetched.
 * No Prisma, no clock beyond the `now` that is passed in, so the whole thing
 * can be tested without a database and answers the same way every run.
 */

/** A thing that occupies a stretch of a day: you are in it, and then you are not. */
export type SpanKind = "CLASS" | "TUTORIAL" | "LAB" | "CLINICAL" | "ACTIVITY" | "COMMITMENT";

/**
 * A thing that lands at a moment rather than filling one. A deadline is not
 * "an hour of work at 11pm" — it is a line you cross.
 */
export type PointKind = "DEADLINE" | "EXAM" | "REVIEW";

export interface WeekSpan {
  id: string;
  kind: SpanKind;
  title: string;
  /** Index within the full Saturday-first week, not within `days`. */
  dayIndex: number;
  startMinute: number;
  endMinute: number;
  subjectId: string | null;
  /** Which row within the day it was given, so overlaps sit side by side. */
  lane: number;
  /** How many rows its overlapping cluster needs, so a caller can size them. */
  laneCount: number;
}

export interface WeekPoint {
  id: string;
  kind: PointKind;
  title: string;
  dayIndex: number;
  minute: number;
  subjectId: string | null;
  overdue: boolean;
}

/**
 * Something real, with no time attached to it.
 *
 * A task carries a deadline and, nearly always, no estimate — so there is no
 * honest answer to "where does this go on Tuesday". It goes in a tray beside
 * the week, not on it. Dropping it onto the grid at a plausible-looking hour
 * would be the app inventing a decision the student never made, which is the
 * one thing this product has refused to do everywhere else.
 */
export interface UnplacedItem {
  id: string;
  title: string;
  minutes: number | null;
  dueDayIndex: number | null;
  overdue: boolean;
}

export interface WeekMap {
  days: { date: Date; index: number; isToday: boolean }[];
  spans: WeekSpan[];
  points: WeekPoint[];
  /** Where the "now" line is drawn, or null when this is not the current week. */
  now: { dayIndex: number; minute: number } | null;
  /**
   * The hours worth drawing — derived from spans only. Deadlines live in their
   * own strip beneath the grid, so an 11:59pm due date no longer drags the
   * whole week down to midnight to make room for something that takes no time.
   */
  window: { startMinute: number; endMinute: number };
  unplaced: UnplacedItem[];
  /** True when there is genuinely nothing — so the caller can say so once. */
  empty: boolean;
}

export const DAY_MINUTES = 24 * 60;

/** Midnight at the start of `date`, in local time. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * The Saturday on or before `date`.
 *
 * Saturday, not Monday: the academic week in Saudi Arabia runs Sunday to
 * Thursday, and a grid that splits the weekend across two rows is a grid that
 * fights the reader. `getDay()` returns 6 for Saturday.
 */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  return d;
}

function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function dayIndexIn(date: Date, weekStart: Date): number {
  const days = Math.floor((startOfDay(date).getTime() - weekStart.getTime()) / 86_400_000);
  return days;
}

function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/**
 * Give every span a lane so two things at the same hour sit beside each other
 * rather than one hiding the other.
 *
 * Greedy interval partitioning, per day: walk the spans in start order and drop
 * each into the first lane whose last span has already finished. `laneCount` is
 * then written back onto every span in the same overlapping cluster, not onto
 * the day as a whole — otherwise one busy Tuesday morning would squeeze a
 * lonely Tuesday evening class into a sliver for no reason.
 */
function assignLanes(spans: WeekSpan[]): void {
  const byDay = new Map<number, WeekSpan[]>();
  for (const s of spans) {
    const list = byDay.get(s.dayIndex);
    if (list) list.push(s);
    else byDay.set(s.dayIndex, [s]);
  }

  for (const list of byDay.values()) {
    list.sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);

    const laneEnds: number[] = [];
    // A cluster is a run of spans that overlaps something already open.
    let cluster: WeekSpan[] = [];
    let clusterEnd = -1;

    const closeCluster = () => {
      if (cluster.length === 0) return;
      const used = Math.max(...cluster.map((s) => s.lane)) + 1;
      for (const s of cluster) s.laneCount = used;
      cluster = [];
      laneEnds.length = 0;
    };

    for (const span of list) {
      if (span.startMinute >= clusterEnd) closeCluster();

      let lane = laneEnds.findIndex((end) => end <= span.startMinute);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(span.endMinute);
      } else {
        laneEnds[lane] = span.endMinute;
      }
      span.lane = lane;
      cluster.push(span);
      clusterEnd = Math.max(clusterEnd, span.endMinute);
    }
    closeCluster();
  }
}

/**
 * The hours the week is drawn across.
 *
 * Always rendering 00:00–24:00 spends two thirds of the screen on hours where
 * nothing has ever happened, which on a phone is the difference between a
 * readable week and a smear. The window is the real extent of the week, padded
 * by an hour each side and clamped to a sensible minimum so a week with one
 * 9am lecture does not render as a single fat bar.
 */
export function activeWindow(
  spans: { startMinute: number; endMinute: number }[]
): { startMinute: number; endMinute: number } {
  const DEFAULT = { startMinute: 7 * 60, endMinute: 22 * 60 };
  if (spans.length === 0) return DEFAULT;

  let min = Infinity;
  let max = -Infinity;
  for (const s of spans) {
    min = Math.min(min, s.startMinute);
    max = Math.max(max, s.endMinute);
  }

  let start = Math.max(0, Math.floor((min - 60) / 60) * 60);
  let end = Math.min(DAY_MINUTES, Math.ceil((max + 60) / 60) * 60);

  // Never narrower than six hours, or the bars stop reading as durations.
  const MIN_SPAN = 6 * 60;
  if (end - start < MIN_SPAN) {
    const grow = MIN_SPAN - (end - start);
    start = Math.max(0, start - Math.floor(grow / 2));
    end = Math.min(DAY_MINUTES, start + MIN_SPAN);
    if (end - start < MIN_SPAN) start = Math.max(0, end - MIN_SPAN);
  }
  return { startMinute: start, endMinute: end };
}

export interface WeekInput {
  weekStart: Date;
  now: Date;
  /** Timetabled things with a real start and end. */
  events: {
    id: string;
    title: string;
    type: string;
    startsAt: Date;
    endsAt: Date | null;
    subjectId: string | null;
  }[];
  /** Recurring weekly commitments, stored as weekday + minutes rather than dates. */
  commitments: {
    id: string;
    label: string | null;
    kind: string;
    weekday: number | null;
    startMinute: number;
    endMinute: number;
    subjectId: string | null;
  }[];
  tasks: {
    id: string;
    title: string;
    deadline: Date | null;
    estimatedMinutes: number | null;
    status: string;
    subjectId: string | null;
  }[];
  reviews: { id: string; scheduledDate: Date; status: string; subjectId: string | null }[];
  /** What to call a review on the timeline, in the reader's language. */
  reviewLabel: string;
}

/**
 * A timetable's own vocabulary, kept.
 *
 * A real nursing timetable has five session types — Lec, Clinical, TUT, Lab,
 * Activity — and three of them used to arrive here as OTHER and render as the
 * same grey block. Preparing for a tutorial is not preparing for a lecture, so
 * they do not get to look alike.
 */
function spanKindFor(type: string): SpanKind {
  switch (type) {
    case "CLINICAL":
      return "CLINICAL";
    case "TUTORIAL":
      return "TUTORIAL";
    case "LAB":
      return "LAB";
    case "ACTIVITY":
      return "ACTIVITY";
    default:
      return "CLASS";
  }
}

/** How long a timetabled thing runs when nobody recorded an end. */
const ASSUMED_EVENT_MINUTES = 60;

/** Statuses that mean the task is off the student's plate. */
const DONE_TASK = new Set(["COMPLETED", "CANCELLED"]);

export function buildWeekMap(input: WeekInput): WeekMap {
  const { weekStart, now } = input;
  const weekEndExclusive = new Date(weekStart);
  weekEndExclusive.setDate(weekEndExclusive.getDate() + 7);

  const allDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return { date, index, isToday: sameDay(date, now) };
  });

  const inWeek = (d: Date) => d >= weekStart && d < weekEndExclusive;

  const spans: WeekSpan[] = [];

  for (const e of input.events) {
    if (!inWeek(e.startsAt)) continue;
    const start = minuteOfDay(e.startsAt);
    const end = e.endsAt && e.endsAt > e.startsAt ? minuteOfDay(e.endsAt) : start + ASSUMED_EVENT_MINUTES;
    spans.push({
      id: `event:${e.id}`,
      kind: spanKindFor(e.type),
      title: e.title,
      dayIndex: dayIndexIn(e.startsAt, weekStart),
      startMinute: start,
      // A class that runs past midnight is clipped rather than wrapped: the
      // grid has seven columns and an event cannot be in two of them.
      endMinute: Math.min(DAY_MINUTES, Math.max(end, start + 15)),
      subjectId: e.subjectId,
      lane: 0,
      laneCount: 1,
    });
  }

  for (const c of input.commitments) {
    if (c.weekday === null || c.weekday < 0 || c.weekday > 6) continue;
    // `weekday` is 0 = Sunday, and the grid starts on Saturday.
    const dayIndex = (c.weekday + 1) % 7;
    if (c.endMinute <= c.startMinute) continue;
    spans.push({
      id: `commitment:${c.id}`,
      kind: "COMMITMENT",
      title: c.label ?? c.kind,
      dayIndex,
      startMinute: c.startMinute,
      endMinute: Math.min(DAY_MINUTES, c.endMinute),
      subjectId: c.subjectId,
      lane: 0,
      laneCount: 1,
    });
  }

  assignLanes(spans);

  const points: WeekPoint[] = [];
  const unplaced: UnplacedItem[] = [];

  for (const t of input.tasks) {
    if (DONE_TASK.has(t.status)) continue;
    if (!t.deadline) continue;
    const overdue = t.deadline < now;
    if (inWeek(t.deadline)) {
      points.push({
        id: `task:${t.id}`,
        kind: t.status === "EXAM" ? "EXAM" : "DEADLINE",
        title: t.title,
        dayIndex: dayIndexIn(t.deadline, weekStart),
        minute: minuteOfDay(t.deadline),
        subjectId: t.subjectId,
        overdue,
      });
    }
    // On the grid as a deadline AND in the tray as work: the line you cross is
    // not the hours it takes, and a student needs both facts.
    unplaced.push({
      id: `task:${t.id}`,
      title: t.title,
      minutes: t.estimatedMinutes,
      dueDayIndex: inWeek(t.deadline) ? dayIndexIn(t.deadline, weekStart) : null,
      overdue,
    });
  }

  // Reviews are counted per day, not drawn one by one: sixty-nine separate
  // marks is a smear, and "12 due" is the fact the student acts on.
  const reviewsByDay = new Map<number, { count: number; overdue: boolean; subjectId: string | null }>();
  for (const r of input.reviews) {
    if (r.status === "COMPLETED") continue;
    if (!inWeek(r.scheduledDate)) continue;
    const dayIndex = dayIndexIn(r.scheduledDate, weekStart);
    const seen = reviewsByDay.get(dayIndex);
    if (seen) {
      seen.count += 1;
      seen.overdue = seen.overdue || r.scheduledDate < now;
    } else {
      reviewsByDay.set(dayIndex, {
        count: 1,
        overdue: r.scheduledDate < now,
        subjectId: r.subjectId,
      });
    }
  }
  for (const [dayIndex, agg] of reviewsByDay) {
    points.push({
      id: `reviews:${dayIndex}`,
      kind: "REVIEW",
      title: `${agg.count} ${input.reviewLabel}`,
      dayIndex,
      // Reviews carry a date but never an hour, so they sit on the morning
      // line rather than pretending to a precision nobody recorded.
      minute: 8 * 60,
      subjectId: agg.subjectId,
      overdue: agg.overdue,
    });
  }

  points.sort((a, b) => a.dayIndex - b.dayIndex || a.minute - b.minute);
  unplaced.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return (a.dueDayIndex ?? 99) - (b.dueDayIndex ?? 99);
  });

  const nowInWeek = now >= weekStart && now < weekEndExclusive;

  // The teaching week runs Sunday to Thursday; the grid starts Saturday, so
  // indices 0 and 6 are the weekend. They are dropped unless something is
  // actually on them — a column that is always empty is width taken from the
  // five that are not.
  const WEEKEND = new Set([0, 6]);
  const busy = new Set<number>([
    ...spans.map((s) => s.dayIndex),
    ...points.map((p) => p.dayIndex),
  ]);
  const days = allDays.filter(
    (d) => !WEEKEND.has(d.index) || busy.has(d.index) || d.isToday
  );

  return {
    days,
    spans,
    points,
    now: nowInWeek ? { dayIndex: dayIndexIn(now, weekStart), minute: minuteOfDay(now) } : null,
    window: activeWindow(spans),
    unplaced,
    empty: spans.length === 0 && points.length === 0 && unplaced.length === 0,
  };
}
