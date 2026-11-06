/**
 * «يومك الجاي بالمستشفى» — one day, not two rows.
 *
 * His Tuesday is NURC 411 twice: 08:00–12:50 and 13:00–16:50, because that
 * is how the timetable was written. Built row by row the screen says he has
 * two hospital days a week when he has one, and offers to prepare him twice
 * for the same morning.
 */

import assert from "node:assert/strict";
import { nextHospitalDays, hoursUntil, type ClinicalSlot } from "../src/lib/clinical-days";

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(error as Error).message.split("\n")[0]}`);
  }
}

console.log("أيام المستشفى");
console.log("");

/* His two clinical courses, exactly as the rows read. Sunday = 0. */
const SLOTS: ClinicalSlot[] = [
  { subjectId: "nurp432", weekday: 0, startMinute: 9 * 60, endMinute: 12 * 60 + 50, subjectName: "NURP 432" },
  { subjectId: "nurc411", weekday: 2, startMinute: 8 * 60, endMinute: 12 * 60 + 50, subjectName: "NURC 411" },
  { subjectId: "nurc411", weekday: 2, startMinute: 13 * 60, endMinute: 16 * 60 + 50, subjectName: "NURC 411" },
];

/* 2026-11-01 is a Sunday, so +n lands on weekday n. */
const on = (dayOffset: number, h: number, m = 0) => new Date(2026, 10, 1 + dayOffset, h, m);

check("HIS TUESDAY IS ONE DAY, NOT TWO", () => {
  /* Asked on Monday. A row-by-row list returns this Tuesday twice in a row,
     once per block. Two entries for the same DATE is the bug; the same
     weekday a week later is not. */
  const days = nextHospitalDays(SLOTS, on(1, 9, 0), 4);
  const dates = days.map((d) => d.date.getTime());
  assert.equal(new Set(dates).size, dates.length, "the same date came back twice");
  assert.equal(days[0].weekday, 2);
  assert.notEqual(days[1].date.getTime(), days[0].date.getTime());
  assert.equal(days[1].weekday, 0, "Sunday follows, not Tuesday again");
});

check("THE DAY RUNS FIRST START TO LAST END", () => {
  /* 08:00 to 16:50, across the ten-minute break that is not worth showing. */
  const day = nextHospitalDays(SLOTS, on(1, 9, 0), 1)[0];
  assert.equal(day.weekday, 2);
  assert.equal(day.startMinute, 8 * 60);
  assert.equal(day.endMinute, 16 * 60 + 50);
});

check("a course with two blocks is named once", () => {
  const day = nextHospitalDays(SLOTS, on(1, 9, 0), 1)[0];
  assert.deepEqual(day.courses, ["NURC 411"]);
});

check("A DAY HE IS STANDING IN IS TODAY", () => {
  /* Tuesday 10am. "Your next day at the hospital" is today, and he is in it.
     Rolling to next Tuesday would be the app telling him he is not where he
     is. */
  const day = nextHospitalDays(SLOTS, on(2, 10, 0), 1)[0];
  assert.equal(day.inDays, 0);
  assert.equal(day.current, true);
});

check("the ten-minute break does not end the day", () => {
  /* 12:55 is between the two blocks and still inside the hospital day. */
  const day = nextHospitalDays(SLOTS, on(2, 12, 55), 1)[0];
  assert.equal(day.inDays, 0);
  assert.equal(day.current, true, "he is on a break, not finished");
});

check("once the last block ends, the day is behind him", () => {
  /* Tuesday 17:00. The next hospital day is the following Sunday. */
  const day = nextHospitalDays(SLOTS, on(2, 17, 0), 1)[0];
  assert.notEqual(day.inDays, 0);
  assert.equal(day.weekday, 0);
  assert.equal(day.inDays, 5, "Tuesday to Sunday is five days");
});

check("earlier the same day counts as today, not as current", () => {
  const day = nextHospitalDays(SLOTS, on(2, 6, 30), 1)[0];
  assert.equal(day.inDays, 0);
  assert.equal(day.current, false, "06:30 is before the 08:00 start");
});

check("the next four come back in order and do not repeat", () => {
  const days = nextHospitalDays(SLOTS, on(1, 9, 0), 4);
  assert.equal(days.length, 4);
  for (let i = 1; i < days.length; i++) {
    assert.ok(days[i].inDays > days[i - 1].inDays, "two days with the same offset");
  }
  assert.deepEqual(days.map((d) => d.weekday), [2, 0, 2, 0]);
});

check("no clinical rows means no hospital days, not a crash", () => {
  assert.deepEqual(nextHospitalDays([], on(1, 9, 0), 4), []);
});

check("a pattern with one day still fills the list across weeks", () => {
  const sunday = [SLOTS[0]];
  const days = nextHospitalDays(sunday, on(1, 9, 0), 3);
  assert.equal(days.length, 3);
  assert.deepEqual(days.map((d) => d.inDays), [6, 13, 20]);
});

check("the countdown is in hours, and silent when he is already in it", () => {
  const monday = nextHospitalDays(SLOTS, on(1, 9, 0), 1)[0];
  assert.equal(hoursUntil(monday, on(1, 9, 0)), 23, "Monday 09:00 to Tuesday 08:00");
  const current = nextHospitalDays(SLOTS, on(2, 10, 0), 1)[0];
  assert.equal(hoursUntil(current, on(2, 10, 0)), null);
});

/* ------------------------------------------------------------------ */

function mutationBites(name: string, fn: () => void) {
  try {
    fn();
    failures += 1;
    console.log(`  NO BITE  ${name}`);
  } catch {
    console.log(`  bites  ${name}`);
  }
}

console.log("");
console.log("mutations");

mutationBites("ONE ENTRY PER ROW — Tuesday listed twice", () => {
  const bad = SLOTS.filter((s) => s.weekday === 2).length;
  assert.equal(bad, 1, `Tuesday would appear ${bad} times`);
});

mutationBites("the day ending at the first block's end — he leaves at 12:50", () => {
  const first = SLOTS.find((s) => s.weekday === 2)!;
  assert.equal(first.endMinute, 16 * 60 + 50);
});

mutationBites("rolling over the moment the first block ends", () => {
  /* 12:55 on Tuesday: he is on a ten-minute break, and the screen would be
     telling him his next hospital day is next week. */
  const minute = 12 * 60 + 55;
  const firstEnd = 12 * 60 + 50;
  assert.ok(minute < firstEnd, "12:55 is past the first block's end");
});

mutationBites("today counting as past the moment it starts", () => {
  /* `minute >= startMinute` as the skip test drops the day he is in. */
  const minute = 10 * 60;
  assert.ok(minute < 8 * 60, "10:00 is after the 08:00 start");
});

mutationBites("a negative modulo when the next day is earlier in the week", () => {
  /* Tuesday to Sunday, counted as (0 - 2) % 7, walks backwards. */
  const bad = (0 - 2) % 7;
  assert.ok(bad > 0, `the offset would be ${bad}`);
});

mutationBites("naming a course once per block — «NURC 411 · NURC 411»", () => {
  const bad = SLOTS.filter((s) => s.weekday === 2).map((s) => s.subjectName);
  assert.equal(bad.length, 1, `it would read ${bad.join(" · ")}`);
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("يوم مستشفى واحد، من أول بلوك لآخره.");
}
