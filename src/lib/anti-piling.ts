/**
 * منع التراكم — THE ANTI-PILING RULE.
 *
 * The product's one promise is that the student never lets exams pile up.
 * This is the arithmetic behind it, and it is deliberately a pure function of
 * values rather than anything that touches the database: the plan is RECOMPUTED
 * from today every time it is asked for, and never stored.
 *
 * That is not an implementation detail, it is the rule about skipping. "If the
 * student skips a day, redistribute the remaining load" is free when nothing
 * was written down: tomorrow the same function runs with one fewer day and the
 * same un-studied lectures, and the doses simply get bigger. A stored plan
 * would have needed a reconciliation job, would drift the moment a lecture was
 * marked studied from another screen, and would have had to be invalidated
 * whenever an exam moved.
 *
 * WHAT COUNTS AS UN-STUDIED. `LectureStatus` has four values and only
 * COMPLETED means done:
 *
 *   NOT_STARTED    never opened
 *   IN_PROGRESS    opened, not finished
 *   NEEDS_REVIEW   read once and flagged as not solid
 *   COMPLETED      done
 *
 * NEEDS_REVIEW is the interesting one: the lecture HAS been read, so it is
 * tempting to call it finished. Before an exam it is not — the student
 * themselves marked it as not holding. It gets a dose.
 *
 * WHICH EXAM A LECTURE BELONGS TO. The earliest exam of its own course falling
 * on or after the lecture's date. Without that rule a lecture sitting before
 * two exams is planned twice and the student is told to study it twice.
 */

/** A lecture, as this file needs it. */
export interface PlannedLecture {
  id: string;
  title: string;
  subjectId: string;
  /** The day it was taught. */
  date: Date;
  /** COMPLETED. Anything else still needs a dose. */
  studied: boolean;
}

/** An exam, quiz or anything else the student has to be ready for by a date. */
export interface PlannedExam {
  id: string;
  title: string;
  subjectId: string;
  date: Date;
}

/** One day's work. */
export interface Dose {
  date: Date;
  lectures: PlannedLecture[];
  /** A hospital or lab day — deliberately given a lighter share. */
  light: boolean;
  /** More than a person can actually do. The screen must say so. */
  overloaded: boolean;
}

export interface ExamPlan {
  exam: PlannedExam;
  days: Dose[];
  /** Un-studied lectures this exam covers, however the days worked out. */
  remaining: number;
}

export interface Plan {
  plans: ExamPlan[];
  /**
   * Lectures that have been sitting un-studied for too long and belong to no
   * upcoming exam — the pile the product exists to prevent.
   */
  piling: PlannedLecture[];
}

/** How far ahead of an exam the plan starts. Rule 5. */
export const WINDOW_DAYS = 14;

/**
 * How long a lecture may sit un-studied before it is "متراكمة". Rule 5.
 * Counted from the day it was taught, not from the day it was added: the
 * student's backlog is measured against the course, not against their filing.
 */
export const PILING_AFTER_DAYS = 3;

/**
 * What one day can hold before the screen should warn.
 *
 * Three lectures. Not a guess dressed as a constant: this student's decks run
 * 13 to 51 pages, so three is already most of an evening, and the number
 * exists to make "the plan does not fit" VISIBLE rather than to silently let a
 * day hold nine. When a window is too short the doses still contain
 * everything — nothing is dropped — and every over-full day is flagged.
 */
export const MAX_PER_DAY = 3;

/**
 * A clinical day's share of a normal day's load.
 *
 * Rule 5 says to go lighter on rota days and does not say how much. A third:
 * enough that a hospital day visibly asks less, not so little that it asks
 * nothing and the day before an exam becomes impossible.
 */
export const CLINICAL_SHARE = 1 / 3;

/** Midnight, local. Day granularity is the only granularity here. */
export function dayOf(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole days from `a` to `b`, by calendar day rather than by elapsed time. */
export function daysBetween(a: Date, b: Date): number {
  const MS = 1000 * 60 * 60 * 24;
  return Math.round((dayOf(b).getTime() - dayOf(a).getTime()) / MS);
}

function addDays(date: Date, n: number): Date {
  const out = dayOf(date);
  out.setDate(out.getDate() + n);
  return out;
}

function sameDay(a: Date, b: Date): boolean {
  return dayOf(a).getTime() === dayOf(b).getTime();
}

/**
 * Hand every un-studied lecture to exactly one upcoming exam, and return the
 * ones no exam claims.
 *
 * Exported because the "which exam" rule is the part most likely to be got
 * wrong twice if two callers each implement it.
 */
export function assignToExams(
  lectures: PlannedLecture[],
  exams: PlannedExam[]
): { byExam: Map<string, PlannedLecture[]>; unclaimed: PlannedLecture[] } {
  const byExam = new Map<string, PlannedLecture[]>();
  const unclaimed: PlannedLecture[] = [];
  const sortedExams = [...exams].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const lecture of lectures) {
    if (lecture.studied) continue;
    const exam = sortedExams.find(
      (e) => e.subjectId === lecture.subjectId && daysBetween(lecture.date, e.date) >= 0
    );
    if (!exam) {
      unclaimed.push(lecture);
      continue;
    }
    const list = byExam.get(exam.id);
    if (list) list.push(lecture);
    else byExam.set(exam.id, [lecture]);
  }
  return { byExam, unclaimed };
}

