/**
 * Everything the موادي screen draws, read once.
 *
 * Reads only. The judgements that can be tested without a database live in
 * src/lib/mawad.ts, src/lib/next-class.ts and src/lib/exam-weight.ts with
 * their own guards; this is the part that is only ever "which rows".
 *
 * NO STRINGS COME OUT OF HERE. The covers say "الأحد 9 ص · تدريب سريري" and
 * the header says "1448هـ", and both of those are the dictionary's job —
 * a store that formatted them would have to know the locale, and the screen
 * would then have two places that decide what a Sunday is called.
 */

import { prisma } from "@/lib/prisma";
import { worldFor, type World } from "@/lib/world";
import { courseCode, nameWithoutCode } from "@/lib/course-code";
import { nextClass, type NextClass, type WeeklySlot } from "@/lib/next-class";
import { weightFromTitle } from "@/lib/exam-weight";
import { hijriYear, termProgress } from "@/lib/mawad";
import { daysBetween } from "@/lib/utils";

export interface MawadCourse {
  id: string;
  /** The name with its own code taken out — the cover prints the code itself. */
  name: string;
  /** "NURC 410", or null when the name carries no code. */
  code: string | null;
  world: World;
  /** The soonest class, or null when this course has no timetable rows. */
  next: NextClass | null;
  /**
   * True when any of this course's timetable rows is a hospital one.
   *
   * ANY, not the majority and not the next one: NURC 411 has two clinical
   * blocks and two university ones, and it is the clinical course — a shift
   * is the thing you plan a week around. The board labels it سريري.
   */
  clinical: boolean | null;
  /** Lectures with a topic breakdown. 0 means the cover says nothing. */
  lecturesReady: number;
  /** The weight of this course's nearest exam, 0-100, when its title says. */
  examWeight: number | null;
}

export interface MawadTerm {
  id: string;
  name: string;
  /** "1448", derived from the term's own start date. Null if that is unusable. */
  hijri: string | null;
  status: "ACTIVE" | "COMPLETED" | "UPCOMING" | string;
  startDate: Date;
  endDate: Date;
  courses: MawadCourse[];
}

export interface MawadNearest {
  id: string;
  title: string;
  courseCode: string | null;
  date: Date;
  /** Whole days from today, by DAY — an exam tomorrow at 08:00 is 1, not 0. */
  daysLeft: number;
  /** 0–100 read out of the title, or null when the title does not say. */
  weight: number | null;
  /** How much of the exam's own term has gone, 0..1, or null. */
  termProgress: number | null;
}

export interface MawadScreen {
  terms: MawadTerm[];
  nearest: MawadNearest | null;
}

/** The `kind` column doubles as the word under the course name. */
function slotsOf(
  rows: { subjectId: string | null; weekday: number | null; startMinute: number; kind: string }[]
): WeeklySlot[] {
  return rows.flatMap((r) =>
    /* A commitment with no weekday is a daily one — sleep, meals. Those are
       never a class, and "every day at 9" under a course name would be a
       timetable nobody has. */
    r.subjectId && r.weekday !== null
      ? [{ subjectId: r.subjectId, weekday: r.weekday, startMinute: r.startMinute, label: r.kind }]
      : []
  );
}

export async function loadMawad(userId: string, now: Date): Promise<MawadScreen> {
  const [semesters, slotRows, readyRows, courseExams, exam] = await Promise.all([
    prisma.semester.findMany({
      where: { userId },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      include: {
        subjects: {
          /* Creation order, because `worldFor` falls back to position for a
             course whose code it does not know by name. Any other ordering
             would repaint half the shelf the moment a course is renamed. */
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, code: true },
        },
      },
    }),
    prisma.timeCommitment.findMany({
      where: { userId, subjectId: { not: null } },
      select: { subjectId: true, weekday: true, startMinute: true, kind: true },
    }),
    /* One row per lecture that has a breakdown, not a count per lecture: the
       cover says how many lectures are ready, and a lecture with 21 sections
       is one ready lecture, not 21. */
    prisma.lecture.findMany({
      where: { subject: { userId }, sections: { some: {} } },
      select: { subjectId: true },
    }),
    /* Every exam still ahead, soonest first. One query rather than one per
       course: six courses is six round trips to Tokyo, and the covers all
       render in the same frame. */
    prisma.task.findMany({
      where: {
        userId,
        subjectId: { not: null },
        type: { in: ["EXAM", "QUIZ"] },
        status: { not: "COMPLETED" },
        deadline: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
      },
      orderBy: { deadline: "asc" },
      select: { subjectId: true, title: true },
    }),
    prisma.task.findFirst({
      where: {
        userId,
        type: { in: ["EXAM", "QUIZ"] },
        status: { not: "COMPLETED" },
        /* From the START of today, so an exam dated today is still ahead of
           him at 9am rather than disappearing at midnight. */
        deadline: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
      },
      orderBy: { deadline: "asc" },
      select: {
        id: true,
        title: true,
        deadline: true,
        subject: {
          select: {
            name: true,
            code: true,
            semester: { select: { startDate: true, endDate: true } },
          },
        },
      },
    }),
  ]);

  const slots = slotsOf(slotRows);

  const ready = new Map<string, number>();
  for (const row of readyRows) {
    if (row.subjectId) ready.set(row.subjectId, (ready.get(row.subjectId) ?? 0) + 1);
  }

  /* First row per course wins, because the list is already sorted by date. */
  const weightOf = new Map<string, number | null>();
  for (const t of courseExams) {
    if (t.subjectId && !weightOf.has(t.subjectId)) {
      weightOf.set(t.subjectId, weightFromTitle(t.title));
    }
  }

  /* Which courses have a hospital block, and which have any timetable row at
     all — the second is what separates "نظري" from "we do not know". */
  const anySlot = new Set<string>();
  const clinical = new Set<string>();
  for (const slot of slots) {
    anySlot.add(slot.subjectId);
    if (slot.label === "CLINICAL") clinical.add(slot.subjectId);
  }

  const terms: MawadTerm[] = semesters.map((semester) => ({
    id: semester.id,
    name: semester.name,
    hijri: hijriYear(semester.startDate),
    status: semester.status,
    startDate: semester.startDate,
    endDate: semester.endDate,
    courses: semester.subjects.map((subject, position) => ({
      id: subject.id,
      name: nameWithoutCode(subject.name, subject.code),
      code: courseCode(subject.name, subject.code),
      world: worldFor(subject, position),
      next: nextClass(slots, now, subject.id),
      clinical: anySlot.has(subject.id) ? clinical.has(subject.id) : null,
      lecturesReady: ready.get(subject.id) ?? 0,
      examWeight: weightOf.get(subject.id) ?? null,
    })),
  }));

  const nearest: MawadNearest | null =
    exam?.deadline != null
      ? {
          id: exam.id,
          title: exam.title,
          courseCode: exam.subject ? courseCode(exam.subject.name, exam.subject.code) : null,
          date: exam.deadline,
          daysLeft: daysBetween(now, exam.deadline),
          weight: weightFromTitle(exam.title),
          termProgress: exam.subject?.semester
            ? termProgress(
                exam.subject.semester.startDate,
                exam.subject.semester.endDate,
                now
              )
            : null,
        }
      : null;

  return { terms, nearest };
}
