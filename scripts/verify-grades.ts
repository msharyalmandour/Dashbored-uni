/**
 * Telling a grade weight from a number that happens to carry a percent sign.
 *
 * The fixtures here are not invented. They are the owner's own two syllabi,
 * read out of his account on 2026-10-07, including the lines that look like
 * weights and are not — a 25% absence threshold and a 50% attendance rule,
 * both of which sit in the same table region as the real figures.
 *
 * The rule under test: a set of weights is the set that sums to 100, and each
 * group sums to the row above it. Both halves are needed. The 100 check alone
 * cannot see a missing child, and the children check alone cannot see a whole
 * missing top-level row.
 */
import assert from "node:assert/strict";
import {
  problemsWith,
  isSound,
  heaviestFirst,
  weightOf,
  describeProblem,
  type Component,
} from "../src/lib/grades";

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log("What each thing is worth");
console.log("");

/* ── His real syllabi ─────────────────────────────────────────────────────── */

/** NURC 411 — Critical Care Nursing Clinical. The final IS the OSCE and OSPE. */
const NURC411: Component[] = [
  { label: "Semester work", weight: 60, parent: null },
  { label: "Clinical Evaluation", weight: 30, parent: "Semester work" },
  { label: "Problem Solving project", weight: 10, parent: "Semester work" },
  { label: "Documentation", weight: 20, parent: "Semester work" },
  { label: "ICU Assessment Sheet and Nursing Care Plan", weight: 10, parent: "Documentation" },
  { label: "Daily Assessment Sheet", weight: 10, parent: "Documentation" },
  { label: "Final", weight: 40, parent: null },
  { label: "Final Written Exam, Final OSCE and OSPE", weight: 40, parent: "Final" },
];

/** NURC 410 — the ordinary shape, same course name, graded completely differently. */
const NURC410: Component[] = [
  { label: "Semester Work", weight: 60, parent: null },
  { label: "Midterm", weight: 30, parent: "Semester Work" },
  { label: "Case-Based Learning (Presentation)", weight: 20, parent: "Semester Work" },
  { label: "BB MCQs", weight: 10, parent: "Semester Work" },
  { label: "Final", weight: 40, parent: null },
  { label: "Final Written Exam", weight: 40, parent: "Final" },
];

check("NURC 411 reads as sound", () => {
  assert.deepEqual(problemsWith(NURC411), [], "his real 411 table must validate");
});

check("NURC 410 reads as sound", () => {
  assert.deepEqual(problemsWith(NURC410), []);
});

check("two courses with one name are two different tables", () => {
  /* The point of holding both: 410 and 411 are both "Critical Care Nursing"
     and the app treated them identically. Nothing here should make them
     comparable by accident. */
  assert.notDeepEqual(heaviestFirst(NURC411), heaviestFirst(NURC410));
});

/* ── THE LINES THAT ARE NOT WEIGHTS ───────────────────────────────────────── */

check("an absence threshold is not a weight", () => {
  /* "Excessive absences of the total study hours more than 25%, may result in
     a grade F" — a real line from NURC 411, in the same region as the table.
     Pulled in, it prices a quarter of the student's grade as attendance. */
  const withAbsence: Component[] = [...NURC411, { label: "Absence limit", weight: 25, parent: null }];
  const problems = problemsWith(withAbsence);
  assert.ok(problems.length > 0, "25% absence must not pass as a weight");
  assert.equal(problems[0].kind, "NOT_100");
  assert.match(describeProblem(problems[0]), /125/);
});

check("an attendance rule is not a weight", () => {
  /* "Students are expected to attend all clinical experiences, which
     constitutes 50% of the…" — also real, also NURC 411. */
  const withAttendance: Component[] = [
    ...NURC411,
    { label: "Clinical attendance", weight: 50, parent: null },
  ];
  assert.ok(!isSound(withAttendance));
});

check("the Total row is a sum, not a part", () => {
  const withTotal: Component[] = [...NURC411, { label: "Total", weight: 100, parent: null }];
  assert.ok(!isSound(withTotal), "Total 100% must not be stored as a component");
});

/* ── Half-read tables ─────────────────────────────────────────────────────── */

