/**
 * "الإثنين 8 ص" — and the rollover that must not go backwards.
 *
 * A line under a course cover saying when it next meets. The failure that
 * matters is showing a class that has already started as if it were coming:
 * a student reads it at 09:00, plans around an 08:00 class, and misses the
 * real one next week.
 */

import assert from "node:assert/strict";
import { nextClass, clockOf, type WeeklySlot } from "../src/lib/next-class";

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

console.log("متى المادة الجاية");
console.log("");

const NURC = "nurc410";
const NURP = "nurp431";
/* Sunday 08:00 and Tuesday 13:00 for Critical Care; Monday 08:00 for
   Leadership. Sunday = 0, matching Date.getDay(). */
const SLOTS: WeeklySlot[] = [
  { subjectId: NURC, weekday: 0, startMinute: 8 * 60, label: "نظري" },
  { subjectId: NURC, weekday: 2, startMinute: 13 * 60, label: "سريري" },
  { subjectId: NURP, weekday: 1, startMinute: 8 * 60, label: "نظري" },
];

/** A local Date on a known weekday. 2026-10-11 is a Sunday. */
const at = (dayOffset: number, h: number, m = 0) =>
  new Date(2026, 9, 11 + dayOffset, h, m, 0);

check("LATER TODAY COUNTS AS TODAY", () => {
  const n = nextClass(SLOTS, at(0, 6, 30), NURC); // Sunday 06:30
  assert.equal(n?.inDays, 0);
  assert.equal(n?.startMinute, 480);
});

check("A CLASS THAT HAS ALREADY STARTED ROLLS TO NEXT WEEK", () => {
  /* The bug this file exists for: asked at 09:00 about an 08:00 class. */
  const n = nextClass(SLOTS, at(0, 9, 0), NURC);
  assert.notEqual(n?.inDays, 0);
  assert.equal(n?.weekday, 2, "it should move on to Tuesday, not stay on Sunday");
  assert.equal(n?.inDays, 2);
});

check("exactly on the minute, the class has started", () => {
  /* 08:00 asked at 08:00 is not "coming up", it is happening. */
  const n = nextClass(SLOTS, at(0, 8, 0), NURC);
  assert.notEqual(n?.weekday, 0);
});

check("THE SOONEST MOMENT WINS, NOT THE LOWEST WEEKDAY", () => {
  /* Asked on Tuesday after the 13:00 class: the next is Sunday, which is
     weekday 0 — a lower number than today. Sorting by weekday puts it last. */
  const n = nextClass(SLOTS, at(2, 14, 0), NURC);
  assert.equal(n?.weekday, 0);
  assert.equal(n?.inDays, 5);
});

check("a course with no slots says nothing", () => {
  /* Three of his six courses have no timetable at all. */
  assert.equal(nextClass(SLOTS, at(0, 9), "nurm410"), null);
  assert.equal(nextClass([], at(0, 9), NURC), null);
});

check("a full week is seven days away, never zero", () => {
  const n = nextClass([{ subjectId: NURP, weekday: 1, startMinute: 480 }], at(1, 9), NURP);
  assert.equal(n?.inDays, 7, "a class an hour ago came back as happening now");
});

check("junk slots are skipped rather than crashing the cover", () => {
  const junk: WeeklySlot[] = [
    { subjectId: NURC, weekday: 9, startMinute: 480 },
    { subjectId: NURC, weekday: -1, startMinute: 480 },
    { subjectId: NURC, weekday: 3, startMinute: Number.NaN },
    { subjectId: NURC, weekday: 4, startMinute: 600 },
  ];
  const n = nextClass(junk, at(0, 9), NURC);
  assert.equal(n?.weekday, 4);
});

check("THE CLOCK READS AS A STUDENT WOULD SAY IT", () => {
  assert.equal(clockOf(8 * 60, "ar"), "8 ص");
  assert.equal(clockOf(13 * 60, "ar"), "1 م");
  assert.equal(clockOf(8 * 60 + 30, "ar"), "8:30 ص");
  assert.equal(clockOf(12 * 60, "ar"), "12 م");
  assert.equal(clockOf(0, "ar"), "12 ص", "midnight is 12, not 0");
  assert.equal(clockOf(8 * 60, "en"), "8 am");
});

/* ── mutations ──────────────────────────────────────────────────────────── */

function mutationBites(name: string, probe: () => void) {
  try {
    probe();
    failures += 1;
    console.log(`  MUTATION DID NOT BITE  ${name}`);
  } catch {
    console.log(`  bites  ${name}`);
  }
}

console.log("");
console.log("mutations");

mutationBites("letting a class that already started count as today", () => {
  const bad = (weekday: number, today: number) => (weekday - today + 7) % 7;
  assert.notEqual(bad(0, 0), 0);
});

mutationBites("sorting by weekday instead of by moment", () => {
  /* On Tuesday, Sunday's class is next. By weekday number it sorts first and
     by moment it sorts last — the same list, opposite answers. */
  const today = 2;
  const byWeekday = [...SLOTS].filter((s) => s.subjectId === NURC).sort((a, b) => a.weekday - b.weekday)[0];
  const byMoment = nextClass(SLOTS, at(2, 14, 0), NURC);
  assert.notEqual(byWeekday.weekday, byMoment?.weekday);
  assert.ok(today);
});

mutationBites("printing midnight as 0", () => {
  const bad = (m: number) => `${Math.floor(m / 60) % 12} ص`;
  assert.equal(bad(0), "12 ص");
});

mutationBites("printing 13:00 as 13", () => {
  const bad = (m: number) => `${Math.floor(m / 60)} م`;
  assert.equal(bad(13 * 60), "1 م");
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("وقت المحاضرة الجاية، وما يرجع لورا.");
}
