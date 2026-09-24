/**
 * "Nothing to review" while forty-two cards wait.
 *
 * This app schedules review in two places and the dashboard only ever asked
 * one of them.
 *
 *   Flashcard.nextReviewDate   the card's own schedule, advanced by answering
 *                              it. Defaults to now(), so a new card is due at
 *                              once. /flashcards reads this.
 *
 *   ReviewItem.scheduledDate   a five-stage chain created when a LECTURE is
 *                              completed, a gap resolved, or a problem answered
 *                              wrong. /review and the dashboard tile read this.
 *
 * Nothing creates a ReviewItem when a flashcard is created — the scheduler is
 * called from three places and making a card is not one of them, though its own
 * comment claims it "keeps REVIEW TODAY populated".
 *
 * Measured on the real account: 42 flashcards due, 42 of 42, and ReviewItem
 * empty — 0 rows, ever. The dashboard tile read 0. The page called Review said
 * "all caught up". Thirteen of the forty-two had ever been answered.
 *
 * That is the failure these checks exist for, and it is not a rendering
 * problem: every number on the screen was computed correctly from the wrong
 * table. So the checks below are about which tables are asked and how the
 * answers are combined — nothing here can pass by reading a plausible number
 * out of an empty one.
 *
 * Run: npx tsx scripts/verify-review-due.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dueFlashcardsWhere, dueReviewItemsWhere, totalDue } from "../src/lib/review-due";

let failures = 0;
function check(label: string, run: () => void) {
  try {
    run();
    console.log(`  ok  ${label}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL  ${label}\n        ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log("What is actually due for review\n");

const NOW = new Date("2026-09-23T12:00:00.000Z");

/* ── Both schedules are asked ──────────────────────────────────────────────── */

check("a card that is due by its own schedule counts", () => {
  const where = dueFlashcardsWhere("user_1", NOW);
  assert.equal(where.userId, "user_1", "the query is not scoped to a student");
  assert.deepEqual(where.nextReviewDate, { lte: NOW }, "due is not measured against now");
});

check("a chain review that is due counts", () => {
  const where = dueReviewItemsWhere("user_1", NOW);
  assert.equal(where.userId, "user_1", "the query is not scoped to a student");
  assert.deepEqual(where.scheduledDate, { lte: NOW }, "due is not measured against now");
  assert.deepEqual(where.status, { in: ["SCHEDULED", "DUE"] }, "a completed review would be counted again");
});

check("neither query runs without an owner", () => {
  // `{ userId: "" }` matches nothing today and everything the moment someone
  // makes the argument optional.
  assert.throws(() => dueFlashcardsWhere("", NOW), /whose/);
  assert.throws(() => dueReviewItemsWhere("", NOW), /whose/);
});

/* ── And they are not double-counted ───────────────────────────────────────── */

check("a chain review about a flashcard is left to the flashcard", () => {
  /* The subtlety. A ReviewItem carrying a flashcardId is the same piece of work
     as that card being due, so counting both reports two things to do where the
     student sees one card — and a number that overstates the pile is its own
     reason not to start. */
  const where = dueReviewItemsWhere("user_1", NOW);
  assert.equal(where.flashcardId, null, "a card would be counted twice: once as a card, once as a chain review");
});

check("the total is every distinct thing waiting", () => {
  assert.equal(totalDue({ flashcards: 42, reviewItems: 0 }), 42);
  assert.equal(totalDue({ flashcards: 0, reviewItems: 7 }), 7);
  assert.equal(totalDue({ flashcards: 42, reviewItems: 7 }), 49);
  assert.equal(totalDue({ flashcards: 0, reviewItems: 0 }), 0, "an empty pile is not a pile");
});

/* ── The bug itself, as the shape it had ───────────────────────────────────── */

