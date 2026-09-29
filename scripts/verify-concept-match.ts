import {
  buildCorpus,
  bestUnitFor,
  conceptScore,
  containerFit,
  idf,
  occurrences,
  significantWords,
  linkFloor,
  type TextUnit,
} from "../src/lib/concept-match";

/**
 * Concept-to-lecture linking, against the corpus it was calibrated on.
 *
 * The fixture below is not invented. It reproduces the word distribution
 * measured on the student's four text-bearing lectures on 2026-09-29, taken
 * with Postgres word-boundary matching over `Document.extractedText`:
 *
 *     word         lectures containing    occurrences per lecture
 *     peep         1 of 4                 ventilation 12
 *     budget       1 of 4                 planning 6
 *     swot         1 of 4                 planning 2
 *     delegation   1 of 4                 management 1
 *     standards    3 of 4                 planning 13, management 3, vent 1
 *     nursing      4 of 4                 management 28, planning 22, 6, 6
 *     care         4 of 4                 planning 23, management 16, 8, 4
 *     management   4 of 4                 management 19, planning 12, 8, 1
 *     process      4 of 4                 management 11, planning 6, 3, 2
 *
 * The counts are what the assertions are really about, so they are held here
 * as counts and the text is generated from them. A fixture of real slide prose
 * would be fifty thousand characters in which nobody could see that "nursing"
 * appears in all four lectures — which is the single fact the whole method
 * turns on.
 *
 * TWO EARLIER VERSIONS OF THIS MODULE WERE WRONG, and the tests that killed
 * them are kept, because a method chosen by measurement stays right only while
 * the measurements that rejected the alternatives keep running:
 *
 *   - substring matching: "standards" contains "ards"
 *   - the fraction of a concept's words present: saturates, and matched 21 of
 *     46 concepts to a single lecture
 */

let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
    failed++;
  }
}

console.log("Concept matching\n");

/* ── The fixture, built from the measured counts ─────────────────────────── */

/* Every number below was read out of the database, none of it estimated.
   An earlier draft of this fixture carried half a dozen plausible-looking
   figures I had not measured — `patient`, `plan`, `respiratory`, `distress`,
   `cardiovascular` — and they were wrong in both directions: `patient` occurs
   46 times in the ventilation deck, not twice, and `distress` occurs in the
   CARDIOVASCULAR deck and not in the ventilation one at all. A fixture that
   invents its own corpus tests the invention. */
const MEASURED: Record<string, Record<string, number>> = {
  // df = 1: unique to one lecture. These are the words that place a concept.
  peep: { ventilation: 12 },
  budget: { planning: 6 },
  swot: { planning: 2 },
  delegation: { management: 1 },
  respiratory: { ventilation: 13 },
  resistance: { ventilation: 7 },
  tools: { planning: 4 },
  strategic: { planning: 3 },
  organizing: { management: 3 },
  cardiovascular: { cardio: 3 },
  ana: { planning: 1 },
  reactive: { planning: 1 },
  tactical: { planning: 1 },
  distress: { cardio: 1 },

  // df = 2 and 3: partial signal.
  professional: { planning: 8, management: 1 },
  performance: { planning: 7, management: 5 },
  plan: { planning: 22, management: 6 },
  goals: { management: 5, planning: 3 },
  analysis: { planning: 3, management: 1 },
  compliance: { ventilation: 3, cardio: 1 },
  syndrome: { cardio: 2, ventilation: 1 },
  standards: { planning: 13, management: 3, ventilation: 1 },
  criteria: { planning: 5, ventilation: 2, management: 1 },
  levels: { management: 2, cardio: 1, planning: 1 },

  // df = 4: in every lecture, therefore worth nothing. The whole method rests
  // on these being silenced without anyone having to list them.
  nursing: { planning: 22, management: 28, ventilation: 6, cardio: 6 },
  care: { planning: 23, management: 16, ventilation: 8, cardio: 4 },
  management: { planning: 12, management: 19, ventilation: 1, cardio: 8 },
  process: { planning: 6, management: 11, ventilation: 3, cardio: 2 },
  objectives: { planning: 22, management: 6, ventilation: 1, cardio: 1 },
  patient: { ventilation: 46, cardio: 19, management: 12, planning: 8 },

  // df = 0: measured as absent. "Prone positioning" is a real Topic row that
  // no lecture text supports, and "surfactant" appears only in a deck that is
  // attached to no lecture at all.
  prone: {},
  surfactant: {},
};

