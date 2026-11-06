/**
 * When he is next in the hospital, and for how long.
 *
 * HIS TUESDAY IS TWO BLOCKS AND ONE DAY. NURC 411 runs 08:00–12:50 and then
 * 13:00–16:50, two rows in `TimeCommitment` because that is how the
 * timetable was written. A list built row by row prints "الثلاثاء" twice and
 * tells him he has two hospital days a week when he has one — and the ten
 * minutes between them is a break, not a gap worth showing. A hospital day
 * is the span from the first block's start to the last block's end.
 *
 * A DAY HE IS CURRENTLY IN IS TODAY. "Your next day at the hospital" asked
 * at 10am on a Tuesday is today, not next Tuesday: he is standing in it. It
 * rolls over only once the last block has ENDED, which is the opposite rule
 * from `nextClass` — that one answers "what is coming up" about a lecture
 * he could still be walking to, and this one answers "where am I".
 */

export interface ClinicalSlot {
  subjectId: string | null;
  weekday: number;
  startMinute: number;
  endMinute: number;
  /** For the label. The course this block belongs to. */
  subjectName: string | null;
}

export interface HospitalDay {
  /** The dated occurrence. */
  date: Date;
  weekday: number;
  /** First block's start, last block's end — the whole day. */
  startMinute: number;
  endMinute: number;
  /** Whole days from today. 0 means he is in it or it is later today. */
  inDays: number;
  /** Every course with a block that day, in start order, without repeats. */
  courses: string[];
  /** True when the clock is inside the day's span right now. */
  current: boolean;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * The next `count` hospital days, soonest first.
 *
 * Built from the recurring weekly pattern, because that is what this account
 * holds: the three dated `ScheduleEvent` clinical rows are all in September.
 */
export function nextHospitalDays(
  slots: ClinicalSlot[],
  now: Date,
  count = 4
): HospitalDay[] {
  if (slots.length === 0) return [];

  /* One entry per weekday that has any clinical block, merged. */
  const byDay = new Map<number, ClinicalSlot[]>();
  for (const s of slots) {
    byDay.set(s.weekday, [...(byDay.get(s.weekday) ?? []), s]);
  }

  const minute = now.getHours() * 60 + now.getMinutes();
  const today = startOfDay(now);
  const out: HospitalDay[] = [];

  /* Walk forward a day at a time. Four weeks is far enough to find four days
     in any weekly pattern, and it terminates whatever the data says. */
  for (let offset = 0; offset < 28 && out.length < count; offset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    const blocks = byDay.get(date.getDay());
    if (!blocks) continue;

    const startMinute = Math.min(...blocks.map((b) => b.startMinute));
    const endMinute = Math.max(...blocks.map((b) => b.endMinute));

    /* Today only counts while the day has not finished. Once the last block
       has ended it is behind him and the next one is next week. */
    if (offset === 0 && minute >= endMinute) continue;

    const courses: string[] = [];
    for (const b of [...blocks].sort((a, z) => a.startMinute - z.startMinute)) {
      if (b.subjectName && !courses.includes(b.subjectName)) courses.push(b.subjectName);
    }

    out.push({
      date,
      weekday: date.getDay(),
      startMinute,
      endMinute,
      inDays: offset,
      courses,
      current: offset === 0 && minute >= startMinute && minute < endMinute,
    });
  }

  return out;
}

/**
 * Hours from now until a day starts, for "تجهّز، بكرا 8 الصبح".
 *
 * Null when he is already in it: a countdown to something he is standing in
 * is a countdown to nothing.
 */
export function hoursUntil(day: HospitalDay, now: Date): number | null {
  if (day.current) return null;
  const at = new Date(day.date);
  at.setHours(Math.floor(day.startMinute / 60), day.startMinute % 60, 0, 0);
  const ms = at.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.floor(ms / 3600000);
}