/**
 * Spread `count` items over days whose capacities are `weights`, so that the
 * parts sum to exactly `count`.
 *
 * Largest remainder, because the obvious alternative is wrong in a way that is
 * easy to ship: rounding each day's share independently loses or invents work
 * (five lectures over three days rounds to 2+2+2 = six). Here the floors are
 * handed out first and the leftovers go to the days with the largest fractions,
 * so the total is exact by construction.
 */
export function share(count: number, weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (count <= 0 || weights.length === 0 || total <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (count * w) / total);
  const out = exact.map((value) => Math.floor(value));
  let left = count - out.reduce((sum, v) => sum + v, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let i = 0; left > 0; i = (i + 1) % order.length) {
    out[order[i].index] += 1;
    left -= 1;
  }
  return out;
}

/**
 * The whole plan, as of `today`.
 *
 * `clinicalDays` is the rota — the days the student is at the hospital, which
 * are read from the schedule rather than from the clinical log, because the
 * log records what happened and the schedule records what is coming.
 */
export function buildPlan({
  lectures,
  exams,
  clinicalDays,
  today,
}: {
  lectures: PlannedLecture[];
  exams: PlannedExam[];
  clinicalDays: Date[];
  today: Date;
}): Plan {
  const start = dayOf(today);
  /* An exam that has already happened cannot be prepared for. */
  const upcoming = exams.filter((e) => daysBetween(start, e.date) >= 0);
  const { byExam, unclaimed } = assignToExams(lectures, upcoming);

  const plans: ExamPlan[] = [];
  for (const exam of [...upcoming].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const mine = (byExam.get(exam.id) ?? []).sort((a, b) => a.date.getTime() - b.date.getTime());
    if (mine.length === 0) continue;

    /* The window: at most WINDOW_DAYS before the exam, never earlier than
       today, and never including the exam day itself — studying the morning of
       is not a plan. */
    const earliest = addDays(exam.date, -WINDOW_DAYS);
    const from = daysBetween(start, earliest) > 0 ? earliest : start;
    const lastStudyDay = addDays(exam.date, -1);
    const span = daysBetween(from, lastStudyDay) + 1;

    /* The exam is today or tomorrow: there is no window left. Everything lands
       on today and is flagged, because the honest answer is "this does not
       fit" and not an empty plan. */
    const days: Date[] =
      span <= 0
        ? [start]
        : Array.from({ length: span }, (_, i) => addDays(from, i));

    const weights = days.map((d) =>
      clinicalDays.some((c) => sameDay(c, d)) ? CLINICAL_SHARE : 1
    );
    const counts = share(mine.length, weights);

    let taken = 0;
    const doses: Dose[] = days.map((date, i) => {
      const slice = mine.slice(taken, taken + counts[i]);
      taken += counts[i];
      return {
        date,
        lectures: slice,
        light: weights[i] < 1,
        overloaded: slice.length > MAX_PER_DAY,
      };
    });

    plans.push({ exam, days: doses, remaining: mine.length });
  }

  /* The pile: un-studied, taught more than PILING_AFTER_DAYS ago, and claimed
     by no upcoming exam — so nothing else on the screen is going to mention
     it. A lecture inside an exam window is already being handled and is not
     "piling up", it is scheduled. */
  const piling = unclaimed
    .filter((l) => daysBetween(l.date, start) > PILING_AFTER_DAYS)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return { plans, piling };
}

/**
 * Everything the student is asked to study on one day, across every exam.
 *
 * Separate from `buildPlan` because the Today screen wants one list and the
 * plan is per exam: with two exams in the same fortnight, a day has a dose
 * from each, and a student told twice "today: 2 lectures" has been told
 * nothing about their day.
 */
export function doseOn(plan: Plan, date: Date): Dose {
  const lectures: PlannedLecture[] = [];
  let light = false;
  for (const examPlan of plan.plans) {
    for (const dose of examPlan.days) {
      if (!sameDay(dose.date, date)) continue;
      lectures.push(...dose.lectures);
      light = light || dose.light;
    }
  }
  return {
    date: dayOf(date),
    lectures,
    light,
    /* Judged on the DAY's total, not on one exam's share of it. Two exams each
       asking for two lectures is four lectures, and the warning has to come
       from the number the student actually faces. */
    overloaded: lectures.length > MAX_PER_DAY,
  };
}
