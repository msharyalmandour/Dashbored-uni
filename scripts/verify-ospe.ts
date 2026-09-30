/**
 * Scoring a performed-exam station, and choosing what to practise.
 *
 * The checklist below is a real one: the twelve steps of nasogastric tube
 * insertion as a nursing OSPE marks them, with the two steps whose omission
 * fails the station on its own — confirming placement before anything is
 * instilled, and identifying the patient. Both are killer steps in every
 * version of this checklist, for the same reason: getting them wrong harms
 * someone.
 *
 * It is here rather than as `step1..step12` because the whole claim this
 * module makes is that a percentage is the wrong answer, and that claim is
 * only legible against a checklist where you can see WHICH step was missed.
 * Eleven of twelve is 92%, and if the missing one is placement confirmation it
 * is a fail — that case is the first test below and it is the reason the file
 * exists.
 *
 * There are ZERO recorded attempts in the database. Nothing here is derived
 * from the student's behaviour and nothing pretends to be: these assert a
 * marking rule and an ordering, both of which are stated as conventions in
 * ospe.ts. When real attempts exist, the ordering is what to re-examine.
 *
 * Run: npx tsx scripts/verify-ospe.ts
 */

import { score, practiceOrder, watchSteps, MINOR_MISS_ALLOWANCE, type Step } from "../src/lib/ospe";

let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
    failed++;
  }
}

console.log("OSPE station scoring\n");

/* ── Nasogastric tube insertion, as marked ────────────────────────────────── */

const step = (id: string, order: number, text: string, critical = false): Step => ({
  id,
  order,
  text,
  critical,
});

const NG: Step[] = [
  step("s1", 1, "Identify the patient using two identifiers", true),
  step("s2", 2, "Explain the procedure and obtain consent"),
  step("s3", 3, "Perform hand hygiene and apply gloves"),
  step("s4", 4, "Position the patient in high Fowler's"),
  step("s5", 5, "Measure NEX (nose to earlobe to xiphoid)"),
  step("s6", 6, "Mark the measured length on the tube"),
  step("s7", 7, "Lubricate the tip with water-soluble gel"),
  step("s8", 8, "Insert along the floor of the nostril"),
  step("s9", 9, "Ask the patient to swallow as the tube advances"),
  step("s10", 10, "Confirm placement before instilling anything", true),
  step("s11", 11, "Secure the tube to the nose"),
  step("s12", 12, "Document the procedure and the length inserted"),
];

const CRITICALS = NG.filter((s) => s.critical).length;
const MINORS = NG.length - CRITICALS;

ok("the fixture has both kinds of step, or nothing below is testing anything",
  CRITICALS === 2 && MINORS === 10, `${CRITICALS} critical, ${MINORS} minor`);

/* ── The rule the whole module exists for ─────────────────────────────────── */

{
  // Eleven of twelve correct. A quiz app reports 92% and a green tick.
  const result = score(NG, { missedStepIds: ["s10"] });
  ok("missing placement confirmation fails the station, at 92% correct",
    result === "FAIL_CRITICAL", result);

  const identity = score(NG, { missedStepIds: ["s1"] });
  ok("missing patient identification fails the station", identity === "FAIL_CRITICAL", identity);
}

{
  // And the converse, which is what stops the rule from being "fail everything":
  // a clean run of the same checklist passes.
  ok("a complete attempt passes", score(NG, { missedStepIds: [] }) === "PASS");
}

{
  // A critical miss is not diluted by checklist length. This is the arithmetic
  // a percentage does, and the reason score() does not return one: bolt forty
  // trivial steps onto the end and 1/42 missed looks like 97.6%.
  const padded: Step[] = [
    ...NG,
    ...Array.from({ length: 30 }, (_, i) => step(`pad${i}`, 100 + i, `Ancillary step ${i}`)),
  ];
  ok("a long checklist cannot dilute a missed critical step",
    score(padded, { missedStepIds: ["s10"] }) === "FAIL_CRITICAL");
}

