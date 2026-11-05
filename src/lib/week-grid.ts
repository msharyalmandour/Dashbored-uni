/**
 * The week, as a grid you can place a block on.
 *
 * ONLY THE ARITHMETIC IS HERE, because the arithmetic is what goes wrong. The
 * grid is 8:00 to 17:00 at 80px an hour, and every block on it is positioned
 * from two integers that came out of a timetable someone photographed. The
 * ways that breaks are all quiet: a block that starts before the grid does, a
 * block that runs past the end of it, a block an hour tall drawn two hours
 * tall because the minutes were divided by 60 twice. None of them throws and
 * all of them put a class in the wrong place on the one screen a student uses
 * to decide where to be.
 *
 * THE DAY STARTS AT 8 AND ENDS AT 17 — his real timetable's own bounds, which
 * run 08:00 to 16:50. The grid clamps rather than hides: a block outside the
 * window is drawn at the edge it fell off, because a class you cannot see is
 * worse than a class drawn slightly wrong.
 */

/** The window the grid draws, in minutes from midnight. */
export const GRID_START = 8 * 60;
export const GRID_END = 17 * 60;
export const HOUR_PX = 80;

/** Sunday through Thursday — the Saudi university week. */
export const WEEK_DAYS = [0, 1, 2, 3, 4] as const;

export interface Slot {
  id: string;
  subjectId: string;
  /** 0 = Sunday … 6 = Saturday, matching `Date.getDay()`. */
  weekday: number;
  startMinute: number;
  endMinute: number;
  kind: string;
}

export interface PlacedBlock extends Slot {
  /** Pixels from the top of the grid. */
  top: number;
  /** Pixel height. Never below one readable row. */
  height: number;
  /** True when the block was cut to fit the window. */
  clipped: boolean;
}

/**
 * Where a block sits, in pixels.
 *
 * A MINIMUM HEIGHT, because a 50-minute tutorial is 66px and a 10-minute one
 * would be 13px — too short for its own name, which is how a real slot ends
 * up looking like a divider line. 44 is the floor, the same floor every
 * touch target in this product has.
 */
export function place(slot: Slot): PlacedBlock {
  const rawStart = Math.min(Math.max(slot.startMinute, GRID_START), GRID_END);
  const rawEnd = Math.min(Math.max(slot.endMinute, rawStart), GRID_END);
  const clipped = slot.startMinute < GRID_START || slot.endMinute > GRID_END;
  const top = ((rawStart - GRID_START) / 60) * HOUR_PX;
  const height = Math.max(44, ((rawEnd - rawStart) / 60) * HOUR_PX);
  return { ...slot, top, height, clipped };
}

/** The grid's full height, so the hour rail and the columns agree. */
export function gridHeight(): number {
  return ((GRID_END - GRID_START) / 60) * HOUR_PX;
}

/** The hour labels down the side: 8, 9, … 17. */
export function hourMarks(): number[] {
  const out: number[] = [];
  for (let h = GRID_START / 60; h <= GRID_END / 60; h++) out.push(h);
  return out;
}

/**
 * Where the "now" line goes, or null when now is outside the window.
 *
 * NULL RATHER THAN A CLAMPED LINE. A marker pinned to the top of the grid at
 * 6am says "you are here" about a place the student is not, every morning,
 * for two hours. Outside the window the line is simply not drawn.
 */
export function nowOffset(now: Date): number | null {
  const minute = now.getHours() * 60 + now.getMinutes();
  if (minute < GRID_START || minute > GRID_END) return null;
  return ((minute - GRID_START) / 60) * HOUR_PX;
}

/** Is this the slot the student is sitting in right now? */
export function isNow(slot: Slot, now: Date): boolean {
  if (slot.weekday !== now.getDay()) return false;
  const minute = now.getHours() * 60 + now.getMinutes();
  return minute >= slot.startMinute && minute < slot.endMinute;
}

/**
 * Blocks that overlap, so two classes at the same hour can share the column.
 *
 * His NURC 411 Tuesday is two clinical blocks back to back, 08:00–12:50 and
 * 13:00–16:50 — those do NOT overlap and must not be split into columns. The
 * test is strict: they share the column only when one starts before the other
 * ends.
 */
export function laneOf(slot: Slot, others: Slot[]): { lane: number; lanes: number } {
  const sameDay = others.filter((o) => o.weekday === slot.weekday);
  const overlapping = sameDay.filter(
    (o) => o.startMinute < slot.endMinute && slot.startMinute < o.endMinute
  );
  if (overlapping.length <= 1) return { lane: 0, lanes: 1 };
  const ordered = [...overlapping].sort(
    (a, b) => a.startMinute - b.startMinute || a.id.localeCompare(b.id)
  );
  return { lane: Math.max(0, ordered.findIndex((o) => o.id === slot.id)), lanes: ordered.length };
}

/**
 * The server's moment, as a Date the client can measure against.
 *
 * THE SERVER OWNS WHAT DAY IT IS. The board is rendered on the server and
 * hands the client two numbers, a weekday and a minute. Rebuilding a Date
 * from the minute alone leaves `getDay()` reading the DEVICE's day, so
 * `isNow` and the lit column answer to two different clocks. They agree
 * almost always and disagree exactly when it matters: a phone in another
 * timezone, or any device within minutes of midnight, lights one column and
 * glows a block in another.
 *
 * `from` is the client's own now, passed in so this stays testable.
 */
export function serverMoment(weekday: number, minute: number, from: Date): Date {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + (((weekday - d.getDay()) % 7) + 7) % 7);
  d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return d;
}
