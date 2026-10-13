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
  /**
   * The topics inside it, when it has been broken into any.
   *
   * WHY THE DOSE CARES. "Study lecture 2" is the sentence he has been avoiding
   * all week — it is thirty-three slides and no edge to start at. "Planning ·
   * Organizing · Assembling" is three things, and he can picture finishing
   * them. The planner still plans in lectures; this only changes what the row
   * SAYS, and what counts as having studied one.
   */
  topics: { done: number; total: number; next: string[] } | null;
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
        /* The breakdown and this student's progress through it, in the query
           that was already fetching the lectures rather than a second pass. */
        sections: {
          orderBy: { position: "asc" },
          select: {
            title: true,
            progress: { where: { userId }, select: { studiedAt: true }, take: 1 },
          },
        },
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

  /* Topic progress per lecture, computed once and used twice: to decide what
     counts as studied, and to name what is left on the row. */
  const topicsOf = new Map<string, { done: number; total: number; next: string[] }>();
  for (const l of lectureRows) {
    if (l.sections.length === 0) continue;
    const undone = l.sections.filter((x) => x.progress.length === 0);
    topicsOf.set(l.id, {
      done: l.sections.length - undone.length,
      total: l.sections.length,
      /* Three names, in the lecture's own order. Planning before Organizing
         before Controlling: the sections build on each other, and a dose that
         opens with Controlling is a dose he cannot do. */
      next: undone.slice(0, 3).map((x) => x.title),
    });
  }

  const lectures: PlannedLecture[] = lectureRows.map((l) => {
    const topics = topicsOf.get(l.id);
    return {
      id: l.id,
      title: l.title,
      subjectId: l.subjectId,
      date: l.date,
      /* A LECTURE WITH TOPICS IS STUDIED WHEN ITS TOPICS ARE, and its own
         status is ignored. The two can disagree — he can mark the lecture
         complete and have read three of twenty-one — and the finer record is
         the true one. Without topics, nothing changes: the status decides, as
         it always did. */
      studied: topics ? topics.done === topics.total : l.status === "COMPLETED",
    };
  });

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
    topics: topicsOf.get(l.id) ?? null,
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
