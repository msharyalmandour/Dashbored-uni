/**
 * مادة ← أسبوع ← محاضرة.
 *
 * The last block runs every real lecture on this account through the rule and
 * pins which week each one lands in.
 */
import assert from "node:assert/strict";
import { weekOf, weekRange, byWeek } from "../src/lib/academic-week";

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

console.log("أسابيع الفصل");
console.log("");

const d = (s: string) => new Date(`${s}T09:00:00`);
/** Read from the database: the one ACTIVE semester, "CRTICAL CARE". */
const START = d("2026-09-05");

check("THE SEMESTER'S FIRST DAY IS WEEK 1, NOT WEEK 0", () => {
  assert.equal(weekOf(START, START), 1);
});

check("THE FIRST TEACHING DAY IS ALSO WEEK 1", () => {
  /* The semester opens on a Saturday and the Saudi teaching week is Sunday to
     Thursday. Anchoring weeks to a fixed weekday instead of to the start date
     would put Sunday the 6th — the first day anyone actually teaches — into
     week 2, which is the one error a student spots instantly. */
  assert.equal(weekOf(d("2026-09-06"), START), 1, "the first Sunday fell out of week 1");
  assert.equal(weekOf(d("2026-09-10"), START), 1, "the first Thursday fell out of week 1");
});

check("a week is seven days and the boundary is where it should be", () => {
  assert.equal(weekOf(d("2026-09-11"), START), 1, "day 7 of the semester left week 1");
  assert.equal(weekOf(d("2026-09-12"), START), 2, "day 8 did not start week 2");
  assert.equal(weekOf(d("2026-09-18"), START), 2);
  assert.equal(weekOf(d("2026-09-19"), START), 3);
});

check("a date before the semester starts lands in week 1, not week zero", () => {
  /* A lecture dated before the start is a data error — a mistyped year, a file
     from last term. Week -3 hides it; week 1 is where it will be found. */
  for (const before of ["2026-09-04", "2026-08-01", "2025-01-01"]) {
    assert.equal(weekOf(d(before), START), 1, `${before} did not land in week 1`);
  }
});

check("weekRange covers exactly the days that week claims", () => {
  for (const week of [1, 2, 5, 47]) {
    const { from, to } = weekRange(week, START);
    assert.equal(weekOf(from, START), week, `week ${week} starts in a different week`);
    assert.equal(weekOf(to, START), week, `week ${week} ends in a different week`);
    const dayAfter = new Date(to);
    dayAfter.setDate(dayAfter.getDate() + 1);
    assert.equal(weekOf(dayAfter, START), week + 1, `week ${week} and ${week + 1} are not adjacent`);
  }
});

check("EMPTY WEEKS ARE LEFT OUT", () => {
  /* The semester runs 5 Sep to 27 Jul — about 47 weeks — and eight lectures
     sit in four of them. Printing the other forty-three as empty headings is a
     scrollable record of absence. */
  const grouped = byWeek(
    [d("2026-09-05"), d("2026-10-02")],
    (x) => x,
    START
  );
  assert.equal(grouped.length, 2, `got ${grouped.length} groups for two weeks`);
  assert.deepEqual(grouped.map((g) => g.week), [4, 1], "weeks are not newest-first");
});

check("inside a week, the earliest lecture is first", () => {
  const grouped = byWeek(
    [d("2026-09-24"), d("2026-09-20"), d("2026-09-22")],
    (x) => x,
    START
  );
  assert.equal(grouped.length, 1, "three dates in one week were split up");
  assert.deepEqual(
    grouped[0].items.map((x) => x.getDate()),
    [20, 22, 24],
    "a week is read forwards even though weeks are listed backwards"
  );
});

check("THIS STUDENT'S EIGHT LECTURES, BY WEEK", () => {
  const real = [
    { t: "GAS EXCHANGE", date: d("2026-09-05") },
    { t: "Planning", date: d("2026-09-11") },
    { t: "Management Process", date: d("2026-09-11") },
    { t: "mechanical ventilation", date: d("2026-09-24") },
    { t: "Cardiovascular system", date: d("2026-09-24") },
    { t: "Revascular system", date: d("2026-09-24") },
    { t: "Orgnaizing", date: d("2026-09-30") },
    { t: "ECG", date: d("2026-10-02") },
  ];
  assert.deepEqual(
    real.map((l) => [l.t, weekOf(l.date, START)]),
    [
      ["GAS EXCHANGE", 1],
      ["Planning", 1],
      ["Management Process", 1],
      ["mechanical ventilation", 3],
      ["Cardiovascular system", 3],
      ["Revascular system", 3],
      ["Orgnaizing", 4],
      ["ECG", 4],
    ]
  );

  const grouped = byWeek(real, (l) => l.date, START);
  assert.deepEqual(grouped.map((g) => g.week), [4, 3, 1], "week 2 is empty and should not appear");
  assert.deepEqual(grouped.map((g) => g.items.length), [2, 3, 3]);
});

check("the midterm week is the week the student is heading into", () => {
  assert.equal(weekOf(d("2026-10-08"), START), 5, "today is not week 5");
  assert.equal(weekOf(d("2026-10-12"), START), 6, "the midterm is not in week 6");
});

console.log("");
console.log(failures === 0 ? "مادة ← أسبوع ← محاضرة." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
