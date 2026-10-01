/**
 * Which lecture is this concept actually taught in?
 *
 * THE FAILURE THIS COMES FROM, measured on the real account.
 *
 * Two courses held forty-six Topic rows and six Lecture rows. Every topic was
 * empty and every lecture was unfiled. The cause was not a filing bug: the
 * agent read a syllabus and wrote its concept outline into `Topic` — "PEEP",
 * "SWOT analysis", "Dead space and shunt" — while the schema means something
 * else by Topic. `Topic.lectures` is a list: a Topic CONTAINS lectures. So the
 * rows were written one level below where the schema expects them, and
 * `Lecture.topicId` then asked each lecture to pick the single Topic it
 * belongs under. A lecture covers dozens of concepts, so there was no single
 * answer, and the agent correctly picked none.
 *
 * The signature of that inversion is visible in one measurement: matching the
 * six lecture titles against the forty-six topic names gives 0, 0, 0, 0, 7 and
 * 2 matches. Never exactly one. A container relationship gives exactly one.
 *
 * So concepts stay at concept granularity — "do I know PEEP?" is a real
 * question and `Topic.masteryLevel` is the right home for its answer — and
 * what has to change is the edge: a lecture covers MANY concepts, and a
 * concept appears in MANY lectures. This module decides those links from the
 * one source that cannot be argued with: the text of the lecture the student
 * actually owns.
 *
 * HOW THE METHOD WAS ARRIVED AT, because two obvious versions are wrong and
 * the wrongness is invisible without measuring.
 *
 *   1. Substring search. Killed by one word: "standards" contains "ards", so
 *      probing for ARDS found the respiratory syndrome in a leadership deck
 *      about professional standards. Word boundaries fix it, and with them
 *      "ards" turns out to appear zero times in the whole corpus.
 *
 *   2. The fraction of a concept's words present in the lecture. Killed by
 *      saturation: measured over the real decks it matched 21 topics to the
 *      "Planning" lecture, 16 of them at 1.00, and put "Acute Respiratory
 *      Distress Syndrome" in the cardiovascular lecture at 0.60. Any nursing
 *      deck contains "nursing", "care", "management" and "process" somewhere
 *      in sixteen thousand characters, so presence carries almost no
 *      information.
 *
 *   3. What works: weigh each word by how RARE it is in this student's own
 *      corpus, and by how often it occurs. Measured across their four
 *      text-bearing lectures:
 *
 *          peep        1 of 4 lectures   ventilation x12
 *          budget      1 of 4            planning x6
 *          swot        1 of 4            planning x2
 *          delegation  1 of 4            management x1
 *          nursing     4 of 4            28 / 22 / 6 / 6
 *          care        4 of 4            everywhere
 *          management  4 of 4            everywhere
 *
 *      A word in one lecture out of four localises a concept exactly. A word
 *      in all four localises nothing, and gets a weight of exactly zero.
 *
 * The consequence worth noticing: there is NO hand-written stop-word list in
 * this file, and there must not be one. task-duplicate.ts needs a FILLER set
 * because it compares two short titles with no corpus to learn from. Here the
 * corpus IS the student's own material, so it decides for itself that
 * "nursing" is noise in a nursing degree — which no list written by a
 * programmer in another country could have known.
 *
 * No model is called. This is arithmetic over text the student already owns,
 * so it costs nothing, returns the same answer twice, and cannot invent a
 * link that the material does not support.
 */

/** A lecture's text, as one blob. `id` is whatever the caller keys on. */
export type TextUnit = { id: string; text: string };

/**
 * Words too structural to carry meaning anywhere, plus anything shorter than
 * three characters.
 *
 * Deliberately tiny, and deliberately free of academic or domain words. Every
 * word that is noise *in this student's field* is removed by the corpus
 * weighting below rather than by being listed here — see the module comment.
 * Adding "nursing" or "care" to this set would be the beginning of a list that
 * has to be rewritten for every degree.
 */
const STRUCTURAL = new Set([
  "and", "the", "for", "with", "its", "their", "are", "not", "from", "into",
  "that", "this", "than", "then", "when", "what", "which", "who", "whom",
]);

/** The words of a concept name that are worth looking for. */
export function significantWords(concept: string): string[] {
  const seen = new Set<string>();
  for (const w of concept.toLowerCase().split(/[^a-z0-9؀-ۿ]+/)) {
    if (w.length < 3) continue; // "of", "in", "vs", a stray "q" from "V/Q"
    if (STRUCTURAL.has(w)) continue;
    seen.add(w);
  }
  return [...seen];
}

/** Whole-word occurrences. The boundary is the whole reason "ards" is safe. */
export function occurrences(text: string, word: string): number {
  if (!word) return 0;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = text.toLowerCase().match(new RegExp(`\\b${escaped}\\b`, "g"));
  return matches ? matches.length : 0;
}

/**
 * How many units contain a word at all, and how many units there are.
 *
 * Built once per pass rather than per concept: forty-six concepts against six
 * lectures is two hundred and seventy-six lookups, and the same handful of
 * words recur across concept names.
 */
export type Corpus = {
  units: TextUnit[];
  /** word -> unit id -> occurrences. Only words that were asked about. */
  counts: Map<string, Map<string, number>>;
};

export function buildCorpus(units: TextUnit[]): Corpus {
  return { units, counts: new Map() };
}

