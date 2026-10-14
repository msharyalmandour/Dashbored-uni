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

/**
 * "8 الصبح" — the hour the way he would say it.
 *
 * NOT "ص" AND "م". The approved cover writes "الإثنين · 8 الصبح", and that is
 * the same rule as everything else in VOICE.md: "8 ص" is how a timetable is
 * printed, "8 الصبح" is how a class is spoken about. The difference costs
 * nothing and is the whole point of the voice work.
 *
 * FOUR PARTS OF THE DAY RATHER THAN TWO, because collapsing them is what makes
 * it wrong. Carrying the am/pm split straight across would label a 7pm class
 * "7 العصر" and midnight "12 الصبح", both of which are the kind of small wrong
 * word that makes a student stop trusting the line. The boundaries are the
 * ordinary ones and they are pinned in scripts/verify-next-class.ts.
 */
function partOfDay(h24: number): string {
  if (h24 < 5) return "بالليل";
  if (h24 < 12) return "الصبح";
  if (h24 < 17) return "العصر";
  return "المسا";
}

export function clockOf(startMinute: number, locale: "ar" | "en"): string {
  const h24 = Math.floor(startMinute / 60) % 24;
  const m = startMinute % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = locale === "ar" ? partOfDay(h24) : h24 < 12 ? "am" : "pm";
  const mm = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  return `${h12}${mm} ${suffix}`;
}
