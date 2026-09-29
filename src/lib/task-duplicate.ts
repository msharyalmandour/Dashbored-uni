/**
 * Is this task the one the student already has, written differently?
 *
 * THE FAILURE THIS COMES FROM, measured on the real account.
 *
 * One course, NURP (432), held twenty-one tasks. Eleven were real; the other
 * ten were those same eleven imported a second time, thirty seconds later.
 * Every pair shared a deadline and a type and described the same piece of
 * work, and not one pair shared a title:
 *
 *     30-day staffing Rota + staff motivation plan
 *     Develop 30-day Staffing Rota and Motivation plan for staff nurses
 *
 *     Reflection paper — Simulation 1
 *     Simulation reflection paper (W12)
 *
 *     Final OSPE — Clinical Leadership and Management (40%)
 *     Final OSPE – Clinical Leadership and Management (NURP 432)
 *
 * `createTask` already had a guard, and its comment said the right thing —
 * "matching on title and day rather than on the whole row is what catches it,
 * since the second read is rarely character-identical". The code underneath
 * used `equals`, which is character-identical. The comment described a
 * tolerance the implementation did not have, so the guard fired only in the
 * case where it was not needed, and the student was left to work out which of
 * two entries was real, ten times over.
 *
 * WHAT THIS DOES, AND WHY IT IS FOUR GUARDS RATHER THAN ONE SCORE.
 *
 * The obvious design is a similarity score with a threshold. Measured against
 * the real corpus, that design does not work, and the measurement is the
 * reason this file is shaped the way it is. Word overlap scores
 *
 *     Final OSPE — Clinical Leadership (NURP 431)
 *     Final OSPE — Clinical Leadership (NURP 432)
 *
 * at 0.83 — higher than seven of the ten genuine duplicates. Two different
 * courses' final exams are, as text, more alike than a duplicate pair is.
 * There is no threshold that separates them, so no amount of tuning one
 * would have helped, and a score alone would have merged two real exams to
 * catch a duplicate.
 *
 * So four independent things must all agree, and each rejects on its own:
 *
 *   1. TYPE. A reading and a reflection on the same material are two pieces
 *      of work with two deadlines.
 *   2. DAY. Two unrelated tasks rarely share one, and a re-import that moved
 *      a deadline is safer left as two rows than silently merged into one.
 *   3. INDEX. A number that identifies *which* one — Simulation 1 against
 *      Simulation 2, W12 against W13, NURP 431 against 432 — settles the
 *      question before any word is compared. `differentIndex` below.
 *   4. WORDS. Only once the first three allow it does overlap decide, on the
 *      words that carry meaning.
 *
 * WHAT IT DOES NOT CATCH, stated because a guard whose limits are undocumented
 * gets trusted past them. One of the ten real pairs is out of reach:
 *
 *     Comparing job description of Head Nurse and Team Leader
 *     Weekly clinical assignment: Staff allocation, Shift report, Kardex
 *       + HN vs TL job description comparison
 *
 * They share two words out of seven (0.29). One title abbreviates what the
 * other spells out and adds three more deliverables. No word-overlap rule
 * reaches that, and the threshold that would reach it would merge the two
 * OSPEs above. It is a miss on purpose: nine of ten caught, and the tenth
 * left as two rows the student can see and delete, rather than a rule that
 * quietly destroys a deadline. scripts/verify-task-duplicate.ts holds the
 * whole corpus and asserts this miss, so that a future change claiming to
 * fix it has to show what else it merges.
 *
 * It is deliberately NOT clever. No edit distance, no embeddings — a rule a
 * person can read, predict and argue with, with every number in it measured.
 */

/**
 * Words that appear in academic task titles regardless of what the task is.
 *
 * Dropped before comparing, because they inflate the overlap between two
 * unrelated assignments — "assignment", "submission" and "paper" would make
 * any two pieces of coursework look alike. Kept deliberately short: every
 * addition makes the comparison blunter, and a word that distinguishes two
 * real tasks must never be in here.
 */
const FILLER = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "with", "vs",
  "assignment", "submission", "paper", "work", "group", "plan", "form", "task",
]);

/** `&amp;` and friends, which arrive from scraped syllabi and are not words. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#3[49];/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/**
 * The words a title is actually about.
 *
 * Single letters go — an initial or a stray bullet is not a word. Numbers
 * stay whatever their length: "Simulation 1" is about the 1. They are not
 * what separates it from "Simulation 2" (guard 3 does that, and has to,
 * because one title can number the simulation while the other numbers the
 * week) but a number is part of what a title says, and dropping it would
 * make the two siblings textually identical.
 */
