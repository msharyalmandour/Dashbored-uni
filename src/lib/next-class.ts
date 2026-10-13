/**
 * When a course next meets.
 *
 * The line under a course cover on the approved design: "الإثنين 8 ص · نظري".
 * It comes from the timetable, and the handoff is explicit that it must — a
 * fixed string there is a class a student plans his evening around and then
 * misses.
 *
 * THE ARITHMETIC IS THE WHOLE RISK. A weekly slot is a weekday plus a minute,
 * and "next" has to mean next: a Monday 08:00 class is NOT today's answer at
 * Monday 09:00, it is next Monday's. Getting that backwards shows a class in
 * the past as if it were coming, which is the one thing this line must never
 * do. It is pure so the rollover can be tested at every boundary.
 */

export interface WeeklySlot {
  subjectId: string;
  /** 0 = Sunday … 6 = Saturday, matching `Date.getDay()`. */
  weekday: number;
  /** Minutes from local midnight, 0–1439. */
  startMinute: number;
  /** "نظري", "سريري" — whatever the timetable calls it. Optional. */
  label?: string | null;
}

export interface NextClass {
  /** 0–6 days away. 0 is later today. */
  inDays: number;
  weekday: number;
  startMinute: number;
  label?: string | null;
}

/**
 * The soonest upcoming occurrence of any of `slots`, from `now`.
 *
 * Returns null when the course has no slots at all, which is the common case
 * on this account: three of six courses have a timetable and three do not, and
 * the cover shows nothing rather than a guess.
 */
export function nextClass(
  slots: WeeklySlot[],
  now: Date,
  subjectId: string
): NextClass | null {
  const mine = slots.filter((s) => s.subjectId === subjectId);
  if (mine.length === 0) return null;

  const today = now.getDay();
  const minuteNow = now.getHours() * 60 + now.getMinutes();

  let best: { key: number; slot: WeeklySlot; inDays: number } | null = null;

  for (const slot of mine) {
    if (!Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6) continue;
    if (!Number.isFinite(slot.startMinute)) continue;

    /* Days until that weekday comes round. 0 means today — and today only
       counts if the class has not already started. A class at 08:00 asked
       about at 09:00 is next week's, not this morning's. */
    let inDays = (slot.weekday - today + 7) % 7;
    if (inDays === 0 && slot.startMinute <= minuteNow) inDays = 7;

    /* Sorted by the actual moment, not by weekday: Sunday 20:00 and Monday
       09:00 are one and two days out, and comparing weekday numbers alone
       puts Sunday after Saturday. */
    const key = inDays * 1440 + slot.startMinute;
    if (!best || key < best.key) best = { key, slot, inDays };
  }

  if (!best) return null;
  return {
    inDays: best.inDays,
    weekday: best.slot.weekday,
    startMinute: best.slot.startMinute,
    label: best.slot.label ?? null,
  };
}

/** "8:00 ص" — the hour a student reads, not a 24-hour clock. */
export function clockOf(startMinute: number, locale: "ar" | "en"): string {
  const h24 = Math.floor(startMinute / 60) % 24;
  const m = startMinute % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = locale === "ar" ? (h24 < 12 ? "ص" : "م") : h24 < 12 ? "am" : "pm";
  const mm = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  return `${h12}${mm} ${suffix}`;
}