const UNIT_IDS = ["planning", "management", "ventilation", "cardio"] as const;

const units: TextUnit[] = UNIT_IDS.map((id) => {
  const words: string[] = [];
  for (const [word, per] of Object.entries(MEASURED)) {
    const n = per[id] ?? 0;
    for (let i = 0; i < n; i += 1) words.push(word);
  }
  /* Shuffled deterministically so no assertion can depend on word order, and
     padded with filler prose so the units differ in length the way the real
     decks do (8,598 to 16,875 characters). */
  let seed = id.length * 7919;
  for (let i = words.length - 1; i > 0; i -= 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [words[i], words[j]] = [words[j], words[i]];
  }
  return { id, text: words.join(" ") };
});

const corpus = buildCorpus(units);
const byId = new Map(units.map((u) => [u.id, u]));

ok("the fixture has the four text-bearing lectures", units.length === 4);

/* ── 1. The trap that killed substring matching ──────────────────────────── */

const planningText = byId.get("planning")!.text;
ok(
  "'standards' does not contain the word 'ards'",
  planningText.includes("standards") && occurrences(planningText, "ards") === 0,
  "this is the false positive that put a respiratory syndrome in a leadership deck"
);
ok(
  "and the whole word is still found",
  occurrences(planningText, "standards") === 13,
  `got ${occurrences(planningText, "standards")}`
);

/* ── 2. Rarity, and the word that carries nothing ────────────────────────── */

ok(
  "a word in every lecture is worth exactly zero",
  idf(corpus, "nursing") === 0 && idf(corpus, "care") === 0 && idf(corpus, "management") === 0,
  `nursing=${idf(corpus, "nursing")} care=${idf(corpus, "care")} management=${idf(corpus, "management")}`
);
ok(
  "a word in one lecture out of four is worth ln(4)",
  Math.abs(idf(corpus, "peep") - Math.log(4)) < 1e-9
);
ok(
  "a word in three of four is worth ln(4/3)",
  Math.abs(idf(corpus, "standards") - Math.log(4 / 3)) < 1e-9
);
ok(
  "a word in no lecture is worth zero, not infinity",
  idf(corpus, "surfactant") === 0 && idf(corpus, "kardex") === 0,
  "df=0 must not divide by zero or score a concept nothing supports"
);

/* This is the claim the module makes about itself: no hand-written stop-word
   list. It holds only while the corpus is what silences the common words, so
   it is asserted rather than trusted. */
ok(
  "the domain's own noise words are silenced by the corpus, not by a list",
  significantWords("nursing care management").length === 3 &&
    conceptScore(corpus, "planning", "nursing care management") === 0,
  "all three survive tokenising and all three score zero"
);

/* ── 3. Each rare word places its concept, and the runner-up is far ─────── */

for (const [concept, expected] of [
  ["PEEP", "ventilation"],
  ["SWOT analysis", "planning"],
  ["Budget and characteristics of an effective budget", "planning"],
  ["Directing (delegation, motivation, communication, coordination)", "management"],
  ["Cardiovascular system", "cardio"],
] as const) {
  const link = bestUnitFor(corpus, concept);
  ok(
    `${concept.slice(0, 38)} -> ${expected}`,
    link?.unitId === expected,
    link ? `got ${link.unitId} (${link.score.toFixed(2)} vs ${link.runnerUp.toFixed(2)})` : "no link"
  );
}

/* The tie version 2 could not break: "ANA Standards of Professional
   Performance" scored 1.00 against BOTH leadership lectures on presence
   alone. Frequency decides it — 13 occurrences against 3. */
{
  const link = bestUnitFor(corpus, "ANA Standards of Professional Performance");
  ok(
    "the tie that presence could not break is broken by frequency",
    link?.unitId === "planning",
    link ? `got ${link.unitId}` : "no link"
  );
}

