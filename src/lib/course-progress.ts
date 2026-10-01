/**
 * How far through a course the student actually is.
 *
 * WHY THIS IS NOT `completed lectures / lectures`. That is the obvious
 * definition and the measurement kills it. `Lecture.status` is set by one
 * manual control on the lecture page, and on the real account it reads:
 *
 *     NURC (410)  4 lectures  0 COMPLETED
 *     NURP (431)  2 lectures  0 COMPLETED
 *     four other courses      no lectures at all
 *
 * Every course would show 0%. Six rings at zero, on an account holding
 * thirty-seven documents, forty-two cards and four slide decks — so the number
 * would not merely be uninformative, it would be FALSE. What it measures is
 * whether this student ticks boxes, and he does not. Nobody does.
 *
 * WHAT THE APP ALREADY KNOWS. `StudyPosition` is written automatically as the
 * student reads, and `completedAt` is stamped when they reach the end of a
 * deck. On the same account, the same day:
 *
 *     GAS EXCHANGE           read to the end
 *     mechanical ventilation read to the end
 *     Cardiovascular system  never opened
 *     Revascular system      no material to open
 *
 * He read two of them. The manual flag says zero. The automatic record is
 * right and the flag is wrong, so this reads the record — and keeps the flag
 * as a second way to be done, because a student who ticks the box has told us
 * something and should be believed.
 *
 * Pure: counts in, a verdict out. No database, no clock.
 */

export interface LectureEvidence {
  /** Slide decks attached. Zero means there is nothing to read yet. */
  decks: number;
  /** Decks this student reached the end of — written by the app, not typed. */
  decksFinished: number;
  /** The manual flag on the lecture page. True only if they ticked it. */
  markedComplete: boolean;
}

/**
 * How many measurable lectures a course needs before a percentage is honest.
 *
 * Four, matching MIN_OBSERVATIONS in patterns.ts, and for the same reason: a
 * percentage over one item is a boolean wearing a percent sign, and over two
 * it moves in fifty-point steps. The reference design shows "72%", "45%",
 * "38%" — numbers that imply a precision three lectures cannot support, and
 * printing them anyway is how an interface starts lying quietly.
 *
 * Below this the fraction is shown instead. "2 of 3" is the same fact without
 * the false decimal, and it is the number the student can check against their
 * own folder.
 */
export const MIN_FOR_PERCENT = 4;

export type CourseProgress =
  /** Enough lectures to divide: a percentage, and the fraction behind it. */
  | { kind: "PERCENT"; done: number; total: number; percent: number }
  /** Real but too few to be a percentage. */
  | { kind: "FRACTION"; done: number; total: number }
  /**
   * Nothing to measure. NOT zero.
   *
   * A course with no material is not a course the student is behind on — it is
   * a course nothing has been dropped into yet, which is a different sentence
   * and a different fix. Rendering 0% for it would put six failures on a
   * screen where four of them are empty folders.
   */
  | { kind: "EMPTY" };

/** Whether the app has evidence this lecture was actually worked through. */
export function lectureDone(l: LectureEvidence): boolean {
  if (l.markedComplete) return true;
  /* Every deck finished, and at least one to finish. `decksFinished >= decks`
     with decks at zero would call an empty lecture done — vacuously true, and
     the single easiest way for this whole function to start inflating. */
  return l.decks > 0 && l.decksFinished >= l.decks;
}

/**
 * A lecture with no material is left out of the denominator entirely.
 *
 * Counting it would tell the student they are behind on something they cannot
 * do: there is no file to open. What is actually wrong with it — a lecture
 * with nothing attached — is a different problem with a different prompt, and
 * `loose-ends` already reports it. Keeping the two apart is what stops one
 * number from meaning two things.
 */
export function courseProgress(lectures: LectureEvidence[]): CourseProgress {
  const measurable = lectures.filter((l) => l.decks > 0 || l.markedComplete);
  const total = measurable.length;
  if (total === 0) return { kind: "EMPTY" };

  const done = measurable.filter(lectureDone).length;
  if (total < MIN_FOR_PERCENT) return { kind: "FRACTION", done, total };

  /* Rounded, and rounding is a decision in one direction: 99.6% must not
     print as 100%, because "finished" is a claim the student will check. Floor
     everything except an exact whole. */
  const raw = (done / total) * 100;
  const percent = done === total ? 100 : Math.floor(raw);
  return { kind: "PERCENT", done, total, percent };
}

/**
 * The fraction to fill a bar with, for any verdict.
 *
 * Separate from the label because a bar can be drawn honestly at n=1 — "one of
 * two, half filled" is true — while the *number* "50%" over two items is the
 * thing that overstates. So the bar always draws and only the label is
 * withheld.
 */
export function progressFraction(p: CourseProgress): number {
  if (p.kind === "EMPTY") return 0;
  return p.total === 0 ? 0 : p.done / p.total;
}
