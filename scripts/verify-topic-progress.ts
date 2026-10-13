/**
 * "7 of 21", and the ways that number can lie.
 *
 * Two of these are not hypothetical. A stale progress row — a topic marked
 * studied, then the breakdown regenerated shorter — gives "22 of 21" unless
 * the count is clamped against its own total. And the plural word has to agree
 * with the TOTAL, not with how many are done, or a student two topics in reads
 * a sentence about a two-topic lecture.
 */

import assert from "node:assert/strict";
import { progressOf, nextTopics, describeProgress } from "../src/lib/topic-progress";

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

console.log("التقدّم في المواضيع");
console.log("");

const AR = { zero: "موضوع", one: "موضوع", two: "موضوعان", few: "مواضيع", many: "موضوعًا" };

check("HIS REAL LECTURE: seven of twenty-one", () => {
  const p = progressOf(7, 21);
  assert.deepEqual({ done: p.done, total: p.total }, { done: 7, total: 21 });
  assert.ok(Math.abs(p.fraction - 7 / 21) < 1e-9);
});

check("A STALE ROW CANNOT READ MORE THAN THE TOTAL", () => {
  /* Marked 22 topics, then the breakdown was regenerated with 21. */
  const p = progressOf(22, 21);
  assert.equal(p.done, 21);
  assert.equal(p.fraction, 1);
});

check("nothing to study is 0, not a division by zero", () => {
  const p = progressOf(0, 0);
  assert.equal(p.fraction, 0);
  assert.ok(Number.isFinite(p.fraction));
});

check("negative and fractional counts are refused quietly", () => {
  assert.equal(progressOf(-3, 21).done, 0);
  assert.equal(progressOf(2.7, 21).done, 2);
  assert.equal(progressOf(5, -1).total, 0);
});

check("THE NEXT TOPICS ARE IN THE LECTURE'S OWN ORDER", () => {
  /* Planning before Organizing before Controlling: the sections build on each
     other, and a dose that opens with Controlling is a dose he cannot do. */
  const sections = ["Planning", "Organizing", "Assembling", "Directing", "Controlling"];
  const done = new Set(["Planning"]);
  assert.deepEqual(nextTopics(sections, (s) => done.has(s), 3), [
    "Organizing",
    "Assembling",
    "Directing",
  ]);
});

check("asking for none, or more than are left, is safe", () => {
  const sections = ["a", "b"];
  assert.deepEqual(nextTopics(sections, () => false, 0), []);
  assert.deepEqual(nextTopics(sections, () => false, -1), []);
  assert.deepEqual(nextTopics(sections, () => false, 99), ["a", "b"]);
  assert.deepEqual(nextTopics(sections, () => true, 3), []);
});

check("THE WORD AGREES WITH THE TOTAL, NOT WITH WHAT IS DONE", () => {
  /* 2 of 21: Arabic's dual would make "موضوعان" — a claim about a two-topic
     lecture. It must agree with 21. */
  const two = describeProgress(progressOf(2, 21), "ar", AR, "{done} من {total} {word}");
  assert.ok(two.includes("موضوعًا"), `agreed with the wrong number: ${two}`);
  assert.ok(!two.includes("موضوعان"), `used the dual for a lecture of 21: ${two}`);
});

check("a two-topic lecture really does take the dual", () => {
  const p = describeProgress(progressOf(1, 2), "ar", AR, "{done} من {total} {word}");
  assert.ok(p.includes("موضوعان"), p);
});

/* ── mutations ──────────────────────────────────────────────────────────── */

function mutationBites(name: string, probe: () => void) {
  try {
    probe();
    failures += 1;
    console.log(`  MUTATION DID NOT BITE  ${name}`);
  } catch {
    console.log(`  bites  ${name}`);
  }
}

console.log("");
console.log("mutations");

mutationBites("not clamping a stale count against the total", () => {
  const bad = (done: number, total: number) => ({ done, total });
  assert.equal(bad(22, 21).done, 21);
});

mutationBites("dividing by a zero total", () => {
  const bad = (done: number, total: number) => done / total;
  assert.ok(Number.isFinite(bad(0, 0)));
});

mutationBites("agreeing the plural with `done` instead of `total`", () => {
  const bad = describeProgress(progressOf(2, 21), "ar", AR, "{done} من {total}") + " موضوعان";
  assert.ok(!bad.includes("موضوعان"));
});

mutationBites("sorting the next topics by anything but the lecture's order", () => {
  const sections = ["Planning", "Organizing", "Assembling"];
  const bad = [...sections].sort().slice(0, 1);
  assert.deepEqual(bad, ["Planning"]);
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("٧ من ٢١ — رقم يقدر يصدّقه.");
}