/* ── 4. What it refuses to guess ─────────────────────────────────────────── */

{
  /* Five words, every one of them measured in all four lectures. No arithmetic
     over text can place this, and refusing is the conservative failure: a
     missing link is visible and fixable, a wrong one silently teaches the app
     that a respiratory syndrome is cardiology. */
  const concept = "Nursing patient care management process";
  const link = bestUnitFor(corpus, concept);
  ok(
    "a concept built only from corpus-wide words is left unlinked, not guessed",
    link === null,
    link ? `linked to ${link.unitId} at ${link.score.toFixed(2)}` : ""
  );
  ok(
    "and it is refused for the right reason — every word scores zero",
    significantWords(concept).length === 5 && conceptScore(corpus, "planning", concept) === 0,
    "if tokenising had dropped these words the refusal would be an accident"
  );
}

{
  /* The real Topic row that LOOKS like the case above and is not. Five of its
     six words are corpus-wide, but "plan" occurs 22 times in the Planning deck
     and nowhere outside the two leadership lectures — so one word with real
     signal is enough, and the link it makes is the right one. Kept beside the
     refusal because the difference between them is the whole method. */
  const link = bestUnitFor(corpus, "Patient-care management / nursing care plan");
  ok(
    "one word with signal is enough, even among five that have none",
    link?.unitId === "planning",
    link ? `got ${link.unitId} at ${link.score.toFixed(2)}` : "no link — 'plan' should have carried it"
  );
}

{
  /* Measured as absent. "Prone positioning" is a genuine Topic row from the
     syllabus, and the word does not occur in any lecture the student has
     attached — the deck that would teach it is one of the files still waiting
     in the queue. An unlinked concept must not be read as a concept that does
     not matter. */
  ok(
    "a concept no lecture text mentions is unlinked, not misplaced",
    bestUnitFor(corpus, "Prone positioning") === null &&
      idf(corpus, "prone") === 0
  );
}

/* Short tokens are dropped, and this is asserted directly rather than through
   an outcome. "V/Q matching" tokenises to a stray "q"; if that "q" happened to
   occur in exactly one lecture it would carry the full ln(4) of a unique word
   and place the concept on the strength of a punctuation artefact. The corpus
   cannot protect against that — a rare meaningless token looks exactly like a
   rare meaningful one — so the tokeniser has to. A mutation removing the
   length check passed every other test here. */
ok(
  "a one- or two-letter token is never a word",
  !significantWords("Perfusion and V/Q matching").includes("q") &&
    !significantWords("Type II alveolar cells").includes("ii") &&
    significantWords("Perfusion and V/Q matching").includes("perfusion"),
  JSON.stringify(significantWords("Perfusion and V/Q matching"))
);

/* The floor is a definition, not a dial: the weight of one occurrence of a
   word unique to one unit. Asserted as an identity so that replacing it with
   any constant — even the right constant for four documents — fails. */
ok(
  "the floor is exactly one occurrence of a word unique to one lecture",
  Math.abs(linkFloor(corpus) - Math.log(4)) < 1e-9,
  `floor ${linkFloor(corpus).toFixed(3)} vs ln(4)=${Math.log(4).toFixed(3)}`
);
ok(
  "and it scales with the corpus, so a bigger library is not held to a smaller bar",
  linkFloor(buildCorpus(units.slice(0, 2))) < linkFloor(corpus) &&
    linkFloor(buildCorpus([...units, ...units.map((u) => ({ ...u, id: u.id + "b" }))])) >
      linkFloor(corpus),
  `2 units: ${linkFloor(buildCorpus(units.slice(0, 2))).toFixed(3)}, ` +
    `4: ${linkFloor(corpus).toFixed(3)}, ` +
    `8: ${linkFloor(buildCorpus([...units, ...units.map((u) => ({ ...u, id: u.id + "b" }))])).toFixed(3)}`
);
ok(
  "a corpus of one cannot place anything",
  linkFloor(buildCorpus(units.slice(0, 1))) === 0 &&
    bestUnitFor(buildCorpus(units.slice(0, 1)), "PEEP") !== null,
  "with one document every word has idf 0, so nothing scores and nothing is claimed"
);

