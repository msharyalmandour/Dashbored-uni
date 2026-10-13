/**
 * What the exam covers, against his own OSPE.
 *
 * The number this produces goes on a screen next to "40%", so being wrong in
 * either direction matters: over-stating it makes a student panic at an exam
 * that is smaller than it looks, and under-stating it is the whole failure
 * this product exists to prevent.
 */

import assert from "node:assert/strict";
import { coverageOf, coveredBy, type CoverageLecture } from "../src/lib/exam-coverage";

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

console.log("وش يغطي الاختبار");
console.log("");

const d = (iso: string) => new Date(iso + "T00:00:00Z");
const NURP = "nurp431";
const NURC = "nurc410";

/* His real courses and dates. */
const LECTURES = [
  { id: "l1", subjectId: NURP, date: d("2026-09-04"), title: "Planning" },
  { id: "l2", subjectId: NURP, date: d("2026-09-11"), title: "Management Process" },
  { id: "l3", subjectId: NURP, date: d("2026-09-30"), title: "Organizing" },
  { id: "l4", subjectId: NURC, date: d("2026-09-10"), title: "Mechanical ventilation" },
];
/* Final OSPE — Clinical Leadership and Management, 40%, 13 December. */
const OSPE = { subjectId: NURP, date: d("2026-12-13") };

check("THE OSPE COVERS ITS OWN COURSE, NOT THE OTHERS", () => {
  const covered = coveredBy(LECTURES, OSPE);
  assert.deepEqual(covered.map((l) => l.id), ["l1", "l2", "l3"]);
  assert.ok(!covered.some((l) => l.subjectId === NURC), "a Critical Care lecture crept in");
});

check("A LECTURE ON THE EXAM'S OWN DAY IS COVERED", () => {
  /* Compared by DAY. Comparing instants drops a lecture taught at 08:00 on
     the exam's date — which is exactly the one he needs. */
  const sameDay = [{ id: "x", subjectId: NURP, date: new Date("2026-12-13T08:00:00Z") }];
  assert.equal(coveredBy(sameDay, OSPE).length, 1);
});

check("a lecture after the exam is not covered", () => {
  const later = [{ id: "x", subjectId: NURP, date: d("2026-12-14") }];
  assert.equal(coveredBy(later, OSPE).length, 0);
});

check("HIS REAL NUMBERS: 21 topics, 3 read", () => {
  const lectures: CoverageLecture[] = [
    { id: "l1", title: "Planning", topics: null, studied: false },
    { id: "l2", title: "Management Process", topics: { done: 3, total: 21 }, studied: false },
    { id: "l3", title: "Organizing", topics: null, studied: false },
  ];
  const c = coverageOf(lectures);
  assert.equal(c.topicsTotal, 21);
  assert.equal(c.topicsDone, 3);
  /* The two lectures with no breakdown are counted and NOT hidden: saying
     "18 topics left" about an exam that also has two un-broken lectures
     under-states it, which is the failure this product exists to prevent. */
  assert.equal(c.lecturesWithoutTopics, 2);
  assert.equal(c.unreadLectures, 2);
});

check("A LECTURE WITH NO BREAKDOWN IS NEVER SILENTLY DROPPED", () => {
  const c = coverageOf([{ id: "a", title: "x", topics: null, studied: false }]);
  assert.equal(c.topicsTotal, 0);
  assert.equal(c.unreadLectures, 1, "an unread lecture vanished from the exam");
});

check("a lecture without topics but marked studied is not counted unread", () => {
  const c = coverageOf([{ id: "a", title: "x", topics: null, studied: true }]);
  assert.equal(c.lecturesWithoutTopics, 1);
  assert.equal(c.unreadLectures, 0);
});

check("A STALE ROW ON ONE LECTURE CANNOT PAY FOR ANOTHER", () => {
  /* 22 of 21 on the first must not cover the unread topic on the second. */
  const c = coverageOf([
    { id: "a", title: "a", topics: { done: 22, total: 21 }, studied: false },
    { id: "b", title: "b", topics: { done: 0, total: 5 }, studied: false },
  ]);
  assert.equal(c.topicsTotal, 26);
  assert.equal(c.topicsDone, 21, `clamped per lecture, got ${c.topicsDone}`);
});

check("an exam with nothing behind it reads as zero, not as finished", () => {
  const c = coverageOf([]);
  assert.deepEqual(
    { total: c.topicsTotal, done: c.topicsDone, unread: c.unreadLectures },
    { total: 0, done: 0, unread: 0 }
  );
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

mutationBites("comparing instants instead of days", () => {
  /* The probe asserts the CORRECT outcome — a lecture at 08:00 on the exam's
     own date is covered — so an implementation comparing timestamps fails it.
     Written the other way round the first time, asserting what the broken
     version does, which is a probe that can never fail. */
  const bad = (l: { date: Date }, e: { date: Date }) => l.date.getTime() <= e.date.getTime();
  assert.equal(bad({ date: new Date("2026-12-13T08:00:00Z") }, { date: d("2026-12-13") }), true);
});

mutationBites("letting another course's lectures into the exam", () => {
  const bad = LECTURES.filter((l) => l.date <= OSPE.date);
  assert.deepEqual(bad.map((l) => l.id), ["l1", "l2", "l3"]);
});

mutationBites("dropping lectures that have no breakdown", () => {
  const lectures: CoverageLecture[] = [{ id: "a", title: "x", topics: null, studied: false }];
  const bad = lectures.filter((l) => l.topics).length;
  assert.equal(bad, 1);
});

mutationBites("clamping the total instead of per lecture", () => {
  const rows = [
    { done: 22, total: 21 },
    { done: 0, total: 5 },
  ];
  const bad = Math.min(
    rows.reduce((n, r) => n + r.total, 0),
    rows.reduce((n, r) => n + r.done, 0)
  );
  assert.equal(bad, 21);
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("الاختبار يقول وش يغطي، وما يصغّر نفسه.");
}
