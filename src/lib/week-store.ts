/**
 * Everything the أسبوعي screen draws, read once.
 *
 * THE DATABASE IS THE TIMETABLE. `TimeCommitment` holds the recurring shape
 * of his week — eleven rows, Sunday to Thursday, 08:00 to 16:50 — and that is
 * what the grid draws. `ScheduleEvent` holds dated occurrences, and on this
 * account every one of them is in September; a grid built from those would be
 * an empty week.
 *
 * THE LINKS ARE DERIVED, NOT STORED. The reference asks for a `linked_items`
 * table joining many things to one slot. This account has no such table and
 * one is not invented here: a block's badges are the course's own work that
 * falls inside this week, which is a real relation already in the data. Where
 * that is not enough is written down at the bottom of this file rather than
 * guessed at.
 *
 * NO STRINGS COME OUT OF HERE. "الأحد", "متأخر", "٣ مهام" are the
 * dictionary's job. A store that formatted them would decide the locale.
 */

import { prisma } from "@/lib/prisma";
import { worldFor, type World } from "@/lib/world";
import { courseCode, nameWithoutCode } from "@/lib/course-code";
import { WEEK_DAYS, type Slot } from "@/lib/week-grid";

/** A task tied to a block, through its course. */
export interface WeekTask {
  id: string;
  title: string;
  type: string;
  deadline: Date;
  /** Whole days from today. Negative means it is already past due. */
  daysLeft: number;
  completion: number;
}

export interface WeekSlot extends Slot {
  /** The course's name with its code taken off — the block prints both. */
  name: string;
  /** "NURC 410", or null for a course whose name carries no code. */
  code: string | null;
  /** The same colour this course has on the موادي shelf. One course, one hue. */
  world: World;
  /** Work for this course falling inside the coming seven days. */
  tasks: WeekTask[];
  /** Lectures of this course that are not finished. */
  lecturesOpen: number;
  /** Lectures of this course broken into topics, so a block can offer one. */
  lecturesReady: number;
}

export interface WeekScreen {
  slots: WeekSlot[];
  /** Every open task due in the next seven days, soonest first. */
  dueThisWeek: WeekTask[];
  /** Days of the current month that carry an exam or a deadline. */
  marked: { day: number; exam: boolean }[];
  /** True when he has no timetable rows at all — the screen then asks. */
  empty: boolean;
}

/** Midnight at the start of today, local. Deadlines are compared by DAY. */
function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Whole days from today to a deadline, by calendar day.
 *
 * BY DAY, NOT BY HOUR. A task due tonight at 23:00, asked at 09:00, is due
 * TODAY — 0 — and `(deadline - now) / 86400000` floors that to 0 as well but
 * turns "due in fourteen hours" into 0 and "due in twenty-six hours" into 1,
 * which is right, while "due at 00:30 tonight" becomes 0 and should be 1. The
 * two dates are what he reads off a calendar, so the two dates decide.
 */
