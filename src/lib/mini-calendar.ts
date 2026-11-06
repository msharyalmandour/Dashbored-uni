/**
 * The two-week strip in the home page's left column.
 *
 * THE WEEK STARTS ON SUNDAY. `Date.getDay()` returns 0 for Sunday and the
 * grid is drawn ح ن ث ر خ ج س, so the column index IS the weekday and no
 * rotation is needed — which is exactly the kind of thing that is true until
 * someone "fixes" it for a Monday-first locale and every date moves one
 * column. It is asserted rather than assumed.
 *
 * TWO WEEKS, NOT A MONTH. A 42-cell month grid in a 290px column is cells of
 * four-pixel type. The design draws the week he is in and the one after it,
 * which is the horizon a student actually plans across.
 *
 * DAYS FROM THE NEXT MONTH KEEP THEIR OWN NUMBER. A strip that runs 29, 30,
 * 1, 2 is correct and a strip that runs 29, 30, 31, 32 is a calendar nobody
 * can trust — so each cell carries its real date and whether it belongs to
 * the month in the heading.
 */

export interface CalendarCell {
  /** The day of the month, 1–31. */
  day: number;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** False for the days that spill in from the next or previous month. */
  inMonth: boolean;
  today: boolean;
  /** The real date, so a caller can mark it from its own data. */
  date: Date;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** The Sunday on or before `d`. */
export function weekStart(d: Date): Date {
  const s = startOfDay(d);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

/**
 * Fourteen cells: the week containing `now`, then the next.
 *
 * The month in the heading is the month `now` is in, even when the strip
 * runs into the next one — the heading says where he is, not where the last
 * cell landed.
 */
export function twoWeeks(now: Date): CalendarCell[] {
  const start = weekStart(now);
  const today = startOfDay(now).getTime();
  const month = now.getMonth();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 14; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    cells.push({
      day: date.getDate(),
      weekday: date.getDay(),
      inMonth: date.getMonth() === month,
      today: date.getTime() === today,
      date,
    });
  }
  return cells;
}