check("a missing top-level row is caught", () => {
  const noFinal = NURC411.filter((c) => c.parent !== null || c.label !== "Final").filter(
    (c) => c.parent !== "Final"
  );
  const problems = problemsWith(noFinal);
  assert.ok(problems.some((p) => p.kind === "NOT_100"));
  assert.match(describeProblem(problems.find((p) => p.kind === "NOT_100")!), /60[\s\S]*missing/);
});

check("a missing child is caught, which the 100 check alone cannot see", () => {
  /* Drop Documentation's 20% and the roots still sum to 100 — Semester work is
     still 60 — so only the per-group sum notices. This is the half that keeps
     a partly-read table from being stored as complete. */
  const noDocs = NURC411.filter((c) => c.label !== "Documentation" && c.parent !== "Documentation");
  const roots = noDocs.filter((c) => c.parent === null).reduce((s, c) => s + c.weight, 0);
  assert.equal(roots, 100, "the fixture must still sum to 100, or this proves nothing");

  const problems = problemsWith(noDocs);
  assert.ok(
    problems.some((p) => p.kind === "CHILDREN_MISMATCH"),
    "a dropped child must be caught by the per-group sum"
  );
});

check("a weight read as a share of its parent is caught", () => {
  /* The likeliest misreading: taking Clinical Evaluation's 30 as 30% OF the
     60, so the children are scaled to sum to 100 instead of to 60. */
  const asShareOfParent: Component[] = [
    { label: "Semester work", weight: 60, parent: null },
    { label: "Clinical Evaluation", weight: 50, parent: "Semester work" },
    { label: "Problem Solving project", weight: 16.7, parent: "Semester work" },
    { label: "Documentation", weight: 33.3, parent: "Semester work" },
    { label: "Final", weight: 40, parent: null },
  ];
  assert.ok(problemsWith(asShareOfParent).some((p) => p.kind === "CHILDREN_MISMATCH"));
});

/* ── Shapes that are nonsense ─────────────────────────────────────────────── */

check("nothing found is said plainly, not treated as sound", () => {
  assert.deepEqual(problemsWith([]), [{ kind: "EMPTY" }]);
  assert.ok(!isSound([]));
});

