/**
 * Where the student is, checked without a deck to page through.
 *
 * Every rule here is a judgement that is easy to get wrong and almost
 * impossible to notice by using the product: a deck that quietly forgets where
 * you were looks like a deck you never opened, and a "continue" that lands one
 * slide past where you stopped looks like a "continue" that works. Both are the
 * kind of fault a student would feel as vague friction and never report.
 *
 * Run: npx tsx scripts/verify-study-position.ts
 */

import {
  advance,
  clampPage,
  continueWith,
  isResumable,
  POSITION_SAVE_DELAY_MS,
  positionOf,
  progressOf,
  recent,
  showsAsFinished,
  resumePage,
  type Deck,
  type Position,
} from "../src/lib/study-position";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) {
    failures++;
    console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

const T = (min: number) => new Date(2026, 8, 18, 12, min, 0);
const deck = (pageCount: number, position: Position | null, slideId = "d1"): Deck => ({ slideId, pageCount, position });

console.log("Study position\n");

/* ================================================ reading forwards ======== */
{
  let p = advance(null, 1, 40, T(0));
  check("a first open records page one", p.lastPage === 1 && p.furthestPage === 1);
  check("...and is not complete", p.completedAt === null);

  for (const page of [2, 5, 11, 18]) p = advance(p, page, 40, T(page));
  check("reading forwards moves both", p.lastPage === 18 && p.furthestPage === 18,
    `last ${p.lastPage}, furthest ${p.furthestPage}`);
  check("and records when", p.lastViewedAt.getTime() === T(18).getTime());
}

/* ============================== flicking back must not undo progress ====== */
// The rule that makes furthestPage exist at all. A student who jumps back to
// slide 4 to re-read a definition has not unlearned slides 5 to 18, and a
// system that says they have will also tell them they are further behind than
// they are — which is the one thing this product must never get wrong.
{
  let p = advance(null, 1, 40, T(0));
  for (const page of [5, 12, 18]) p = advance(p, page, 40, T(page));
  const before = p.furthestPage;
  p = advance(p, 4, 40, T(20));
  check("flicking back moves where you are", p.lastPage === 4);
  check("...and does NOT move how far you have been", p.furthestPage === before,
    `furthest went ${before} -> ${p.furthestPage}`);
  check("...and progress is unchanged", Math.abs(progressOf(deck(40, p)) - 18 / 40) < 1e-9);

  // ...and going forward again from there still only grows it.
  p = advance(p, 9, 40, T(21));
  check("and reading forward again from behind does not shrink it", p.furthestPage === 18);
  p = advance(p, 25, 40, T(22));
  check("...but passing the old mark does move it", p.furthestPage === 25);
}

/* ==================================================== completion ========== */
{
  let p = advance(null, 39, 40, T(0));
  check("not complete at the second-to-last page", p.completedAt === null);
  p = advance(p, 40, 40, T(1));
  check("complete on reaching the last page", p.completedAt !== null);
  const at = p.completedAt!.getTime();

  // Latches. Re-opening a finished deck at slide 2 does not un-finish it, and
  // being told it had would be absurd.
  p = advance(p, 2, 40, T(5));
  check("completion latches", p.completedAt !== null && p.completedAt.getTime() === at,
    "a finished deck cannot become unfinished by looking at it again");

  // A single-page document is complete the moment it is opened.
  const one = advance(null, 1, 1, T(0));
  check("a one-page document completes on open", one.completedAt !== null);

  // A deck whose page count is not known yet must not report completion.
  const unknown = advance(null, 1, 0, T(0));
  check("an unknown page count does not fake completion", unknown.completedAt === null);
}

/* ================================== what "continue" actually opens ======== */
// Deliberately the page they stopped ON. A student who left off part-way
// through a slide needs to see it again to pick the thread back up; skipping it
// makes them navigate backwards to find their place, which is the opposite of
// the feature.
{
  const stopped: Position = { lastPage: 18, furthestPage: 18, lastViewedAt: T(0), completedAt: null };
  check("continue opens the page you stopped on", resumePage(deck(40, stopped)) === 18,
    `got ${resumePage(deck(40, stopped))}`);
  check("...not the one after it", resumePage(deck(40, stopped)) !== 19);

  check("a deck never opened starts at one", resumePage(deck(40, null)) === 1);

  const done: Position = { lastPage: 40, furthestPage: 40, lastViewedAt: T(0), completedAt: T(0) };
  check("a deck you are standing at the end of reopens at the beginning", resumePage(deck(40, done)) === 1,
    "there is nowhere further to go, so opening it means going through it again");

  /* The flaw that only appeared by using it.
     An earlier version sent a finished deck to page 1 whatever the student had
     done since. So finishing a deck, coming back a week later and re-reading as
     far as page 2 put you back on page 1 every single time — the app forgot
     your place precisely because you had once been thorough. Completion is a
     fact about the past; it must not answer "where am I now". */
  const rereading: Position = { lastPage: 2, furthestPage: 40, lastViewedAt: T(9), completedAt: T(0) };
  check("a finished deck being re-read resumes where the re-read got to",
    resumePage(deck(40, rereading)) === 2, `got ${resumePage(deck(40, rereading))}`);
  check("...and is offered as something to continue", isResumable(deck(40, rereading)));

  /* A stored page beyond the document — a deck re-uploaded with fewer pages —
     must land somewhere real rather than on nothing. Past the end IS the end,
     and the end means start again, so this lands on page one; what matters is
     that it is a page that exists. */
  const beyond: Position = { lastPage: 99, furthestPage: 99, lastViewedAt: T(0), completedAt: null };
  const landed = resumePage(deck(12, beyond));
  check("a position past the end still lands on a real page", landed >= 1 && landed <= 12, `got ${landed}`);

  // ...and a position inside a shrunken document keeps its place.
  const inside: Position = { lastPage: 5, furthestPage: 99, lastViewedAt: T(0), completedAt: null };
  check("a position still inside the document is kept", resumePage(deck(12, inside)) === 5);
}

/* ================================== what the deck is labelled as ========= */
{
  const atEnd: Position = { lastPage: 40, furthestPage: 40, lastViewedAt: T(0), completedAt: T(0) };
  check("a finished deck still at its end reads as finished", showsAsFinished(deck(40, atEnd)));

  /* Stale is what makes a student stop trusting a screen. A deck gone all the
     way through, then re-opened and read as far as page two, was labelled
     "Finished" next to the word "Recent" — so the label now follows where they
     are rather than what they once did. */
  const rereading: Position = { lastPage: 2, furthestPage: 40, lastViewedAt: T(9), completedAt: T(0) };
  check("...but one being re-read does not", !showsAsFinished(deck(40, rereading)));

  const never: Position = { lastPage: 12, furthestPage: 12, lastViewedAt: T(0), completedAt: null };
  check("a deck never finished does not", !showsAsFinished(deck(40, never)));
  check("an unopened deck does not", !showsAsFinished(deck(40, null)));
}

/* ========================================= what is worth offering ======== */
{
  const one: Position = { lastPage: 1, furthestPage: 1, lastViewedAt: T(0), completedAt: null };
  check("a deck sitting on page one is not 'continue'", !isResumable(deck(40, one)),
    "offering to continue where a deck opens anyway is offering nothing");
  check("a deck never opened is not 'continue'", !isResumable(deck(40, null)));

  const done: Position = { lastPage: 40, furthestPage: 40, lastViewedAt: T(0), completedAt: T(0) };
  check("a deck sitting at its last page is not 'continue'", !isResumable(deck(40, done)),
    "there is nothing after the last page to continue to");
  // ...and that holds whether or not completion was ever recorded: what decides
  // it is where they are, not what the row remembers about last month.
  const atEndUnfinished: Position = { lastPage: 40, furthestPage: 40, lastViewedAt: T(0), completedAt: null };
  check("...with or without a completion date", !isResumable(deck(40, atEndUnfinished)));

  const mid: Position = { lastPage: 18, furthestPage: 18, lastViewedAt: T(0), completedAt: null };
  check("a deck stopped in the middle is", isResumable(deck(40, mid)));
}

/* ============================================ which deck to offer ======== */
{
  const decks: Deck[] = [
    deck(40, { lastPage: 18, furthestPage: 18, lastViewedAt: T(10), completedAt: null }, "vent"),
    deck(30, { lastPage: 25, furthestPage: 25, lastViewedAt: T(40), completedAt: null }, "cardio"),
    deck(20, { lastPage: 20, furthestPage: 20, lastViewedAt: T(50), completedAt: T(50) }, "finished"),
    deck(50, { lastPage: 1, furthestPage: 1, lastViewedAt: T(55), completedAt: null }, "just-opened"),
    deck(12, null, "never"),
  ];
  const pick = continueWith(decks);
  check("continue offers the most recent deck with somewhere to go", pick?.slideId === "cardio",
    `got ${pick?.slideId}`);
  check("...not the most recently touched overall", pick?.slideId !== "just-opened");
  check("...and not one already at its end", pick?.slideId !== "finished");
  check("nothing to continue is null, not a guess", continueWith([deck(12, null)]) === null);
  check("an empty studio is null", continueWith([]) === null);

  // Recent is a history: a deck finished yesterday is still what you were doing.
  const r = recent(decks);
  check("recent is newest first", r.map((d) => d.slideId).join(",") === "just-opened,finished,cardio,vent",
    r.map((d) => d.slideId).join(","));
  check("recent excludes what was never opened", !r.some((d) => d.slideId === "never"));
  check("recent includes finished decks", r.some((d) => d.slideId === "finished"));
  check("recent respects its limit", recent(decks, 2).length === 2);
}

/* ==================================================== arithmetic ========= */
{
  check("progress is zero for an unopened deck", progressOf(deck(40, null)) === 0);

  /* Where they are, and how far they have been, are different numbers — and a
     bar drawn from the wrong one sat at 100% beside "you stopped at page 2 of
     3", which reads as a bug even though both numbers were true. */
  const seenAll: Position = { lastPage: 2, furthestPage: 40, lastViewedAt: T(0), completedAt: T(0) };
  check("progress is how much has been seen", Math.abs(progressOf(deck(40, seenAll)) - 1) < 1e-9);
  check("position is where they are", Math.abs(positionOf(deck(40, seenAll)) - 2 / 40) < 1e-9);
  check("position is zero for an unopened deck", positionOf(deck(40, null)) === 0);
  check("position cannot exceed one",
    positionOf(deck(10, { lastPage: 99, furthestPage: 99, lastViewedAt: T(0), completedAt: null })) === 1);
  check("progress comes from furthest, not last",
    Math.abs(progressOf(deck(40, { lastPage: 2, furthestPage: 20, lastViewedAt: T(0), completedAt: null })) - 0.5) < 1e-9);
  check("progress cannot exceed one",
    progressOf(deck(10, { lastPage: 40, furthestPage: 40, lastViewedAt: T(0), completedAt: null })) === 1);
  check("a zero-page deck does not divide by zero",
    progressOf(deck(0, { lastPage: 1, furthestPage: 1, lastViewedAt: T(0), completedAt: null })) === 0);

  check("pages are clamped into the document", clampPage(0, 10) === 1 && clampPage(99, 10) === 10);
  check("a fractional page is floored to a real one", clampPage(7.8, 10) === 7);
  check("NaN does not become a page", clampPage(NaN, 10) === 1);
  check("a zero-page document still has a page one", clampPage(5, 0) === 1);

  // Writing on every page turn would be forty round trips for one deck read at
  // reading speed.
  check("saving is debounced, not per page turn", POSITION_SAVE_DELAY_MS >= 500);
}

if (failures) {
  console.error(`\n${failures} failing check(s).`);
  process.exit(1);
}
console.log(
  "  A deck remembers where it was left and reopens there, not one slide past it.\n" +
    "  Flicking back to check something never costs progress. Standing at the end\n" +
    "  means start again — but having once finished a deck does not, so a re-read\n" +
    "  keeps its place. 'Continue' offers the most recent deck that actually has\n" +
    "  somewhere left to go."
);