function daysUntil(deadline: Date, now: Date): number {
  const a = startOfDay(now).getTime();
  const b = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

export async function loadWeek(userId: string, now: Date): Promise<WeekScreen> {
  const today = startOfDay(now);
  const weekAhead = new Date(today.getTime() + 7 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [rows, openTasks, lectureRows, monthTasks] = await Promise.all([
    /* Only rows with a weekday. A commitment with a null weekday is a daily
       one — sleep, meals — and painting those across all five columns would
       bury the timetable under the thing it is drawn on top of. */
    prisma.timeCommitment.findMany({
      where: { userId, weekday: { in: [...WEEK_DAYS] } },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
      select: {
        id: true,
        kind: true,
        label: true,
        weekday: true,
        startMinute: true,
        endMinute: true,
        subjectId: true,
        subject: { select: { id: true, name: true, code: true, createdAt: true } },
      },
    }),
    prisma.task.findMany({
      where: { userId, status: { not: "COMPLETED" }, deadline: { lt: weekAhead } },
      orderBy: { deadline: "asc" },
      select: {
        id: true,
        title: true,
        type: true,
        deadline: true,
        completionPercentage: true,
        subjectId: true,
      },
    }),
    prisma.lecture.findMany({
      where: { subject: { userId } },
      select: { subjectId: true, status: true, sections: { select: { id: true }, take: 1 } },
    }),
    prisma.task.findMany({
      where: { userId, deadline: { gte: monthStart, lt: monthEnd } },
      select: { deadline: true, type: true },
    }),
  ]);

  /* Creation order decides which fallback world an un-named course gets, and
     `worldFor` takes that as a position. The timetable is ordered by weekday,
     so the position has to come from a separate ranking or two courses would
     swap colours depending on which day came first. */
  const order = new Map<string, number>();
  for (const id of [
    ...new Set(
      rows
        .filter((r) => r.subject)
        .sort((a, b) => a.subject!.createdAt.getTime() - b.subject!.createdAt.getTime())
        .map((r) => r.subject!.id)
    ),
  ].entries()) {
    order.set(id[1], id[0]);
  }

  const tasksOf = new Map<string, WeekTask[]>();
  const dueThisWeek: WeekTask[] = [];
  for (const t of openTasks) {
    const task: WeekTask = {
      id: t.id,
      title: t.title,
      type: t.type,
      deadline: t.deadline,
      daysLeft: daysUntil(t.deadline, now),
      completion: t.completionPercentage,
    };
    dueThisWeek.push(task);
    if (t.subjectId) tasksOf.set(t.subjectId, [...(tasksOf.get(t.subjectId) ?? []), task]);
  }

  const openOf = new Map<string, number>();
  const readyOf = new Map<string, number>();
  for (const l of lectureRows) {
    if (l.status !== "COMPLETED") openOf.set(l.subjectId, (openOf.get(l.subjectId) ?? 0) + 1);
    if (l.sections.length > 0) readyOf.set(l.subjectId, (readyOf.get(l.subjectId) ?? 0) + 1);
  }

  const marked = [
    ...new Map(
      monthTasks.map((t) => [
        t.deadline.getDate(),
        { day: t.deadline.getDate(), exam: t.type === "EXAM" || t.type === "QUIZ" },
      ])
    ).values(),
  ].sort((a, b) => a.day - b.day);

  const slots: WeekSlot[] = rows.map((r) => {
    const subject = r.subject;
    /* The label is what the importer wrote, and on this account it is the
       course's full name. It is the only name a block with no course row has,
       so it is the fallback rather than a dash. */
    const rawName = subject?.name ?? r.label ?? "";
    return {
      id: r.id,
      subjectId: subject?.id ?? r.id,
      weekday: r.weekday!,
      startMinute: r.startMinute,
      endMinute: r.endMinute,
      kind: r.kind,
      name: nameWithoutCode(rawName, subject?.code),
      code: courseCode(rawName, subject?.code),
      world: worldFor({ name: rawName, code: subject?.code }, order.get(subject?.id ?? "") ?? 0),
      tasks: subject ? (tasksOf.get(subject.id) ?? []) : [],
      lecturesOpen: subject ? (openOf.get(subject.id) ?? 0) : 0,
      lecturesReady: subject ? (readyOf.get(subject.id) ?? 0) : 0,
    };
  });

  return {
    slots,
    dueThisWeek,
    marked,
    empty: slots.length === 0,
  };
}

/**
 * WHERE THE DERIVED LINK IS NOT ENOUGH, written down rather than guessed:
 *
 * A badge on a block currently says "this course has work due this week". It
 * cannot say "bring the hospital bag to THIS Tuesday shift", or "this slide
 * deck belongs to Monday's lecture and not Wednesday's" — those are a link
 * between one item and one SLOT, and no column in this schema holds it.
 * `ScheduleEvent` comes closest, but each row carries at most one of
 * subjectId / lectureId / clinicalId / taskId, so it links one thing to one
 * occurrence, not several things to a recurring slot.
 *
 * Adding that means a new table. It is not added here: a schema change on a
 * database with his real term in it is his call, not mine.
 */
