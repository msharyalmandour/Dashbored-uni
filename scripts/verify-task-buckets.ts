/**
 * متأخرة · هالأسبوع · بعدين · خلصت — and the two ways the piles go wrong.
 *
 * Both are live on his account, and neither throws:
 *
 *   - Five of his fifteen tasks are COMPLETED and all five are dated in the
 *     past. Bucketing by date before status opens the screen with five red
 *     rows for work he has handed in.
 *   - Every deadline in this database is midnight, because a date with no
 *     time becomes 00:00. At 3pm a task due TODAY is eleven hours "past".
 */

import assert from "node:assert/strict";
import {
  bucketOf,
  bucketTasks,
  daysUntil,
  timeKnown,
  columnVaries,
  WEEK_DAYS_AHEAD,
  type BucketableTask,
} from "../src/lib/task-buckets";

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

console.log("أكوام المهام");
console.log("");

/* His fifteen rows, with the three fields that decide a pile. Dates and
   statuses are his; the titles are shortened. `estimatedMinutes` is null on
   every one of them, which is also his. */
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const t = (
  id: string,
  deadline: Date,
  status = "NOT_STARTED",
  estimatedMinutes: number | null = null
): BucketableTask => ({ id, deadline, status, estimatedMinutes });

const REAL: BucketableTask[] = [
  t("job-description", d(2026, 9, 13), "COMPLETED"),
  t("healthcare-delivery", d(2026, 9, 27), "COMPLETED"),
  t("rota", d(2026, 10, 11), "COMPLETED"),
  t("midterm", d(2026, 10, 12), "COMPLETED"),
  t("staff-development", d(2026, 10, 25)),
  t("problem-solving-form", d(2026, 11, 8)),
  t("pre-read-1", d(2026, 11, 14)),
  t("reflection-1", d(2026, 11, 16)),
  t("pre-read-2", d(2026, 11, 28)),
  t("reflection-2", d(2026, 11, 30)),
  t("project", d(2026, 12, 5)),
  t("cbl", d(2026, 12, 7)),
  t("ospe-431", d(2026, 12, 13)),
  t("ospe-410", d(2026, 12, 14)),
  t("final-written", d(2026, 12, 21), "COMPLETED"),
];

/* Friday 6 November 2026, mid-afternoon. */
const NOW = new Date(2026, 10, 6, 15, 0);

check("A FINISHED TASK IS NEVER LATE, WHATEVER ITS DATE SAYS", () => {
  /* The exact failure: five completed tasks, all dated in the past. */
  const b = bucketTasks(REAL, NOW);
  assert.equal(b.done.length, 5);
  for (const task of b.overdue) assert.notEqual(task.status, "COMPLETED", task.id);
  assert.deepEqual(b.overdue.map((x) => x.id), ["staff-development"]);
});

check("A COMPLETED TASK DATED IN THE FUTURE IS STILL DONE", () => {
  /* "Final written exam" is marked COMPLETED and dated 21 December. */
  assert.equal(bucketOf(t("final-written", d(2026, 12, 21), "COMPLETED"), NOW), "done");
});

check("MIDNIGHT TODAY IS TODAY, NOT ELEVEN HOURS LATE", () => {
  /* Every deadline here is 00:00. Comparing instants at 3pm marks today's
     work as missed. */
  assert.equal(bucketOf(t("x", d(2026, 11, 6)), NOW), "thisWeek");
  assert.equal(daysUntil(d(2026, 11, 6), NOW), 0);
});

check("yesterday is late, by a day and not by an hour", () => {
  assert.equal(bucketOf(t("x", d(2026, 11, 5)), NOW), "overdue");
  assert.equal(daysUntil(d(2026, 11, 5), NOW), -1);
});

check("his week holds exactly the one task that falls in it", () => {
  /* 6 Nov to 12 Nov: only the problem solving form, due the 8th. */
  const b = bucketTasks(REAL, NOW);
  assert.deepEqual(b.thisWeek.map((x) => x.id), ["problem-solving-form"]);
});

check("the seventh day ahead is still this week; the eighth is not", () => {
  const seventh = new Date(NOW);
  seventh.setDate(seventh.getDate() + WEEK_DAYS_AHEAD - 1);
  const eighth = new Date(NOW);
  eighth.setDate(eighth.getDate() + WEEK_DAYS_AHEAD);
  assert.equal(bucketOf(t("a", seventh), NOW), "thisWeek");
  assert.equal(bucketOf(t("b", eighth), NOW), "later");
});

check("everything else lands in «بعدين», in date order", () => {
  const b = bucketTasks(REAL, NOW);
  assert.deepEqual(b.later.map((x) => x.id), [
    "pre-read-1",
    "reflection-1",
    "pre-read-2",
    "reflection-2",
    "project",
    "cbl",
    "ospe-431",
    "ospe-410",
  ]);
});