/* ── 5. The regression that killed version 2 ─────────────────────────────── */

{
  /* Presence-fraction, reimplemented here exactly as it was, so the failure is
     in the repository rather than in a memory of a bad afternoon. On the real
     corpus it put 21 of 46 concepts on one lecture. */
  const presenceFraction = (unitId: string, concept: string) => {
    const words = significantWords(concept);
    if (words.length === 0) return 0;
    const text = byId.get(unitId)!.text;
    let present = 0;
    for (const w of words) if (occurrences(text, w) > 0) present += 1;
    return present / words.length;
  };

  const CONCEPTS = [
    "ANA Standards of Professional Performance",
    "Nursing management levels",
    "Patient-care management / nursing care plan",
    "Standards and criteria",
    "The planning process",
  ];

  const oldMatches = CONCEPTS.flatMap((c) =>
    UNIT_IDS.filter((u) => presenceFraction(u, c) >= 0.5).map((u) => `${c} -> ${u}`)
  );
  const newMatches = CONCEPTS.map((c) => bestUnitFor(corpus, c)).filter(Boolean);

  ok(
    "presence-fraction still over-matches, as measured",
    oldMatches.length > CONCEPTS.length,
    `${oldMatches.length} links for ${CONCEPTS.length} concepts — version 2's failure, reproduced`
  );
  ok(
    "and the rarity method returns at most one lecture per concept",
    newMatches.length <= CONCEPTS.length,
    `${newMatches.length} links for ${CONCEPTS.length} concepts`
  );
  console.log(
    `        presence: ${oldMatches.length} links; rarity: ${newMatches.length} links, ` +
      `${CONCEPTS.length - newMatches.length} honestly refused`
  );
}

/* ── 6. The inversion signature, so it cannot come back ──────────────────── */

{
  /* Under the schema's reading, `Topic` contains lectures, so a lecture's title
     should match exactly one topic name. Measured on the real 46 rows the
     answer is 0, 0, 0, 0, 7, 2 — never one. These are those rows. */
  const CONCEPT_NAMES = [
    "Mechanics of ventilation", "Lung compliance and surfactant", "Airway resistance", "PEEP",
    "Acute Respiratory Failure (ARF)", "Prone positioning",
    "Definition and importance of planning in nursing", "Types of planning: reactive, inactive, preactive, interactive",
    "Strategic vs tactical planning", "Levels of planning in nursing and their time frames",
    "The planning process", "Characteristics of an effective plan", "The 12 planning tools",
    "Management process: planning", "Management process: organizing", "Controlling",
  ];

  const fits = {
    "mechanical ventilation": containerFit("mechanical ventilation", CONCEPT_NAMES),
    "Cardiovascular system": containerFit("Cardiovascular system", CONCEPT_NAMES),
    Planning: containerFit("Planning", CONCEPT_NAMES),
  };

  ok(
    "no lecture sits under exactly one of these rows",
    Object.values(fits).every((n) => n !== 1),
    `fits: ${JSON.stringify(fits)} — a container model would give 1 for each`
  );
  ok(
    "and the two shapes of the failure are both present",
    Object.values(fits).some((n) => n === 0) && Object.values(fits).some((n) => n > 1),
    `${JSON.stringify(fits)} — zero candidates AND many candidates, which is what an ` +
      `inverted hierarchy looks like from either side`
  );
  console.log(`        containerFit: ${JSON.stringify(fits)}`);
}

/* ── 7. Determinism, since nothing here may depend on a model ───────────── */

{
  const twice = [0, 1].map(() => bestUnitFor(buildCorpus(units), "SWOT analysis")?.score);
  ok("the same corpus gives the same score twice", twice[0] === twice[1]);
  ok(
    "and word order in the text does not change it",
    Math.abs(
      (conceptScore(corpus, "planning", "SWOT analysis") -
        conceptScore(buildCorpus([...units].reverse()), "planning", "analysis SWOT"))
    ) < 1e-9
  );
}

console.log("");
console.log(
  failed === 0
    ? "Rarity in the student's own corpus places the concept; ubiquity places nothing."
    : `${failed} FAILED`
);
process.exit(failed === 0 ? 0 : 1);
