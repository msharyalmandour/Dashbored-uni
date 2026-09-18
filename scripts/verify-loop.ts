import assert from "node:assert/strict";
import { readDay } from "../src/lib/daily-loop";
import { readEvening, isEvening } from "../src/lib/evening";
import type { Collision, DayCapacity } from "../src/lib/time-intelligence";

let n = 0;
const check = (name: string, fn: () => void) => { fn(); n++; console.log("  ok", name); };

const cap = (studyMinutes: number, unknown = false): DayCapacity => ({
  flexibleMinutes: Math.round(studyMinutes * 1.5),
  studyMinutes,
  committedMinutes: 0,
  unknown,
});
const col = (verdict: Collision["verdict"], available = 120, required = 60): Collision =>
  ({ verdict, deficitMinutes: 0, availableMinutes: available, requiredMinutes: required, unestimatedCount: 0 });

console.log("readDay:");
check("no commitments -> UNKNOWN, never 'free all day'", () => {
  const r = readDay({ collision: col("UNKNOWN"), today: cap(0, true), daysToNearest: null });
  assert.equal(r.situation, "UNKNOWN");
  assert.equal(r.week, "UNKNOWN");
});
check("overloaded week wins over a near deadline", () => {
  const r = readDay({ collision: col("OVERLOADED"), today: cap(200), daysToNearest: 1 });
  assert.equal(r.situation, "OVERLOADED");
  assert.equal(r.week, "HEAVY");
});
check("deadline inside 3 days -> BUILDING even on a calm week", () => {
  const r = readDay({ collision: col("FITS"), today: cap(200), daysToNearest: 2 });
  assert.equal(r.situation, "BUILDING");
  assert.equal(r.week, "CALM");
});
check("distant deadline + room -> ROOM_TODAY", () => {
  assert.equal(readDay({ collision: col("FITS"), today: cap(200), daysToNearest: 20 }).situation, "ROOM_TODAY");
});
check("under 45 study minutes -> TIGHT_TODAY", () => {
  assert.equal(readDay({ collision: col("FITS"), today: cap(30), daysToNearest: null }).situation, "TIGHT_TODAY");
});
check("tight week reads as BUILDING", () => {
  assert.equal(readDay({ collision: col("TIGHT"), today: cap(200), daysToNearest: null }).week, "BUILDING");
});

console.log("readEvening:");
const base = { dueTomorrow: 0, tomorrow: col("FITS") };
check("nothing done, nothing due -> NOTHING_RECORDED", () => {
  assert.equal(readEvening({ ...base, tasksCompleted: 0, focusMinutes: 0, openDueToday: 0 }).outcome, "NOTHING_RECORDED");
});
check("nothing done, something open -> SLIPPED", () => {
  assert.equal(readEvening({ ...base, tasksCompleted: 0, focusMinutes: 0, openDueToday: 3 }).outcome, "SLIPPED");
});
check("focus minutes alone count as work", () => {
  assert.equal(readEvening({ ...base, tasksCompleted: 0, focusMinutes: 25, openDueToday: 2 }).outcome, "PARTIAL");
});
check("work done and nothing open -> CLEARED", () => {
  assert.equal(readEvening({ ...base, tasksCompleted: 2, focusMinutes: 0, openDueToday: 0 }).outcome, "CLEARED");
});
check("inputs are passed through untouched", () => {
  const r = readEvening({ tasksCompleted: 1, focusMinutes: 50, openDueToday: 4, dueTomorrow: 7, tomorrow: col("OVERLOADED") });
  assert.equal(r.focusMinutes, 50);
  assert.equal(r.dueTomorrow, 7);
  assert.equal(r.tomorrow.verdict, "OVERLOADED");
});
check("evening starts at 18:00 and not before", () => {
  const at = (h: number) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d; };
  assert.equal(isEvening(at(17)), false);
  assert.equal(isEvening(at(18)), true);
  assert.equal(isEvening(at(23)), true);
  assert.equal(isEvening(at(9)), false);
});

console.log(`\n${n} assertions passed`);
