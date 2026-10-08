import { prisma } from "@/lib/prisma";
import { accentMap, DEFAULT_ACCENT } from "@/lib/subject-accent";
import { shortCourseName } from "@/lib/course-code";
import {
  buildPlan,
  doseOn,
  daysBetween,
  MAX_PER_DAY,
  type PlannedExam,
  type PlannedLecture,
} from "@/lib/anti-piling";

/**
 * Today's dose, read from the database and handed to the home screen.
 *
 * The arithmetic is in src/lib/anti-piling.ts and is a pure function of
 * values, so it can be tested against this student's real midterm without a
 * database. This file is only the part that cannot be: which rows feed it.
 *
 * THREE CHOICES ABOUT WHICH ROWS, each of which is a judgement:
 *
 *   ONLY EXAMS AND QUIZZES drive a dose. `Task` also holds assignments,
 *     projects, readings and presentations — eleven of this account's fifteen
 *     deadlines — and rule 5 is specific: it is an exam or a quiz that makes
 *     the lectures behind it urgent. An assignment has its own deadline and
 *     does not mean "revise the course".
 *
 *   THE ROTA COMES FROM `ScheduleEvent`, NOT FROM `ClinicalTraining`. Measured:
 *     ClinicalTraining holds 0 rows and its columns are `whatILearned`,
 *     `casesSeen`, `whatIDidNotUnderstand` — it is a journal of a day that has
 *     already happened. `ScheduleEvent` with type CLINICAL holds the days that
 *     are COMING, which is the only kind that can lighten a plan.
 *
 *   ONLY COMPLETED COUNTS AS STUDIED. NEEDS_REVIEW means the student read it
 *     and marked it as not holding; before an exam that still needs an evening.
 */

export interface DoseLecture {
  id: string;
  title: string;
  /** The code, not the title — see src/lib/course-code.ts for why. */
  courseName: string;
  accent: string;
  href: string;
}

export interface TodayDose {
  /** What to study today, across every exam at once. */
  lectures: DoseLecture[];
  /** A hospital day — the plan already asked less of it, and says so. */
  light: boolean;
  /** More than MAX_PER_DAY. The screen has to admit this rather than hide it. */
  overloaded: boolean;
  /** The exam driving the most of today's work, for the one-line reason. */
  reason: { title: string; daysLeft: number } | null;
  /** Un-studied, older than three days, and behind no upcoming exam. */
  piling: DoseLecture[];
}

export async function getTodayDose(userId: string, now: Date): Promise<TodayDose> {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [lectureRows, examRows, clinicalRows, subjects] = await Promise.all([
    prisma.lecture.findMany({
      where: { subject: { userId } },
      select: {
        id: true,
        title: true,
        date: true,
        status: true,
        subjectId: true,
        subject: { select: { name: true, code: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.task.findMany({
      where: {
        userId,
        type: { in: ["EXAM", "QUIZ"] },
        status: { not: "COMPLETED" },
        deadline: { gte: start },
        subjectId: { not: null },
      },
      select: { id: true, title: true, deadline: true, subjectId: true },
      orderBy: { deadline: "asc" },
    }),
    prisma.scheduleEvent.findMany({
      where: { userId, type: "CLINICAL", startsAt: { gte: start } },
      select: { startsAt: true },
    }),
    prisma.subject.findMany({
      where: { userId },
      select: { id: true, color: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const accents = accentMap(subjects);
  /* The SHORT name. The row's note column takes the width it asks for and the
     lecture title is what gets truncated, so a full course name on a phone
     turned "GAS EXCHANGE" into "GAS EXC…". */
  const courseName = new Map(
    lectureRows.map((l) => [l.subjectId, shortCourseName(l.subject.name, l.subject.code)])
  );

  const lectures: PlannedLecture[] = lectureRows.map((l) => ({
    id: l.id,
    title: l.title,
    subjectId: l.subjectId,
    date: l.date,
    studied: l.status === "COMPLETED",
  }));

  const exams: PlannedExam[] = examRows
    .filter((t): t is typeof t & { deadline: Date; subjectId: string } =>
      Boolean(t.deadline && t.subjectId)
    )
    .map((t) => ({ id: t.id, title: t.title, subjectId: t.subjectId, date: t.deadline }));

  const plan = buildPlan({
    lectures,
    exams,
    clinicalDays: clinicalRows.map((c) => c.startsAt),
    today: start,
  });
  const dose = doseOn(plan, start);

  const decorate = (l: PlannedLecture): DoseLecture => ({
    id: l.id,
    title: l.title,
    courseName: courseName.get(l.subjectId) ?? "",
    accent: accents.get(l.subjectId) ?? DEFAULT_ACCENT,
    href: `/lectures/${l.id}`,
  });

  /* Which exam to name. The one contributing the most of today's work, and the
     soonest when two contribute equally — a student told "2 lectures today"
     deserves to know what for, and naming the wrong exam is worse than naming
     none. */
  let reason: TodayDose["reason"] = null;
  let best = 0;
  for (const examPlan of plan.plans) {
    const mine = examPlan.days
      .filter((day) => daysBetween(day.date, start) === 0)
      .reduce((sum, day) => sum + day.lectures.length, 0);
    if (mine > best) {
      best = mine;
      reason = { title: examPlan.exam.title, daysLeft: daysBetween(start, examPlan.exam.date) };
    }
  }

  return {
    lectures: dose.lectures.map(decorate),
    light: dose.light,
    overloaded: dose.lectures.length > MAX_PER_DAY,
    reason,
    piling: plan.piling.map(decorate),
  };
}
