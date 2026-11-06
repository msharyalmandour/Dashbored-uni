/**
 * A project's progress, and the step it is on.
 *
 * Two numbers, two ways to be quietly wrong: a bar filled from a slider
 * somebody typed in September while three of five steps are done, and a
 * "المرحلة 4" that skips an open step 2 because someone finished step 3
 * early.
 */

import assert from "node:assert/strict";
import {
  projectProgress,
  currentMilestone,
  currentStage,
  isFinished,
  type Milestone,
} from "../src/lib/project";
import { weightFromTitle } from "../src/lib/exam-weight";

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

console.log("المشروع");
console.log("");

const DONE = new Date(2026, 10, 1);
const m = (orderIndex: number, title: string, doneAt: Date | null = null): Milestone => ({
  id: `m${orderIndex}`,
  orderIndex,
  title,
  doneAt,
});

check("NO MILESTONES IS NOT A DIVISION BY ZERO", () => {
  /* His project today: the Task exists, the milestones table is empty. */
  const p = projectProgress([], 0);
  assert.equal(p.percent, 0);
  assert.equal(p.from, "typed");
  assert.ok(Number.isFinite(p.percent));
});

check("with no milestones the typed percentage is what there is", () => {
  const p = projectProgress([], 40);
  assert.equal(p.percent, 40);
  assert.equal(p.from, "typed");
});

check("a typed percentage out of range is clamped, not drawn past the ring", () => {
  assert.equal(projectProgress([], 140).percent, 100);
  assert.equal(projectProgress([], -10).percent, 0);
});

check("THE MILESTONES WIN OVER THE SLIDER", () => {
  /* Two of five done and a slider somebody left at 80. The bar says 40. */
  const steps = [
    m(0, "Pick the problem", DONE),
    m(1, "Collect evidence", DONE),
    m(2, "Root cause"),
    m(3, "Action plan"),
    m(4, "Write it up"),
  ];
  const p = projectProgress(steps, 80);
  assert.equal(p.percent, 40);
  assert.equal(p.from, "milestones");
  assert.equal(p.done, 2);
  assert.equal(p.total, 5);
});

check("THE CURRENT STEP IS THE FIRST GAP, NOT THE ONE AFTER THE LAST TICK", () => {
  /* Someone did step 3 early because they had the data. Step 2 is still
     open, and that is where the group is. */
  const steps = [m(0, "Pick", DONE), m(1, "Evidence"), m(2, "Root cause", DONE), m(3, "Plan")];
  assert.equal(currentMilestone(steps)?.title, "Evidence");
  assert.equal(currentStage(steps), 2);
});

check("the order comes from orderIndex, not from the query's order", () => {
  const shuffled = [m(2, "Root cause"), m(0, "Pick", DONE), m(1, "Evidence")];
  assert.equal(currentMilestone(shuffled)?.title, "Evidence");
  assert.equal(currentStage(shuffled), 2);
});

check("everything done reads as finished, not as a step that does not exist", () => {
  const steps = [m(0, "a", DONE), m(1, "b", DONE)];
  assert.equal(currentMilestone(steps), null);
  assert.equal(currentStage(steps), null);
  assert.equal(isFinished(steps), true);
  assert.equal(projectProgress(steps, 0).percent, 100);
});

check("AN EMPTY PROJECT IS NOT A FINISHED PROJECT", () => {
  assert.equal(isFinished([]), false);
});

check("his project's weight is read off its own title", () => {
  /* "Problem-Solving Project submission (group, 10%)" — the row in his
     database, due 2026-12-05. */
  assert.equal(weightFromTitle("Problem-Solving Project submission (group, 10%)"), 10);
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

mutationBites("dividing by the count without checking it — NaN% on his project", () => {
  const bad = (steps: Milestone[]) => (steps.filter((s) => s.doneAt).length / steps.length) * 100;
  assert.ok(Number.isFinite(bad([])));
});

mutationBites("the slider winning over the milestones", () => {
  const steps = [m(0, "a", DONE), m(1, "b"), m(2, "c"), m(3, "d"), m(4, "e")];
  assert.equal(projectProgress(steps, 80).percent, 80);
});

mutationBites("the step after the last tick — step 4 while step 2 is open", () => {
  const steps = [m(0, "Pick", DONE), m(1, "Evidence"), m(2, "Root cause", DONE), m(3, "Plan")];
  const lastDone = Math.max(...steps.filter((s) => s.doneAt).map((s) => s.orderIndex));
  assert.equal(lastDone + 2, currentStage(steps));
});

mutationBites("reading the order off the array instead of orderIndex", () => {
  const shuffled = [m(2, "Root cause"), m(0, "Pick", DONE), m(1, "Evidence")];
  assert.equal(shuffled.findIndex((s) => !s.doneAt) + 1, currentStage(shuffled));
});

mutationBites("`every` alone — an empty project reported as finished", () => {
  assert.equal([].every(() => false), false);
});

mutationBites("no clamp — a typed 140 drawn past the end of the ring", () => {
  assert.ok(projectProgress([], 140).percent === 140);
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("التقدّم من اللي خلص، مو من اللي انكتب.");
}
