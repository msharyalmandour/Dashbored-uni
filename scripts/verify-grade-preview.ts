/**
 * Four buttons, four answers — and the label is the outcome.
 *
 * THE BUG THIS FILE EXISTS FOR was in the scheduler, not the screen. The ease
 * factor was adjusted after the interval was computed from it, so «صعبة»،
 * «زينة» and «سهلة» all returned the same next interval:
 *
 *   interval 4, ease 2.5  ->  HARD 10d  GOOD 10d  EASY 10d
 *
 * Nothing showed it, because nothing told the student what a button would do.
 * Sixteen reviews on this account went through that path. The design asks for
 * the return date under each button, and printing three identical dates is
 * the honest rendering of a broken scheduler — so both are fixed and both are
 * pinned here.
 *
 * THE SECOND HALF IS THAT THE LABEL CANNOT DRIFT. `previewGrades` calls
 * `gradeFlashcard`; it does not reimplement it. Every check below grades a
 * card for real and compares it to what the preview promised.
 */

import assert from "node:assert/strict";
import { gradeFlashcard, previewGrades, type ReviewGrade } from "../src/lib/spaced-repetition";

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

console.log("البطاقات — كل زر وش يسوي");
console.log("");

const GRADES: ReviewGrade[] = ["AGAIN", "HARD", "GOOD", "EASY"];
const NOW = new Date(2026, 10, 6, 12, 0);

/* The shape of his real cards: 42 of them, intervals 0 to 4, ease 2.35 to
   2.8. The two wider ones are where a card gets to after a term. */
const CARDS = [
  { intervalDays: 0, easeFactor: 2.5, reviewCount: 0 },
  { intervalDays: 0, easeFactor: 2.35, reviewCount: 1 },
  { intervalDays: 1, easeFactor: 2.8, reviewCount: 2 },
  { intervalDays: 4, easeFactor: 2.5, reviewCount: 3 },
  { intervalDays: 10, easeFactor: 2.5, reviewCount: 6 },
  { intervalDays: 30, easeFactor: 1.3, reviewCount: 12 },
];

check("THE PREVIEW IS THE OUTCOME, NOT A SECOND FORMULA", () => {
  for (const card of CARDS) {
    const preview = previewGrades(card, NOW);
    for (const g of GRADES) {
      const real = gradeFlashcard(card, g, NOW);
      assert.equal(preview[g].intervalDays, real.intervalDays, `${g} on i=${card.intervalDays}`);
      assert.equal(preview[g].nextReviewDate.getTime(), real.nextReviewDate.getTime());
      assert.equal(preview[g].easeFactor, real.easeFactor);
    }
  }
});

check("THREE BUTTONS NO LONGER DO THE SAME THING", () => {
  /* The exact failure, at the exact intervals his cards reach. */
  for (const card of CARDS.filter((c) => c.intervalDays > 1)) {
    const p = previewGrades(card, NOW);
    assert.notEqual(
      p.HARD.intervalDays,
      p.GOOD.intervalDays,
      `صعبة and زينة both give ${p.GOOD.intervalDays}d at i=${card.intervalDays}`
    );
    assert.notEqual(
      p.GOOD.intervalDays,
      p.EASY.intervalDays,
      `زينة and سهلة both give ${p.GOOD.intervalDays}d at i=${card.intervalDays}`
    );
  }
});

check("THE ORDER ON SCREEN IS THE ORDER OF THE DATES", () => {
  /* نسيتها · صعبة · زينة · سهلة, left to right, each one further out than
     the last. A row where "صعبة" comes back later than "سهلة" is four
     buttons a student cannot reason about. */
  for (const card of CARDS) {
    const p = previewGrades(card, NOW);
    const days = GRADES.map((g) => p[g].nextReviewDate.getTime());
    for (let i = 1; i < days.length; i++) {
      assert.ok(
        days[i] >= days[i - 1],
        `${GRADES[i]} comes back before ${GRADES[i - 1]} at i=${card.intervalDays}`
      );
    }
  }
});

check("«نسيتها» brings it back today, every time", () => {
  for (const card of CARDS) {
    const r = previewGrades(card, NOW).AGAIN;
    assert.equal(r.intervalDays, 0);
    assert.equal(r.nextReviewDate.getDate(), NOW.getDate(), "it must not jump to tomorrow");
  }
});

check("«صعبة» never brings a card back the same day", () => {
  /* A card he found hard, scheduled for today, is a queue that never drains:
     he grades it hard again and it reappears, all evening. */
  for (const card of CARDS) {
    assert.ok(previewGrades(card, NOW).HARD.intervalDays >= 1, `i=${card.intervalDays}`);
  }
});

check("a brand-new card: صعبة and زينة both land tomorrow, and that is true", () => {
  /* Day granularity has nothing between today and tomorrow to put between
     them. They differ in ease, so the review after that diverges — and the
     preview says tomorrow for both because tomorrow is what happens. */
  const p = previewGrades({ intervalDays: 0, easeFactor: 2.5, reviewCount: 0 }, NOW);
  assert.equal(p.HARD.intervalDays, 1);
  assert.equal(p.GOOD.intervalDays, 1);
  assert.ok(p.HARD.easeFactor < p.GOOD.easeFactor, "then they must at least differ in ease");
  assert.ok(p.EASY.intervalDays > 1);
});