/* ── Minor steps, and where the boundary falls ────────────────────────────── */

{
  // Ten minor steps, allowance 0.2, so two may go and three may not.
  const two = score(NG, { missedStepIds: ["s2", "s3"] });
  const three = score(NG, { missedStepIds: ["s2", "s3", "s4"] });
  ok("missing exactly the allowance still passes", two === "PASS",
    `${MINORS} minor steps, allowance ${MINOR_MISS_ALLOWANCE}, got ${two}`);
  ok("missing more than the allowance fails as incomplete", three === "FAIL_INCOMPLETE", three);

  // The boundary is tied to the constant rather than to the literal 2, so
  // changing MINOR_MISS_ALLOWANCE cannot leave this test asserting the old one.
  const allowed = Math.floor(MINORS * MINOR_MISS_ALLOWANCE);
  ok("the boundary follows the constant, not a hard-coded count", allowed === 2, String(allowed));
}

{
  // The two failure modes must stay distinct: an incomplete run needs more
  // rehearsal, a critical miss needs that one step drilled. Collapsing them
  // into "fail" would lose the only part that says what to do next.
  const both = score(NG, { missedStepIds: ["s10", "s2", "s3", "s4"] });
  ok("a critical miss is reported even when the run was also incomplete",
    both === "FAIL_CRITICAL", both);
}

{
  // A checklist nobody has filled in yet is not a failure. It is an empty
  // form, and reporting FAIL for a procedure that asked nothing would be a
  // false statement about the student.
  ok("an empty checklist is not a fail", score([], { missedStepIds: [] }) === "PASS");

  // All-critical checklists exist (short, high-stakes procedures). The minor
  // branch must not divide by zero and call it a fail.
  const allCritical = NG.filter((s) => s.critical);
  ok("an all-critical checklist with nothing missed passes",
    score(allCritical, { missedStepIds: [] }) === "PASS");
  ok("an all-critical checklist with a miss fails critically",
    score(allCritical, { missedStepIds: ["s1"] }) === "FAIL_CRITICAL");
}

{
  // A missed id that is not on this checklist must not fail the station. Steps
  // get edited and an attempt can outlive the step it referred to; scoring a
  // student against an item that is no longer on the form is worse than
  // ignoring it.
  ok("an unknown missed step does not affect the result",
    score(NG, { missedStepIds: ["deleted-step"] }) === "PASS");

  /* The case above passes whether or not unknown ids are counted — one stray id
     against ten minor steps is 10%, under the allowance either way — so on its
     own it asserts nothing. Mutation testing caught that: replacing the count
     with `missed.size` kept it green.

     This is the case that separates them. Two real misses is exactly the
     allowance and passes; a third id that is not on the checklist must not be
     what tips a passing attempt into a fail. */
  ok("an unknown id cannot tip a passing attempt into a fail",
    score(NG, { missedStepIds: ["s2", "s3", "deleted-step"] }) === "PASS",
    score(NG, { missedStepIds: ["s2", "s3", "deleted-step"] }));
}

{
  /* The minor allowance is a proportion OF THE MINOR STEPS, not of all steps,
     and the NG checklist cannot tell the difference: ten minors out of twelve
     puts both denominators on the same side of the line.

     Half critical and half minor does separate them. Two missed minors out of
     five is 40% and fails; counted against all ten steps it is 20% and passes.
     Without this, folding the criticals into the denominator went unnoticed —
     and that mutation matters, because a procedure that is mostly critical
     steps would get a quietly more forgiving mark on its few minor ones. */
  const HALF: Step[] = [
    step("c1", 1, "Critical one", true),
    step("c2", 2, "Critical two", true),
    step("c3", 3, "Critical three", true),
    step("c4", 4, "Critical four", true),
    step("c5", 5, "Critical five", true),
    step("m1", 6, "Minor one"),
    step("m2", 7, "Minor two"),
    step("m3", 8, "Minor three"),
    step("m4", 9, "Minor four"),
    step("m5", 10, "Minor five"),
  ];
  const result = score(HALF, { missedStepIds: ["m1", "m2"] });
  ok("the allowance is a share of the minor steps, not of every step",
    result === "FAIL_INCOMPLETE", `2 of 5 minors missed, got ${result}`);
  ok("one minor of five is still within the allowance",
    score(HALF, { missedStepIds: ["m1"] }) === "PASS");
}

