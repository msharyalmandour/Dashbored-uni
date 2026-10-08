/**
 * WHICH WEEK OF THE SEMESTER A DAY FALLS IN.
 *
 * The product's own glossary says a lecture "belongs to ONE course + ONE week
 * number", and the Lecture table has no week column — it has `lectureNumber`,
 * which is a sequence (1, 2, 3) and not a week. On this account that sequence
 * is already unreliable: two different lectures are both numbered 5.
 *
 * SO THE WEEK IS DERIVED, NOT STORED, and that is a deliberate choice rather
 * than a shortcut:
 *
 *   - It is zero manual work. A stored column would be one more field for the
 *     student to fill in and keep true, in a product whose stated rule is that
 *     nothing should be manual.
 *   - It cannot drift. Correct a lecture's date and its week corrects itself;
 *     a stored number would quietly keep pointing at the old week.
 *   - It needs no migration and no backfill of eight existing rows.
 *
 * If a syllabus ever numbers its weeks differently from the calendar — a
 * reading week, a shifted start — the answer is an OPTIONAL override column
 * read in preference to this, not a replacement for it. That case does not
 * exist yet and building for it now would be building for nobody.
 *
 * THE WEEK BOUNDARY. Seven-day blocks counted from the semester's start date,
 * so week 1 is the week that contains the start. Measured on this account: the
 * semester begins Saturday 2026-09-05, which makes week 1 run Sat 5 → Fri 11,
 * and every teaching day of the Saudi week (Sunday to Thursday) lands inside
 * one block. Anchoring instead to a fixed weekday would put the first teaching
 * day — Sunday the 6th — in week 2, which is wrong in the one way a student
 * would immediately notice.
 */

/** Midnight, local. */
function dayOf(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Whole calendar days from `a` to `b`. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((dayOf(b).getTime() - dayOf(a).getTime()) / MS_PER_DAY);
}

/**
 * The 1-based week number of `date` within a semester starting `start`.
 *
 * Anything before the semester began counts as week 1 rather than as zero or a
 * negative: a lecture dated before the start is a data error (a mistyped year,
 * a file from last term), and burying it in "week -3" hides it. Week 1 is
 * where a student will look for it.
 */
export function weekOf(date: Date, start: Date): number {
  const offset = daysBetween(start, date);
  if (offset < 0) return 1;
  return Math.floor(offset / 7) + 1;
}

/** The first and last day of a given week, inclusive. */
export function weekRange(week: number, start: Date): { from: Date; to: Date } {
  const n = Math.max(1, Math.trunc(week));
  const from = dayOf(start);
  from.setDate(from.getDate() + (n - 1) * 7);
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  return { from, to };
}

/** The week containing `date`, for marking "this week" in a list. */
export function currentWeek(now: Date, start: Date): number {
  return weekOf(now, start);
}

export interface Weekly<T> {
  week: number;
  from: Date;
  to: Date;
  items: T[];
}

/**
 * Group anything dated into weeks, newest week first.
 *
 * Weeks with nothing in them are LEFT OUT. A semester runs to 47 weeks on this
 * account (5 Sep to 27 Jul) and eight lectures sit in four of them; printing
 * the other forty-three as empty headings is a scrollable record of absence,
 * and the student came to find a lecture.
 */
export function byWeek<T>(items: T[], dateOf: (item: T) => Date, start: Date): Weekly<T>[] {
  const buckets = new Map<number, T[]>();
  for (const item of items) {
    const week = weekOf(dateOf(item), start);
    const bucket = buckets.get(week);
    if (bucket) bucket.push(item);
    else buckets.set(week, [item]);
  }

  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([week, group]) => {
      const { from, to } = weekRange(week, start);
      return {
        week,
        from,
        to,
        /* Within a week, earliest first: a week is read forwards even though
           the weeks themselves are listed newest first. */
        items: [...group].sort((x, y) => dateOf(x).getTime() - dateOf(y).getTime()),
      };
    });
}
