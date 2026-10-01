/**
 * The exam you have, and the pages you have not read for it.
 *
 * WHY THIS EXISTS. On 2026-10-01 this student had a midterm in eleven days
 * and ninety-two unread pages in the course it covers:
 *
 *     Midterm — Critical Care Nursing (NURC 410)   12 Oct, 11 days away
 *     mechanical ventilation    51 pages, read to 1    50 unread
 *     Cardiovascular system     42 pages, read to 0    42 unread
 *     GAS EXCHANGE               1 page,  read to 1     0 unread
 *
 * All three facts were already in the database — the date on a Task, the page
 * counts on LectureSlide, the position in StudyPosition. They had never been
 * put in one sentence. The app knew, and did not say.
 *
 * WHEN IT SPEAKS, and this is the part worth arguing over. A band that is
 * always there is wallpaper, and the inbox queue this app just deleted is
 * what wallpaper becomes. So there is a threshold — and it is not a number
 * somebody picked.
 *
 * It speaks when a page a day is no longer enough: when the unread pages
 * outnumber the days left. Ninety-two pages in eleven days passes; the same
 * ninety-two pages in two hundred does not, because then there is nothing to
 * say that the student does not already know. The threshold is the sentence
 * itself, which is why it needs no constant.
 *
 * WHAT IT REFUSES TO SAY. Not hours. Converting pages to time needs a reading
 * speed, and three recorded positions is not a reading speed — see
 * MIN_OBSERVATIONS in patterns.ts for the rule this follows. Pages per day is
 * arithmetic on two numbers that are both real, and it is the figure a student
 * reasons with anyway.
 *
 * Pure: rows in, a verdict out. No database, no clock — today is an argument.
 */

export interface ExamRow {
  id: string;
  title: string;
  /** The course it covers, as the student sees it written. */
  courseName: string | null;
  deadline: Date;
}

export interface UnreadLecture {
  lectureId: string;
  title: string;
  /** Pages in the deck. Zero means there is nothing to read yet. */
  pages: number;
  /** How far they have been. Never decreases — see study-position.ts. */
  furthestPage: number;
}

export interface ExamCall {
  kind: "CALL";
  examTitle: string;
  courseName: string | null;
  daysAway: number;
  unreadPages: number;
  /** Unread pages divided by days left, rounded up. Never below one. */
  pagesPerDay: number;
  /** Where to start, and why that one — see `startWith` below. */
  startLectureId: string;
  startLectureTitle: string;
  startUnread: number;
}

/** Nothing worth saying: no exam, nothing unread, or a page a day still does. */
export interface ExamQuiet {
  kind: "QUIET";
}

export type ExamReadiness = ExamCall | ExamQuiet;

/** Pages of this lecture the student has not been past. */
export function unreadOf(l: UnreadLecture): number {
  if (l.pages <= 0) return 0;
  /* `furthestPage` can exceed `pages` when a count was corrected downward, and
     a negative remainder would subtract from the course total. */
  return Math.max(0, l.pages - Math.max(0, l.furthestPage));
}

/**
 * Whole days from `now` to `deadline`, never negative.
 *
 * Rounded UP, so an exam in twenty-six hours is "2 days" rather than "1".
 * Rounding down would quietly promise a day that does not exist.
 */
export function daysUntil(deadline: Date, now: Date): number {
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

/**
 * Which lecture to open first.
 *
 * A lecture already started comes before one never opened, even when the
 * untouched one is longer. Finishing something you are inside of is cheaper
 * than starting something you are not, and on this account the difference is
 * real: mechanical ventilation is open at page 1 of 51 while Cardiovascular
 * system has never been opened at all. Within each group, the most unread
 * pages first — that is where the time is.
 */
export function startWith(lectures: UnreadLecture[]): UnreadLecture | null {
  const withWork = lectures.filter((l) => unreadOf(l) > 0);
  if (withWork.length === 0) return null;

  return withWork.reduce((best, l) => {
    const started = (x: UnreadLecture) => x.furthestPage > 0;
    if (started(l) !== started(best)) return started(l) ? l : best;
    return unreadOf(l) > unreadOf(best) ? l : best;
  });
}

/**
 * The nearest exam that still has reading behind it.
 *
 * An exam already past is not a call to action, and an exam whose material is
 * read is not either — the student who finished the reading does not need a
 * band telling them the date.
 */
export function examReadiness(
  exams: ExamRow[],
  lecturesByCourse: Map<string, UnreadLecture[]>,
  now: Date
): ExamReadiness {
  const upcoming = exams
    .filter((e) => e.deadline.getTime() > now.getTime())
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

  for (const exam of upcoming) {
    const lectures = (exam.courseName && lecturesByCourse.get(exam.courseName)) || [];
    const unreadPages = lectures.reduce((n, l) => n + unreadOf(l), 0);
    if (unreadPages === 0) continue;

    const daysAway = daysUntil(exam.deadline, now);
    /* The threshold, and the whole reason this is not wallpaper: while a page
       a day would still get there, the student knows more about their own
       week than this band does. */
    if (unreadPages <= daysAway) continue;

    const start = startWith(lectures);
    if (!start) continue;

    return {
      kind: "CALL",
      examTitle: exam.title,
      courseName: exam.courseName,
      daysAway,
      unreadPages,
      pagesPerDay: Math.max(1, Math.ceil(unreadPages / Math.max(1, daysAway))),
      startLectureId: start.lectureId,
      startLectureTitle: start.title,
      startUnread: unreadOf(start),
    };
  }

  return { kind: "QUIET" };
}
