/**
 * Course progress, against the account it was written for.
 *
 * The six lectures below are the real ones, read out of the database on
 * 2026-09-30 with their decks, their recorded reading positions and their
 * manual status intact:
 *
 *   NURC (410)  Cardiovascular system    1 deck   never opened   NOT_STARTED
 *               GAS EXCHANGE             1 deck   read to end    NOT_STARTED
 *               mechanical ventilation   1 deck   read to end    NOT_STARTED
 *               Revascular system        0 decks  -              NOT_STARTED
 *   NURP (431)  Management Process       1 deck   never opened   NOT_STARTED
 *               Planning                 0 decks  -              NOT_STARTED
 *
 * Read the status column and this student has completed nothing. Read the
 * reading positions and he has finished two lectures. The obvious metric —
 * completed lectures over lectures — returns 0% for every course on an
 * account holding 37 documents, and the first test below is that refutation,
 * kept so nobody reintroduces it.
 *
 * Run: npx tsx scripts/verify-course-progress.ts
 */

import {
  courseProgress,
  lectureDone,
  progressFraction,
  MIN_FOR_PERCENT,
  type LectureEvidence,
} from "../src/lib/course-progress";

let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
    failed++;
  }
}

console.log("Course progress\n");

const lec = (decks: number, decksFinished: number, markedComplete = false): LectureEvidence => ({
  decks,
  decksFinished,
  markedComplete,
});

/* ── The real two courses ─────────────────────────────────────────────────── */

const NURC410: LectureEvidence[] = [
  lec(1, 0), // Cardiovascular system — never opened
  lec(1, 1), // GAS EXCHANGE — read to the end
  lec(1, 1), // mechanical ventilation — read to the end
  lec(0, 0), // Revascular system — no material
];

const NURP431: LectureEvidence[] = [
  lec(1, 0), // Management Process — never opened
  lec(0, 0), // Planning — no material
];

const EMPTY_COURSE: LectureEvidence[] = [];

{
  // THE REFUTATION. Every lecture on this account is NOT_STARTED, so the
  // obvious metric returns zero for a course whose material he has half read.
  const byManualFlag = NURC410.filter((l) => l.markedComplete).length;
  ok("the obvious metric would report nothing done on this course",
    byManualFlag === 0, `manual completions: ${byManualFlag}`);

  const p = courseProgress(NURC410);
  ok("reading evidence reports two of the three lectures that have material",
    p.kind === "FRACTION" && p.done === 2 && p.total === 3, JSON.stringify(p));
}

{
  // A lecture with no deck is not in the denominator: he cannot read a file
  // that does not exist, and counting it says he is behind on it.
  const p = courseProgress(NURC410);
  ok("a lecture with no material is left out of the denominator",
    p.kind !== "EMPTY" && p.total === 3, JSON.stringify(p));

  const q = courseProgress(NURP431);
  ok("the same on the other real course", q.kind === "FRACTION" && q.done === 0 && q.total === 1,
    JSON.stringify(q));
}

{
  // Four of his six courses have no lectures at all. EMPTY, never 0% — the
  // difference between "you have not started" and "nothing is here yet" is
  // the difference between a rebuke and a prompt.
  ok("a course with nothing in it is EMPTY, not zero",
    courseProgress(EMPTY_COURSE).kind === "EMPTY");
  ok("a course whose every lecture lacks material is EMPTY too",
    courseProgress([lec(0, 0), lec(0, 0)]).kind === "EMPTY");
}

/* ── Where a percentage becomes honest ────────────────────────────────────── */

{
  const three = [lec(1, 1), lec(1, 1), lec(1, 0)];
  const four = [lec(1, 1), lec(1, 1), lec(1, 0), lec(1, 0)];

  ok("three measurable lectures give a fraction, not a percentage",
    courseProgress(three).kind === "FRACTION");
  ok("four give a percentage", courseProgress(four).kind === "PERCENT");

  // Tied to the constant, so changing MIN_FOR_PERCENT cannot leave this
  // asserting the old boundary.
  const atFloor = Array.from({ length: MIN_FOR_PERCENT }, () => lec(1, 1));
  const belowFloor = atFloor.slice(0, MIN_FOR_PERCENT - 1);
  ok("the boundary follows the constant",
    courseProgress(atFloor).kind === "PERCENT" && courseProgress(belowFloor).kind === "FRACTION");

  const p = courseProgress(four);
  ok("the percentage is right", p.kind === "PERCENT" && p.percent === 50, JSON.stringify(p));
}

{
  // Rounding has one safe direction. "Finished" is a claim the student checks
  // against their own folder, so 99.x must never print as 100.
  const many = [...Array.from({ length: 299 }, () => lec(1, 1)), lec(1, 0)];
  const p = courseProgress(many);
  ok("almost-finished never rounds up to finished",
    p.kind === "PERCENT" && p.percent === 99, JSON.stringify(p));

  const all = Array.from({ length: 5 }, () => lec(1, 1));
  const q = courseProgress(all);
  ok("actually finished is exactly 100", q.kind === "PERCENT" && q.percent === 100, JSON.stringify(q));
}

/* ── What counts as done ──────────────────────────────────────────────────── */

{
  ok("reading every deck to the end is done", lectureDone(lec(2, 2)));
  ok("reading some of the decks is not done", !lectureDone(lec(2, 1)));
  ok("never opening it is not done", !lectureDone(lec(1, 0)));

  // The student ticking the box is believed: they know something the file
  // does not, and overriding them would make the control decorative.
  ok("marked complete by hand counts, even with nothing read",
    lectureDone(lec(1, 0, true)));
  ok("marked complete counts even with no material at all",
    lectureDone(lec(0, 0, true)));

  // The vacuous case, and the easiest way for this to inflate: with no decks,
  // `decksFinished >= decks` is 0 >= 0 and every empty lecture would be done.
  ok("an empty lecture is not vacuously done", !lectureDone(lec(0, 0)));

  // And it must not be excluded from the denominator either, once ticked —
  // otherwise ticking the box would make a course's total shrink.
  const p = courseProgress([lec(0, 0, true), lec(1, 0)]);
  ok("a hand-marked lecture stays in the denominator",
    p.kind === "FRACTION" && p.done === 1 && p.total === 2, JSON.stringify(p));
}

/* ── The bar ──────────────────────────────────────────────────────────────── */

{
  // A bar can be drawn honestly where a number cannot: "one of two, half
  // filled" is true, while printing "50%" over two items overstates. So the
  // bar draws for a FRACTION too, and only the label is withheld.
  ok("the bar fills for a fraction", progressFraction(courseProgress([lec(1, 1), lec(1, 0)])) === 0.5);
  ok("the bar is empty for an empty course", progressFraction(courseProgress(EMPTY_COURSE)) === 0);
  ok("the bar is full when finished",
    progressFraction(courseProgress([lec(1, 1), lec(1, 1)])) === 1);
  ok("the real course fills two thirds", Math.abs(progressFraction(courseProgress(NURC410)) - 2 / 3) < 1e-9);
}

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
