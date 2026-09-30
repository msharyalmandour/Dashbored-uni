/**
 * Course progress, against the account it was written for.
 *
 * The lectures below are the real ones, read out of the database on
 * 2026-09-30 with their decks, their recorded reading positions and their
 * manual status intact:
 *
 *   NURC (410)  Cardiovascular system    42 pages  never opened   NOT_STARTED
 *               GAS EXCHANGE              1 page   read to end    NOT_STARTED
 *               mechanical ventilation   51 pages  page 1 of 51   NOT_STARTED
 *               Revascular system         0 decks  -              NOT_STARTED
 *   NURP (431)  Management Process       13 pages  never opened   NOT_STARTED
 *               Orgnaizing               46 pages  page 20 of 46  NOT_STARTED
 *
 * Read the status column and this student has completed nothing. Read the
 * reading positions and he has finished one lecture. The obvious metric —
 * completed lectures over lectures — returns 0% for every course on an
 * account holding thirty-one documents, and the first test below is that
 * refutation, kept so nobody reintroduces it.
 *
 * THE PAGE COUNTS ARE IN THIS COMMENT ON PURPOSE. An earlier version of this
 * file recorded "GAS EXCHANGE read to end" and "mechanical ventilation read to
 * end", and the second was false. `LectureSlide.pageCount` defaulted to 1 and
 * was corrected only by the viewer in the student's browser; for the 42- and
 * 51-page decks that correction never ran, so opening page one reached the end
 * of what the app believed was a one-page document and the position was
 * stamped complete. This engine then faithfully reported a 51-page lecture as
 * finished — a true answer computed from a false input, which is the failure
 * mode that no amount of care inside this file can catch.
 *
 * The fix is in src/lib/processors/index.ts (the count is now written where
 * the file is parsed) and src/lib/study-position.ts (a corrected count
 * withdraws a completion that depended on the wrong one), with the rows
 * backfilled by prisma/migrations/manual/20260930_slide_page_count_backfill.sql.
 * The numbers above are from after that. Progress went from "2 of 3" to
 * "1 of 3" on NURC and from "0 of 1" to "0 of 2" on NURP — which is what it
 * had been all along.
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
  lec(1, 0), // Cardiovascular system — 42 pages, never opened
  lec(1, 1), // GAS EXCHANGE — 1 page, genuinely read to the end
  lec(1, 0), // mechanical ventilation — 51 pages, page 1 of 51
  lec(0, 0), // Revascular system — no material
];

const NURP431: LectureEvidence[] = [
  lec(1, 0), // Management Process — 13 pages, never opened
  lec(1, 0), // Orgnaizing — 46 pages, page 20 of 46
];

const EMPTY_COURSE: LectureEvidence[] = [];

{
  // THE REFUTATION. Every lecture on this account is NOT_STARTED, so the
  // obvious metric returns zero for a course whose material he has half read.
  const byManualFlag = NURC410.filter((l) => l.markedComplete).length;
  ok("the obvious metric would report nothing done on this course",
    byManualFlag === 0, `manual completions: ${byManualFlag}`);

  const p = courseProgress(NURC410);
  ok("reading evidence reports one of the three lectures that have material",
    p.kind === "FRACTION" && p.done === 1 && p.total === 3, JSON.stringify(p));
}

{
  /* The regression, kept as a case rather than a comment.
  
     This is mechanical ventilation as the database described it before the
     page count was fixed: one deck, one deck "finished". The engine is right
     to call that done — that is what its input says — which is exactly why
     the input had to be fixed rather than this rule softened. A deck at page
     one of fifty-one now arrives as `lec(1, 0)` and is not done. */
  ok("a deck reported finished IS counted done — the engine trusts its input",
    lectureDone(lec(1, 1)));
  ok("and the same lecture, described truthfully, is not",
    !lectureDone(lec(1, 0)));
}

{
  // A lecture with no deck is not in the denominator: he cannot read a file
  // that does not exist, and counting it says he is behind on it.
  const p = courseProgress(NURC410);
  ok("a lecture with no material is left out of the denominator",
    p.kind !== "EMPTY" && p.total === 3, JSON.stringify(p));

  const q = courseProgress(NURP431);
  ok("the same on the other real course", q.kind === "FRACTION" && q.done === 0 && q.total === 2,
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
  ok("the real course fills one third", Math.abs(progressFraction(courseProgress(NURC410)) - 1 / 3) < 1e-9);
}

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