function countsFor(corpus: Corpus, word: string): Map<string, number> {
  const cached = corpus.counts.get(word);
  if (cached) return cached;
  const row = new Map<string, number>();
  for (const unit of corpus.units) row.set(unit.id, occurrences(unit.text, word));
  corpus.counts.set(word, row);
  return row;
}

/**
 * How much it means that a word appeared here.
 *
 * `ln(N / df)`, the standard inverse document frequency, and the standard
 * choice is exactly right for the reason it is usually chosen: a word in every
 * unit gets `ln(1) = 0` and drops out of the arithmetic entirely rather than
 * being argued about. `df = 0` returns 0 — a word nothing contains cannot
 * distinguish anything.
 */
export function idf(corpus: Corpus, word: string): number {
  const row = countsFor(corpus, word);
  let df = 0;
  for (const n of row.values()) if (n > 0) df += 1;
  if (df === 0) return 0;
  return Math.log(corpus.units.length / df);
}

/**
 * Sublinear in the count.
 *
 * "peep" occurs twelve times in the ventilation deck and "delegation" once in
 * the management deck, and both localise their concept perfectly — so a linear
 * count, calling the first twelve times the stronger evidence, is saying
 * something the corpus does not support. `1 + ln(count)` keeps the ordering
 * while flattening it, and damps the advantage a longer document gets for
 * free: these decks differ by a factor of two in length.
 *
 * Stated honestly, because the mutation sweep checked: on this corpus,
 * swapping this for a linear count changes no link. It is standard practice
 * and it is the right shape as the corpus grows, but it is not load-bearing on
 * four documents, and no assertion in verify-concept-match.ts pretends
 * otherwise. What IS load-bearing is that frequency counts at all — replacing
 * this with a presence flag breaks a named test.
 */
function termWeight(count: number): number {
  return count > 0 ? 1 + Math.log(count) : 0;
}

/** What this unit's text says about this concept. Zero means silence. */
export function conceptScore(corpus: Corpus, unitId: string, concept: string): number {
  let score = 0;
  for (const word of significantWords(concept)) {
    const weight = idf(corpus, word);
    if (weight === 0) continue; // in every unit, or in none: no information
    score += weight * termWeight(countsFor(corpus, word).get(unitId) ?? 0);
  }
  return score;
}

/**
 * The floor a concept must clear before a link is written.
 *
 * Defined rather than tuned: it is exactly the weight of ONE occurrence of a
 * word that appears in only one unit — `idf = ln(N/1)`, times a term weight of
 * `1 + ln(1) = 1`. That is the weakest evidence in the corpus that still means
 * something, and on the real account it is a real case: "delegation" occurs
 * once, in one deck, and places its concept correctly.
 *
 * It has to be a function of the corpus, not a constant. Calibrated on four
 * lectures the number is 1.386; a student with twenty lectures has `ln(20) =
 * 3.0`, and a fixed 1.386 would quietly start accepting a third of the
 * evidence it was chosen to require. That failure would be invisible — more
 * links, all plausible-looking, none of them held to the standard the comment
 * claims.
 *
 * Everything below the floor is a concept assembled from words the student's
 * whole corpus shares, and no arithmetic over text can place it. Those are left
 * unlinked rather than guessed at: a missing link is visible and fixable, a
 * wrong one silently teaches the app that a respiratory syndrome is cardiology.
 */
export function linkFloor(corpus: Corpus): number {
  return corpus.units.length > 1 ? Math.log(corpus.units.length) : 0;
}

export type Link = { unitId: string; score: number; runnerUp: number };

/**
 * Where this concept is taught, if the text can say.
 *
 * Highest score wins, rather than "every unit above a threshold" — that was
 * version 2 above, and it linked twenty-one concepts to one lecture. A concept
 * genuinely does appear in several lectures, but the one that teaches it is
 * the one that talks about it most, and the runner-up is returned so a caller
 * can see how close the decision was.
 */
export function bestUnitFor(corpus: Corpus, concept: string): Link | null {
  let best: Link | null = null;
  let second = 0;
  for (const unit of corpus.units) {
    const score = conceptScore(corpus, unit.id, concept);
    if (!best || score > best.score) {
      second = best ? best.score : 0;
      best = { unitId: unit.id, score, runnerUp: 0 };
    } else if (score > second) {
      second = score;
    }
  }
  if (!best || best.score < linkFloor(corpus)) return null;
  return { ...best, runnerUp: second };
}

/**
 * The test that proves `Topic` is being used as a container or as a concept.
 *
 * Under the container reading the schema has, each lecture sits under exactly
 * one Topic, so matching a lecture's own title against the topic names should
 * find exactly one. On the real account it finds 0, 0, 0, 0, 7 and 2. This
 * returns that count so a verify script can hold the invariant after the
 * repair and fail if concept-level rows start arriving in `Topic` again.
 */
export function containerFit(lectureTitle: string, topicNames: string[]): number {
  const title = new Set(significantWords(lectureTitle));
  if (title.size === 0) return 0;
  let fits = 0;
  for (const name of topicNames) {
    const words = significantWords(name);
    if (words.length === 0) continue;
    let shared = 0;
    for (const w of words) if (title.has(w)) shared += 1;
    if (shared / Math.min(words.length, title.size) >= 0.6) fits += 1;
  }
  return fits;
}