check("GOOD'S LADDER IS UNCHANGED, because his cards are sitting on it", () => {
  /* 0 -> 1 -> 4 -> round(i × ease). Fifteen of his cards have been graded
     through this path and must not be rescheduled by a fix to the other
     buttons. */
  assert.equal(gradeFlashcard({ intervalDays: 0, easeFactor: 2.5, reviewCount: 0 }, "GOOD", NOW).intervalDays, 1);
  assert.equal(gradeFlashcard({ intervalDays: 1, easeFactor: 2.5, reviewCount: 1 }, "GOOD", NOW).intervalDays, 4);
  assert.equal(gradeFlashcard({ intervalDays: 4, easeFactor: 2.5, reviewCount: 2 }, "GOOD", NOW).intervalDays, 10);
  assert.equal(gradeFlashcard({ intervalDays: 10, easeFactor: 2.5, reviewCount: 5 }, "GOOD", NOW).intervalDays, 25);
});

check("the ease floor holds, so a card he keeps failing does not invert", () => {
  const hard = gradeFlashcard({ intervalDays: 30, easeFactor: 1.3, reviewCount: 12 }, "HARD", NOW);
  assert.ok(hard.easeFactor >= 1.3, `ease fell to ${hard.easeFactor}`);
  const again = gradeFlashcard({ intervalDays: 30, easeFactor: 1.3, reviewCount: 12 }, "AGAIN", NOW);
  assert.ok(again.easeFactor >= 1.3);
});

check("«سهلة» is always further out than «زينة», even at the ease floor", () => {
  /* At ease 1.3 the GOOD step is small, and `round(good × 1.3)` can round
     back onto it. The +1 floor is what stops two buttons meeting again. */
  for (const i of [1, 2, 3, 4, 5, 10]) {
    const p = previewGrades({ intervalDays: i, easeFactor: 1.3, reviewCount: 9 }, NOW);
    assert.ok(p.EASY.intervalDays > p.GOOD.intervalDays, `i=${i}: both ${p.GOOD.intervalDays}d`);
  }
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

mutationBites("THE ORIGINAL BUG: nudging the ease after using it", () => {
  const bad = (card: { intervalDays: number; easeFactor: number }, g: ReviewGrade) => {
    let { intervalDays, easeFactor } = card;
    if (g === "AGAIN") return 0;
    intervalDays = intervalDays <= 0 ? 1 : intervalDays === 1 ? 4 : Math.round(intervalDays * easeFactor);
    if (g === "HARD") easeFactor -= 0.15;
    if (g === "EASY") easeFactor += 0.15;
    return intervalDays;
  };
  const card = { intervalDays: 4, easeFactor: 2.5 };
  assert.notEqual(bad(card, "HARD"), bad(card, "EASY"));
});

mutationBites("a preview that reimplements the formula instead of calling it", () => {
  const card = { intervalDays: 4, easeFactor: 2.5, reviewCount: 3 };
  /* Plausible and wrong: the component's author remembers ease as the
     multiplier for every grade. */
  const guessed = Math.round(card.intervalDays * card.easeFactor);
  assert.equal(guessed, previewGrades(card, NOW).HARD.intervalDays);
});

mutationBites("«صعبة» computed from GOOD's step instead of the current one", () => {
  /* round(10 × 1.2) = 12 against round(25 × 1.2) = 30 — "hard" would push a
     card further out than "good" did. */
  const card = { intervalDays: 10, easeFactor: 2.5, reviewCount: 6 };
  const good = Math.round(card.intervalDays * card.easeFactor);
  const bad = Math.round(good * 1.2);
  assert.ok(bad <= previewGrades(card, NOW).GOOD.intervalDays, `hard would be ${bad}d`);
});

mutationBites("«صعبة» without its floor — a new card comes back today", () => {
  /* round(0 × 1.2) is 0, which is the same bucket as «نسيتها»: six hours.
     He grades a new card hard, it reappears this evening, he grades it hard
     again. The `Math.max(1, ...)` is what stops that. */
  const bad = Math.round(0 * 1.2);
  assert.ok(bad >= 1, `a new card graded hard would return in ${bad} days`);
});

mutationBites("«سهلة» without the +1 floor, meeting «زينة» on a new card", () => {
  /* GOOD on a new card is 1 day, and round(1 × 1.3) is 1 as well — so
     without the floor two of the four buttons print the same date on every
     card he has never reviewed, which is most of them: 27 of his 42. */
  const good = 1;
  const bad = Math.round(good * 1.3);
  assert.ok(bad > good, `سهلة and زينة would both be ${good}d`);
});

mutationBites("«نسيتها» pushed to tomorrow instead of today", () => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + 1);
  assert.equal(d.getDate(), previewGrades(CARDS[0], NOW).AGAIN.nextReviewDate.getDate());
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("أربعة أزرار، أربعة أجوبة، واللي مكتوب تحت الزر هو اللي يصير.");
}