/* ── What to practise next ────────────────────────────────────────────────── */

const NOW = new Date("2026-09-29T08:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

{
  const rows = [
    { id: "p1", name: "Wound dressing", stepCount: 9, lastPracticedAt: daysAgo(1), criticalMisses: 5 },
    { id: "p2", name: "NG tube insertion", stepCount: 12, lastPracticedAt: null, criticalMisses: 0 },
    { id: "p3", name: "IM injection", stepCount: 8, lastPracticedAt: daysAgo(30), criticalMisses: 0 },
    { id: "p4", name: "Catheterisation", stepCount: 11, lastPracticedAt: daysAgo(30), criticalMisses: 3 },
    { id: "p5", name: "Tracheostomy care", stepCount: 0, lastPracticedAt: null, criticalMisses: 0 },
  ];
  const order = practiceOrder(rows).map((p) => p.id);

  ok("never practised comes first, whatever the misses elsewhere say",
    order[0] === "p2", order.join(","));
  ok("an empty checklist is excluded rather than ranked",
    !order.includes("p5"), order.join(","));
  ok("among equally stale procedures, critical misses decide",
    order.indexOf("p4") < order.indexOf("p3"), order.join(","));
  ok("a procedure practised yesterday does not lead on misses alone",
    order.indexOf("p1") > order.indexOf("p4"), order.join(","));
  ok("every procedure with steps is returned exactly once",
    order.length === 4 && new Set(order).size === 4, order.join(","));
}

{
  // The ordering must not depend on the order it was handed. A comparator that
  // reads correct on one input and shuffles on another is the classic way this
  // kind of function goes wrong.
  const rows = [
    { id: "a", name: "A", stepCount: 3, lastPracticedAt: daysAgo(5), criticalMisses: 1 },
    { id: "b", name: "B", stepCount: 3, lastPracticedAt: daysAgo(5), criticalMisses: 2 },
    { id: "c", name: "C", stepCount: 3, lastPracticedAt: null, criticalMisses: 0 },
  ];
  const forward = practiceOrder(rows).map((p) => p.id).join(",");
  const backward = practiceOrder(rows.slice().reverse()).map((p) => p.id).join(",");
  ok("the order does not depend on input order", forward === backward, `${forward} vs ${backward}`);

  // And the input is not mutated: the caller's list is theirs.
  const before = rows.map((r) => r.id).join(",");
  practiceOrder(rows);
  ok("the caller's array is not reordered in place", rows.map((r) => r.id).join(",") === before);
}

/* ── What to warn about before starting ───────────────────────────────────── */

{
  const misses = new Map([["s10", 3], ["s2", 3], ["s5", 1]]);
  const watch = watchSteps(NG, misses);

  ok("only steps actually missed are shown",
    watch.every((s) => (misses.get(s.id) ?? 0) > 0), watch.map((s) => s.id).join(","));
  ok("at equal miss counts the critical step leads",
    watch[0]?.id === "s10", watch.map((s) => s.id).join(","));
  ok("a step missed once is still shown rather than hidden below a threshold",
    watch.some((s) => s.id === "s5"), watch.map((s) => s.id).join(","));
  ok("the limit is respected", watchSteps(NG, misses, 2).length === 2);
  ok("nothing missed means nothing to warn about",
    watchSteps(NG, new Map()).length === 0);
}

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