check("a weight outside a grade is refused", () => {
  for (const weight of [-5, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
    const bad: Component[] = [{ label: "x", weight, parent: null }];
    assert.ok(
      problemsWith(bad).some((p) => p.kind === "BAD_WEIGHT"),
      `${weight} must be refused`
    );
  }
  // Zero is allowed: a syllabus can list an ungraded requirement.
  assert.ok(
    !problemsWith([
      { label: "Attendance", weight: 0, parent: null },
      { label: "Final", weight: 100, parent: null },
    ]).some((p) => p.kind === "BAD_WEIGHT")
  );
});

check("the same row twice is refused", () => {
  const twice: Component[] = [
    { label: "Final", weight: 50, parent: null },
    { label: "Final", weight: 50, parent: null },
  ];
  assert.ok(problemsWith(twice).some((p) => p.kind === "DUPLICATE_LABEL"));
});

check("a parent that is not a row is refused", () => {
  const orphan: Component[] = [
    { label: "Final", weight: 100, parent: null },
    { label: "Quiz", weight: 10, parent: "Semester work" },
  ];
  assert.ok(problemsWith(orphan).some((p) => p.kind === "UNKNOWN_PARENT"));
});

check("a row under itself does not hang the checker", () => {
  const cycle: Component[] = [
    { label: "A", weight: 50, parent: "B" },
    { label: "B", weight: 50, parent: "A" },
  ];
  assert.ok(problemsWith(cycle).some((p) => p.kind === "CYCLE"));
});

check("rounding is not mistaken for a missing row", () => {
  const thirds: Component[] = [
    { label: "a", weight: 33.33, parent: null },
    { label: "b", weight: 33.33, parent: null },
    { label: "c", weight: 33.34, parent: null },
  ];
  assert.deepEqual(problemsWith(thirds), []);
});

check("THE TOLERANCE IS PINNED FROM BOTH SIDES", () => {
  /* ADDED BECAUSE A MUTATION DID NOT BITE. Widening TOLERANCE from 0.01 to 15
     left every check above passing, which means none of them was testing the
     number: their errors are all large — 125 against 100, 60 against 100 — and
     a float-rounding gap is tiny, so nothing sat in between. A tolerance that
     swallows a missed 10% row is the whole failure this module exists to stop.

     So the band is nailed at both ends. The smallest weight either of his
     syllabi uses is 10, and the largest honest float error on a sum of eight
     two-decimal numbers is far below 0.1.

     Re-mutated after writing this: TOLERANCE at 15 and at 1 both fail these
     checks, and at 0.2 they pass. That is correct rather than a remaining
     hole — anything up to ~0.9 still catches every error a real syllabus can
     contain, because syllabus weights are whole or two-decimal numbers and
     the smallest is 10. Pinning tighter would be testing one arbitrary choice
     instead of the guarantee, so it is left alone deliberately. */

  // A real missing row, the size of his smallest component, must be caught.
  const missingTen: Component[] = [
    { label: "Semester work", weight: 60, parent: null },
    { label: "Final", weight: 30, parent: null },
  ];
  assert.ok(
    problemsWith(missingTen).some((p) => p.kind === "NOT_100"),
    "a 10-point gap is a missing row and must not be tolerated"
  );

  // And the smallest one that matters: a single point.
  const missingOne: Component[] = [
    { label: "Semester work", weight: 60, parent: null },
    { label: "Final", weight: 39, parent: null },
  ];
  assert.ok(
    problemsWith(missingOne).some((p) => p.kind === "NOT_100"),
    "a 1-point gap is still wrong arithmetic"
  );

  // The same, one level down, so the per-group sum is pinned too.
  const childShort: Component[] = [
    { label: "Semester work", weight: 60, parent: null },
    { label: "Midterm", weight: 30, parent: "Semester work" },
    { label: "Quiz", weight: 20, parent: "Semester work" },
    { label: "Final", weight: 40, parent: null },
  ];
  assert.ok(
    problemsWith(childShort).some((p) => p.kind === "CHILDREN_MISMATCH"),
    "children summing to 50 under a 60 parent is a missing child"
  );

  // Float noise must still pass, or the checker rejects correct tables.
  const noisy: Component[] = [
    { label: "a", weight: 0.1 + 0.2, parent: null }, // 0.30000000000000004
    { label: "b", weight: 99.7, parent: null },
  ];
  assert.deepEqual(problemsWith(noisy), [], "0.1 + 0.2 must not read as a missing row");
});

/* ── Reading a sound set ──────────────────────────────────────────────────── */

check("the heaviest real work comes first, and containers are left out", () => {
  const order = heaviestFirst(NURC411).map((c) => c.label);
  // "Semester work" and "Final" are containers — not things to go and do.
  assert.ok(!order.includes("Semester work"));
  assert.ok(!order.includes("Final"));
  assert.ok(!order.includes("Documentation"), "Documentation holds two sheets, so it is a container");
  assert.equal(order[0], "Final Written Exam, Final OSCE and OSPE", "40% is the heaviest");
  assert.equal(order[1], "Clinical Evaluation", "then 30%");
});

check("ties keep the syllabus's own order", () => {
  const order = heaviestFirst(NURC411).map((c) => c.label);
  const icu = order.indexOf("ICU Assessment Sheet and Nursing Care Plan");
  const daily = order.indexOf("Daily Assessment Sheet");
  assert.ok(icu < daily, "both are 10%; the syllabus lists ICU first");
});

check("70% of NURC 411 is clinical — a figure no single row carries", () => {
  /* The finding that reordered the project: the 411 final IS the OSCE and
     OSPE, and Clinical Evaluation is a separate 30%. */
  const clinical = weightOf(NURC411, [
    "Final Written Exam, Final OSCE and OSPE",
    "Clinical Evaluation",
  ]);
  assert.equal(clinical, 70);
});

check("a container is not counted twice when summing a group", () => {
  /* Asking for Documentation and its two sheets must give 20, not 40. */
  assert.equal(
    weightOf(NURC411, [
      "Documentation",
      "ICU Assessment Sheet and Nursing Care Plan",
      "Daily Assessment Sheet",
    ]),
    20
  );
});

console.log("");
console.log(failures === 0 ? "A weight is a number that adds up." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