check("forty-two due cards and an empty chain table is not zero", () => {
  /* The exact numbers measured in production. A total that reads 0 here is the
     dashboard saying "nothing to review" to a student holding forty-two cards,
     which is what it said. */
  assert.equal(
    totalDue({ flashcards: 42, reviewItems: 0 }),
    42,
    "the app would tell the student there is nothing to review"
  );
});

/* ── What the pages ask ────────────────────────────────────────────────────
 *
 * Asserted against the source, because the failure was never visible in a
 * rendered number: every number on the screen was computed correctly, from the
 * wrong table. The only place the guarantee lives is which query each page
 * issues.
 */

const DASHBOARD = readFileSync(new URL("../src/lib/dashboard.ts", import.meta.url), "utf8");
const VIEW = readFileSync(new URL("../src/components/dashboard/dashboard-view.tsx", import.meta.url), "utf8");
const HOME = readFileSync(new URL("../src/app/(app)/page.tsx", import.meta.url), "utf8");
const METRICS = readFileSync(new URL("../src/lib/home-metrics.ts", import.meta.url), "utf8");
const REVIEW = readFileSync(new URL("../src/app/(app)/review/page.tsx", import.meta.url), "utf8");

check("the figure Home shows is the combined total, not the chain alone", () => {
  /* This moved. It used to be a tile inside the dashboard's stat row and is
     now one of the four in Home's academic snapshot — the redesign took the
     duplicate out, because the same 42 was being printed twice on one page.
     The guarantee is unchanged and so is this check: whatever renders it must
     read `reviewsDueTotal`, which counts both tables, and must never read
     `reviewsDue.length`, which is chain reviews alone and was the original
     bug's exact shape. */
  assert.match(
    METRICS,
    /\["reviews", data\.reviewsDueTotal\]/,
    "the snapshot's reviews figure no longer comes from the combined total"
  );
  assert.ok(
    !/reviewsDue\.length/.test(METRICS),
    "the snapshot reads chain reviews alone — the shape of the original bug"
  );
  assert.match(
    HOME,
    /<AcademicSnapshot dict=\{dict\} data=\{data\} \/>/,
    "Home does not render the snapshot, so the figure reaches no screen"
  );
  /* And the dashboard must not quietly grow the duplicate back. */
  assert.ok(
    !/reviewsDueToday=/.test(VIEW),
    "the dashboard is printing the reviews total again alongside the snapshot"
  );
});

check("the dashboard computes that total from both tables", () => {
  assert.match(DASHBOARD, /reviewsDueTotal: totalDue\(/, "no combined total is computed");
  assert.match(DASHBOARD, /dueFlashcardsWhere\(/, "the dashboard never asks about flashcards");
  assert.match(DASHBOARD, /dueReviewItemsWhere\(/, "the dashboard does not use the shared chain predicate");
});

check("the review page asks about cards as well as chain reviews", () => {
  /* It is the page named Review. It showing nothing while forty-two cards were
     due is the single most misleading screen in the app. */
  assert.match(REVIEW, /prisma\.flashcard\.findMany/, "the review page still never looks at a flashcard");
  assert.match(REVIEW, /dueFlashcardsWhere\(/, "the review page does not use the shared predicate");
});

check("the review page's own count includes the cards", () => {
  // Rendering the cards while the header still says "0 due" would be a
  // half-fix that reads as a rendering glitch.
  assert.match(REVIEW, /due: rows\.length/, "the header counts chain reviews only");
  assert.ok(!/due: dueItems\.length/.test(REVIEW), "the header is back to counting one table");
});

check("every page uses the one shared definition of due", () => {
  /* Three places ask this question. Three hand-written date comparisons are
     three chances for them to disagree about what the student owes, and the
     student has no way to tell which one is lying. */
  for (const [name, body] of [["the dashboard", DASHBOARD], ["the review page", REVIEW]] as const) {
    assert.match(body, /from "@\/lib\/review-due"/, `${name} does not import the shared definition`);
  }
});

console.log("");
console.log(failures === 0 ? "Due means due, in both places it can be." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