export function meaningfulWords(title: string): Set<string> {
  const cleaned = decodeEntities(title)
    .toLowerCase()
    /* Everything that is not a letter, a digit or Arabic becomes a break.
       That covers the hyphen in "Pre-reading", the en dash and em dash that
       separated two of the real pairs, and the slash in "delivery system /
       patient classification". */
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ");

  const words = cleaned
    .split(" ")
    .filter((w) => w && !FILLER.has(w) && (w.length > 1 || /^[0-9]$/.test(w)));
  return new Set(words);
}

/**
 * Week numbers, as their own namespace.
 *
 * "W12" and "Week 12" are the same marker written two ways, and both appeared
 * in the real syllabus. They are kept apart from plain numbers because the two
 * schemes are not comparable: "Simulation 1" and its duplicate "(W12)" carry
 * disjoint numbers and are the same task, so comparing 1 against 12 would
 * reject nine of the ten pairs. Week against week, number against number.
 */
function weekIndex(title: string): Set<string> {
  const out = new Set<string>();
  for (const m of decodeEntities(title).toLowerCase().matchAll(/\bw(?:eek)?\s*(\d+)\b/g)) {
    out.add(m[1]);
  }
  return out;
}

/**
 * Numbers that say *which* one, excluding the ones that say how much.
 *
 * A percentage is a grade weight, not an identity — the real corpus had one
 * title ending "(40%)" and its duplicate ending "(NURP 432)", and treating 40
 * as an index would have made them disjoint and rejected a true duplicate.
 * Week markers are excluded here and handled above.
 */
function plainIndex(title: string): Set<string> {
  const out = new Set<string>();
  for (const m of decodeEntities(title).toLowerCase().matchAll(/(\bw(?:eek)?\s*)?\b(\d+)\b\s*(%?)/g)) {
    if (m[1]) continue; // a week marker; belongs to the other namespace
    if (m[3] === "%") continue; // a weight, not an index
    out.add(m[2]);
  }
  return out;
}

/** Two non-empty index sets that share nothing name two different things. */
function disjoint(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false; // no signal either way
  for (const x of a) if (b.has(x)) return false;
  return true;
}

/**
 * Whether the two titles are numbered differently, in either scheme.
 *
 * This is the guard that makes the whole rule safe to run, and it is worth
 * being precise about why. Word overlap puts "Simulation 1" against
 * "Simulation 2" at 0.75 and the two courses' OSPEs at 0.83 — both above any
 * threshold that catches the real duplicates. Numbering is what tells them
 * apart, and it does so without a threshold at all.
 *
 * Silence is not evidence: when only one side carries a number, this says
 * nothing and the words decide.
 */
export function differentIndex(a: string, b: string): boolean {
  return disjoint(plainIndex(a), plainIndex(b)) || disjoint(weekIndex(a), weekIndex(b));
}

/**
 * Overlap as a fraction of the SMALLER set.
 *
 * Not Jaccard, and the difference is the whole point. "Reflection paper —
 * Simulation 1" against "Simulation reflection paper (W12)" is a short title
 * against a longer one that says the same thing plus a week number; Jaccard
 * punishes the extra words and scores it 0.5, while containment sees that
 * nearly everything the short title says is present in the long one. A second
 * import elaborating on the first is the exact shape of this failure.
 */
export function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

/**
 * The threshold, and the gap it sits in.
 *
 * Measured over the real corpus, among pairs that type, day and index have
 * already allowed: the lowest containment on a genuine duplicate is 0.67, and
 * the highest on two tasks that are genuinely different is 0.50 ("Problem
 * solving form (with evidence) + Leadership checklist" against
 * "Problem-Solving Project submission (group, 10%)"). 0.6 sits between them.
 *
 * The gap exists only because the first three guards ran first — on raw
 * containment the highest non-duplicate is 0.83. verify-task-duplicate.ts
 * asserts both bounds, so an edit that closes the gap fails rather than
 * silently merging two real deadlines.
 */
export const SAME_TASK_AT = 0.6;

export type TaskLike = { title: string; type: string; deadline: Date };

/** Same calendar day, in the deadline's own terms. */
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Whether `candidate` is `existing` said again.
 *
 * All four guards are required, and each one is load-bearing on the real
 * corpus — the verify script names the cases that only that guard rejects.
 * The order is cheapest first; it does not affect the answer.
 */
export function looksLikeSameTask(candidate: TaskLike, existing: TaskLike): boolean {
  if (candidate.type !== existing.type) return false;
  if (!sameDay(candidate.deadline, existing.deadline)) return false;
  if (differentIndex(candidate.title, existing.title)) return false;
  return (
    overlap(meaningfulWords(candidate.title), meaningfulWords(existing.title)) >= SAME_TASK_AT
  );
}
