/**
 * The sheet's arithmetic: how much is answered, how long is left, what saved.
 *
 * ONLY THE PARTS THAT CAN BE WRONG WITHOUT THROWING. Three of them, and each
 * has put a wrong number in front of a student in some version of some app:
 *
 *  - "جاوبت 3 من 8" counted a field the student had typed in and cleared.
 *  - "يتسلّم بعد 2 يوم و57 س", because the hours were the whole remainder
 *    instead of the remainder after the days came out of it.
 *  - "سلّم" live on a sheet with no questions on it at all.
 */

export interface SheetAnswer {
  id: string;
  /** Null = never opened. "" = opened and cleared. The two are not the same. */
  answer: string | null;
  answeredAt: Date | null;
}

/**
 * Answered means there is something in it.
 *
 * WHITESPACE IS NOT AN ANSWER. A field holding a single space counts as
 * answered to `length > 0` and as blank to the student, and it is the student
 * who is right. Null and "" both count as unanswered — but they are kept
 * apart in the database, because `started` below needs to know which.
 */
export function isAnswered(q: SheetAnswer): boolean {
  return (q.answer ?? "").trim().length > 0;
}

/** Opened at some point, even if what was typed is gone again. */
export function isStarted(q: SheetAnswer): boolean {
  return q.answer !== null;
}

export function answeredCount(questions: SheetAnswer[]): number {
  return questions.filter(isAnswered).length;
}

/**
 * The 1-based number of the question to carry on with, or null when there is
 * none left.
 *
 * THE FIRST UNANSWERED ONE, NOT THE LAST TOUCHED. "كمّل السؤال 4" has to send
 * him to a gap; sending him to where he was last typing lands him on the one
 * he just finished.
 */
export function nextUnanswered(questions: SheetAnswer[]): number | null {
  const i = questions.findIndex((q) => !isAnswered(q));
  return i === -1 ? null : i + 1;
}

/**
 * Whether "سلّم" is the primary button yet.
 *
 * AN EMPTY SHEET CANNOT BE SUBMITTED. `every` on an empty array is true, so
 * the obvious one-liner lights the submit button on a sheet whose questions
 * failed to import — the one case where submitting is guaranteed wrong.
 */
export function canSubmit(questions: SheetAnswer[]): boolean {
  return questions.length > 0 && questions.every(isAnswered);
}

export interface TimeLeft {
  /** Whole days. Never negative — `late` carries the direction. */
  days: number;
  /** 0–23. The remainder AFTER the days, which is the whole point. */
  hours: number;
  /** True when the deadline has gone past. */
  late: boolean;
  /** True when there is under an hour in it, either side. */
  imminent: boolean;
}

/**
 * "بعد 2 يوم و9 س", from two timestamps.
 *
 * THE HOURS ARE THE REMAINDER. Dividing the whole gap by an hour gives 57 for
 * a two-day-and-nine-hour deadline, and "بعد 2 يوم و57 س" is a sentence that
 * reads as fine and is nonsense. The modulo is the fix and the guard pins it.
 *
 * ROUNDED DOWN, BOTH PARTS. A deadline 47 hours away is "يوم و23 س" and not
 * "2 يوم": telling a student he has two days when he has one is the error
 * that costs him the mark.
 */
export function timeLeft(deadline: Date, now: Date): TimeLeft {
  const ms = deadline.getTime() - now.getTime();
  const late = ms < 0;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  return { days, hours, late, imminent: abs < 3600000 };
}

/**
 * How long ago the last change was saved, in whole minutes.
 *
 * ZERO IS A REAL ANSWER and the screen says "انحفظ الحين" for it. Returning 1
 * so the sentence reads better would be the app telling him a minute passed
 * that did not. Null in, null out: nothing saved, nothing to say.
 */
export function savedMinutesAgo(answeredAt: Date | null, now: Date): number | null {
  if (!answeredAt) return null;
  const ms = now.getTime() - answeredAt.getTime();
  /* A clock that disagrees with the server by a few seconds must not produce
     "saved in 2 minutes". Anything in the future reads as just now. */
  if (ms < 0) return 0;
  return Math.floor(ms / 60000);
}

/**
 * The most recent save across the whole sheet.
 *
 * The line at the top of the paper is about the SHEET, so it takes the latest
 * of the questions and not the one that happens to be focused.
 */
export function lastSavedAt(questions: SheetAnswer[]): Date | null {
  let latest: Date | null = null;
  for (const q of questions) {
    if (q.answeredAt && (!latest || q.answeredAt > latest)) latest = q.answeredAt;
  }
  return latest;
}
