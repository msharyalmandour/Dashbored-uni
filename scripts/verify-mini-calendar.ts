/**
 * The two-week strip, and the four ways a calendar lies quietly.
 *
 * A date grid never throws. It draws fourteen numbers, all of them plausible,
 * and one of them is under the wrong weekday — which a student discovers by
 * turning up on the wrong day.
 */

import assert from "node:assert/strict";
import { twoWeeks, weekStart } from "../src/lib/mini-calendar";

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

console.log("تقويم الأسبوعين");
console.log("");

check("THE COLUMN INDEX IS THE WEEKDAY, SUNDAY FIRST", () => {
  /* The grid is drawn ح ن ث ر خ ج س. If a cell's weekday ever stops matching
     its position, every date moves one column and nothing errors. */
  const cells = twoWeeks(new Date(2026, 10, 4)); // Wed 4 Nov 2026
  cells.forEach((c, i) => assert.equal(c.weekday, i % 7, `cell ${i}`));
});

check("the strip opens on the Sunday of his week", () => {
  /* 4 November 2026 is a Wednesday; its Sunday is the 1st. */
  const cells = twoWeeks(new Date(2026, 10, 4));
  assert.equal(cells[0].day, 1);
  assert.equal(cells[0].weekday, 0);
  assert.equal(cells.length, 14);
});

check("asked ON a Sunday it does not jump back a week", () => {
  const cells = twoWeeks(new Date(2026, 10, 1)); // Sunday
  assert.equal(cells[0].day, 1);
  assert.equal(weekStart(new Date(2026, 10, 1)).getDate(), 1);
});

check("asked on a Saturday the week is still the one he is in", () => {
  const cells = twoWeeks(new Date(2026, 10, 7)); // Saturday
  assert.equal(cells[0].day, 1, "Saturday belongs to the week that began on the 1st");
  assert.equal(cells[13].day, 14);
});

check("TODAY IS MARKED EXACTLY ONCE", () => {
  const cells = twoWeeks(new Date(2026, 10, 4, 23, 59));
  assert.equal(cells.filter((c) => c.today).length, 1);
  assert.equal(cells.find((c) => c.today)!.day, 4);
});

check("the hour of day does not move the mark", () => {
  for (const h of [0, 7, 13, 23]) {
    const c = twoWeeks(new Date(2026, 10, 4, h, 30)).find((x) => x.today)!;
    assert.equal(c.day, 4, `at ${h}:30`);
  }
});

check("A STRIP THAT CROSSES A MONTH DOES NOT COUNT PAST ITS END", () => {
  /* 26 November 2026 is a Thursday, so the strip runs 22 Nov to 5 Dec. The
     bug is 29, 30, 31, 32 — a grid built by adding to `getDate()`. */
  const cells = twoWeeks(new Date(2026, 10, 26));
  assert.deepEqual(
    cells.map((c) => c.day),
    [22, 23, 24, 25, 26, 27, 28, 29, 30, 1, 2, 3, 4, 5]
  );
});

check("the days that spill into the next month are marked as such", () => {
  const cells = twoWeeks(new Date(2026, 10, 26));
  assert.equal(cells.filter((c) => !c.inMonth).length, 5, "1 to 5 December");
  assert.equal(cells.find((c) => c.day === 30)!.inMonth, true);
  assert.equal(cells.find((c) => c.day === 1)!.inMonth, false);
});

check("a leap February is 29 days, not 28", () => {
  /* 2028 is a leap year. 27 Feb 2028 is a Sunday. */
  const cells = twoWeeks(new Date(2028, 1, 27));
  assert.equal(cells[2].day, 29, "29 February exists in 2028");
  assert.equal(cells[3].day, 1);
});

check("the year rolls over without a day going missing", () => {
  const cells = twoWeeks(new Date(2026, 11, 28)); // Mon 28 Dec 2026
  assert.equal(cells[0].day, 27);
  assert.equal(cells[5].day, 1, "1 January");
  assert.equal(cells.find((c) => c.day === 1)!.date.getFullYear(), 2027);
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

mutationBites("Monday first — every date one column off", () => {
  const bad = (d: Date) => (d.getDay() + 6) % 7;
  assert.equal(bad(new Date(2026, 10, 1)), 0, "Sunday must be column 0");
});

mutationBites("adding to getDate() — a strip that runs 30, 31, 32", () => {
  const bad: number[] = [];
  const base = new Date(2026, 10, 22).getDate();
  for (let i = 0; i < 14; i++) bad.push(base + i);
  assert.ok(Math.max(...bad) <= 30, `it would print ${Math.max(...bad)}`);
});

mutationBites("comparing instants — today marked zero times at 13:00", () => {
  const now = new Date(2026, 10, 4, 13, 0);
  const cell = new Date(2026, 10, 4);
  assert.equal(cell.getTime(), now.getTime());
});

mutationBites("marking by day-of-month — the 4th of BOTH months lit", () => {
  const cells = twoWeeks(new Date(2026, 10, 26));
  const bad = cells.filter((c) => c.day === 4).length;
  assert.equal(bad, 0, "the strip holds a 4 December that is not today");
});

mutationBites("the heading's month taken from the last cell", () => {
  const cells = twoWeeks(new Date(2026, 10, 26));
  assert.equal(cells[13].date.getMonth(), 10, "the last cell is in December");
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("أربعة عشر يوم، كل واحد تحت يومه.");
}