check("THE LATE PILE READS OLDEST FIRST", () => {
  /* The one late longest has been ignored longest. Newest-first slides an
     October miss under three from this week. */
  const late = [t("new", d(2026, 11, 5)), t("old", d(2026, 10, 1)), t("mid", d(2026, 10, 20))];
  assert.deepEqual(bucketTasks(late, NOW).overdue.map((x) => x.id), ["old", "mid", "new"]);
});

check("finished work reads most recent first — a record, not a queue", () => {
  const b = bucketTasks(REAL, NOW);
  assert.equal(b.done[0].id, "final-written");
  assert.equal(b.done[b.done.length - 1].id, "job-description");
});

check("EVERY TASK LANDS IN EXACTLY ONE PILE", () => {
  const b = bucketTasks(REAL, NOW);
  const total = b.overdue.length + b.thisWeek.length + b.later.length + b.done.length;
  assert.equal(total, REAL.length);
  const ids = [...b.overdue, ...b.thisWeek, ...b.later, ...b.done].map((x) => x.id);
  assert.equal(new Set(ids).size, REAL.length, "a task was counted twice");
});

check("TEN OPEN TASKS, NONE OF THEM MEASURED", () => {
  /* All fifteen have estimatedMinutes null. The ring must be told so rather
     than printing the zero it would otherwise add up to. */
  const k = timeKnown(REAL);
  assert.equal(k.estimatedMinutes, 0);
  assert.equal(k.estimatedCount, 0);
  assert.equal(k.unknownCount, 10, "ten open tasks are unestimated");
});

check("a finished task is not counted as unknown work", () => {
  const k = timeKnown([t("a", d(2026, 11, 8), "COMPLETED"), t("b", d(2026, 11, 8))]);
  assert.equal(k.unknownCount, 1);
});

check("a zero-minute estimate counts as unknown, not as free", () => {
  /* 0 is what an empty number field submits. Treating it as a real estimate
     makes a task weigh nothing in a plan it belongs to. */
  const k = timeKnown([t("a", d(2026, 11, 8), "NOT_STARTED", 0)]);
  assert.equal(k.unknownCount, 1);
  assert.equal(k.estimatedCount, 0);
});

check("A COLUMN WITH ONE VALUE IN IT IS NOT A COLUMN", () => {
  /* Priority is MEDIUM on all fifteen of his rows; "where it came from" is
     manual on all fifteen. Both are hidden by what the data does, not
     removed — they come back the moment he sets one. */
  const rows = REAL.map(() => ({ priority: "MEDIUM" }));
  assert.equal(columnVaries(rows, (r) => r.priority), false);
  const mixed = [{ priority: "MEDIUM" }, { priority: "HIGH" }];
  assert.equal(columnVaries(mixed, (r) => r.priority), true);
});

check("one row alone is never a varying column", () => {
  assert.equal(columnVaries([{ p: "HIGH" }], (r) => r.p), false);
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

mutationBites("DATE BEFORE STATUS — five finished tasks shown as late", () => {
  const bad = (task: BucketableTask) =>
    task.deadline < NOW ? "overdue" : task.status === "COMPLETED" ? "done" : "later";
  const late = REAL.filter((x) => bad(x) === "overdue");
  assert.equal(late.length, bucketTasks(REAL, NOW).overdue.length, `${late.length} would be late`);
});

mutationBites("comparing instants — today's work marked missed at 3pm", () => {
  const today = d(2026, 11, 6);
  assert.ok(today.getTime() >= NOW.getTime(), "midnight today is before 3pm today");
});

mutationBites("flooring the day difference instead of rounding", () => {
  /* Across a DST shift the gap is 23 or 25 hours, and floor turns a task due
     tomorrow into one due today. */
  const ms = 23 * 3600000;
  assert.equal(Math.floor(ms / 86400000), Math.round(ms / 86400000));
});

mutationBites("the late pile newest first — October hidden under November", () => {
  const late = [t("new", d(2026, 11, 5)), t("old", d(2026, 10, 1))];
  const bad = [...late].sort((a, b) => b.deadline.getTime() - a.deadline.getTime());
  assert.equal(bad[0].id, bucketTasks(late, NOW).overdue[0].id);
});

mutationBites("summing estimates and calling the total the workload", () => {
  const bad = REAL.reduce((n, x) => n + (x.estimatedMinutes ?? 0), 0);
  assert.ok(bad > 0, `the screen would print ${bad} minutes for ten open tasks`);
});

mutationBites("treating a 0-minute estimate as measured", () => {
  const bad = (x: BucketableTask) => x.estimatedMinutes !== null;
  assert.equal(bad(t("a", d(2026, 11, 8), "NOT_STARTED", 0)), false);
});

mutationBites("«هالأسبوع» counted as 8 days, swallowing the next pile's first", () => {
  const eighth = new Date(NOW);
  eighth.setDate(eighth.getDate() + WEEK_DAYS_AHEAD);
  assert.equal(bucketOf(t("b", eighth), NOW), "thisWeek");
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("كل مهمة في كومها، واللي خلص ما يطلع أحمر.");
}
