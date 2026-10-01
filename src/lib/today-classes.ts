/**
 * What the student actually has on, on a given day.
 *
 * WHY THIS EXISTS. The day panel read `ScheduleEvent` and nothing else. That
 * table holds DATED occurrences, and the timetable importer wrote exactly one
 * week of them — the week it was run. Measured on the real account,
 * 2026-09-30:
 *
 *     ScheduleEvent rows            11, all between 10 and 16 September
 *     ScheduleEvent rows in future   0
 *     TimeCommitment rows           11, weekdays 0-4, the same eleven classes
 *     Semester                      5 Sep 2026 – 27 Jul 2027
 *
 * So his timetable was correct, recurring, and stored — and the screen whose
 * whole job is "what do I have today" had been blank for a fortnight, because
 * it was asking the one table that only ever described one week. Nothing was
 * missing. The question was put to the wrong source.
 *
 * TWO SOURCES, ON PURPOSE, and they mean different things:
 *
 *   TimeCommitment  the SHAPE of the week — every Wednesday, 08:00, Nursing
 *                   Leadership. This is what a university timetable IS, and
 *                   it stays true until the term ends.
 *   ScheduleEvent   a DATED occurrence — a one-off, a moved class, a deadline,
 *                   anything that happens once. It can carry a room, a lecture
 *                   link and a course colour, which a weekly shape cannot.
 *
 * A day is both: the week's shape, plus whatever is specifically dated onto
 * it. Reading only the first loses the exam on Tuesday; reading only the
 * second is the bug above.
 *
 * MINUTES ARE NAIVE LOCAL, both sides, deliberately consistent with the rest
 * of the app: `TimeCommitment.startMinute` is documented as minutes from local
 * midnight, and the importer stored 08:00 on the timetable as 08:00 on the
 * dated row. Neither is converted here. Introducing a conversion on one side
 * only would make the two disagree by three hours on this student's account,
 * which is worse than both being naive in the same way.
 *
 * Pure: rows in, a day out. No database, no clock — the date is an argument.
 */

import { segmentsOnWeekday, type CommitmentRow } from "@/lib/time-intelligence";

/** The kinds of commitment that are a CLASS rather than a fact of life. */
const TIMETABLE_KINDS = new Set(["UNIVERSITY", "CLINICAL"]);

export interface DatedRow {
  id: string;
  title: string;
  type: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  subjectName: string | null;
  subjectColor: string | null;
  lectureId: string | null;
}

export interface DayEntry {
  id: string;
  title: string;
  /** The ScheduleEventType-ish label the timeline colours by. */
  type: string;
  /** Minutes from local midnight. The timeline formats this itself. */
  startMinute: number;
  /** Null when the length is genuinely unknown — never a guessed hour. */
  minutes: number | null;
  location: string | null;
  subjectName: string | null;
  subjectColor: string | null;
  lectureId: string | null;
  /** Where this came from, so the UI can say "every week" if it wants to. */
  recurring: boolean;
}

/**
 * A weekly commitment's type, in the vocabulary the timeline already colours
 * by. `CommitmentKind` and `ScheduleEventType` are separate enums for good
 * reasons — one describes a life, the other a calendar — and this is the one
 * place they have to meet.
 */
function typeOfKind(kind: string): string {
  return kind === "CLINICAL" ? "CLINICAL" : "LECTURE";
}

/** Minutes from local midnight, from a naive-local timestamp. */
export function minuteOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Everything on this date, earliest first.
 *
 * DE-DUPLICATION IS NOT OPTIONAL. For the one week the importer dated, both
 * tables describe the same eleven classes — it wrote the shape AND that week's
 * occurrences. Without this the student would have seen every class twice for
 * that week and once for every other, which reads as a broken timetable rather
 * than as a bug in one query.
 *
 * The dated row wins, because it is the more specific claim: it knows the room
 * and the lecture it belongs to, and if a class was moved, the dated row is
 * the move. A recurring entry is suppressed when a dated one starts at the
 * same minute — the same class at a different hour is a different fact and
 * both should show, since one of them is the student's day being wrong.
 */
export function classesOn(
  recurring: CommitmentRow[],
  dated: DatedRow[],
  date: Date
): DayEntry[] {
  const weekday = date.getDay();

  const datedEntries: DayEntry[] = dated.map((e) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    startMinute: minuteOfDay(e.startsAt),
    minutes: e.endsAt
      ? Math.max(0, Math.round((e.endsAt.getTime() - e.startsAt.getTime()) / 60000))
      : null,
    location: e.location,
    subjectName: e.subjectName,
    subjectColor: e.subjectColor,
    lectureId: e.lectureId,
    recurring: false,
  }));

  const takenMinutes = new Set(datedEntries.map((e) => e.startMinute));

  const recurringEntries: DayEntry[] = recurring
    .filter((c) => TIMETABLE_KINDS.has(String(c.kind)))
    .flatMap((c) =>
      segmentsOnWeekday(c, weekday).map((seg) => ({
        id: `${c.id}:${seg.start}`,
        /* A commitment may have no label — `TimeCommitment.label` is optional
           because "the kind alone is often enough" for sleep or a commute. For
           a class it is not, and an unlabelled one is shown by its kind rather
           than as an empty row. */
        title: c.label ?? typeOfKind(String(c.kind)),
        type: typeOfKind(String(c.kind)),
        startMinute: seg.start,
        minutes: seg.end - seg.start,
        /* A weekly shape carries none of these. They are left null rather
           than borrowed from a dated row that might be a different class. */
        location: null,
        subjectName: null,
        subjectColor: null,
        lectureId: null,
        recurring: true,
      }))
    )
    .filter((e) => !takenMinutes.has(e.startMinute));

  return [...datedEntries, ...recurringEntries].sort((a, b) => a.startMinute - b.startMinute);
}

/**
 * The next thing today that has not started yet, or null.
 *
 * Strictly after `nowMinute`: a class that started ten minutes ago is not
 * "next", it is the thing the student is sitting in, and telling them to head
 * to a room they are already in is the kind of wrongness that costs trust in
 * everything else on the screen.
 */
export function nextUp(entries: DayEntry[], nowMinute: number): DayEntry | null {
  return entries.find((e) => e.startMinute > nowMinute) ?? null;
}
