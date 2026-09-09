import assert from "node:assert/strict";
import {
  detectTimeOfDayPattern,
  detectSessionLengthPattern,
  detectFriction,
  calibrateDuration,
  calibratedRange,
  confidenceFor,
  dayPartOf,
  MIN_OBSERVATIONS,
  type SessionObservation,
  type DurationObservation,
} from "../src/lib/patterns";

let n = 0;
const check = (name: string, fn: () => void) => { fn(); n++; console.log("  ok", name); };

const sess = (hour: number, finished: boolean, planned = 45, actual: number | null = null): SessionObservation =>
  ({ hour, plannedMinutes: planned, actualMinutes: actual, finished, occurredAt: new Date() });
const many = (count: number, hour: number, finished: boolean, planned = 45) =>
  Array.from({ length: count }, () => sess(hour, finished, planned));

console.log("\nTEST 1 — one morning session must not become a pattern");
check("a single completed morning session yields nothing", () => {
  assert.equal(detectTimeOfDayPattern([sess(9, true)]), null);
});
check("still nothing at MIN_OBSERVATIONS-1 mornings, with no evening to compare", () => {
  assert.equal(detectTimeOfDayPattern(many(MIN_OBSERVATIONS - 1, 9, true)), null);
});
check("a perfect morning record alone is not a pattern — nothing to compare it to", () => {
  assert.equal(detectTimeOfDayPattern(many(20, 9, true)), null);
});
check("confidenceFor refuses to grade thin evidence", () => {
  assert.equal(confidenceFor(1), null);
  assert.equal(confidenceFor(MIN_OBSERVATIONS - 1), null);
});

console.log("\nTEST 2 — repeated mornings must build confidence gradually");
check("4 morning + 4 evening observations → LOW", () => {
  const p = detectTimeOfDayPattern([...many(4, 9, true), ...many(4, 20, false)]);
  assert.ok(p, "expected a pattern");
  assert.equal(p!.best, "MORNING");
  assert.equal(p!.worst, "EVENING");
  assert.equal(p!.confidence, "LOW");
});
check("more of the same on BOTH sides → MEDIUM", () => {
  const p = detectTimeOfDayPattern([...many(6, 9, true), ...many(6, 20, false)]);
  assert.equal(p!.confidence, "MEDIUM");
});
check("a lopsided record is graded by its thinner half, not its total", () => {
  // 4 mornings against 40 evenings is a claim resting on four sessions.
  const p = detectTimeOfDayPattern([...many(4, 9, true), ...many(40, 20, false)]);
  assert.equal(p!.confidence, "LOW");
  assert.equal(p!.observations, 4);
});
check("a consistent record on both sides → HIGH", () => {
  const p = detectTimeOfDayPattern([...many(12, 9, true), ...many(12, 20, false)]);
  assert.equal(p!.confidence, "HIGH");
});
check("a small gap is noise, not a pattern", () => {
  // 5/6 mornings vs 4/6 evenings — a 17-point gap, under the threshold.
  const p = detectTimeOfDayPattern([
    ...many(5, 9, true), ...many(1, 9, false),
    ...many(4, 20, true), ...many(2, 20, false),
  ]);
  assert.equal(p, null);
});
check("day parts are bucketed at the stated boundaries", () => {
  assert.equal(dayPartOf(5), "MORNING");
  assert.equal(dayPartOf(11), "MORNING");
  assert.equal(dayPartOf(12), "AFTERNOON");
  assert.equal(dayPartOf(17), "EVENING");
  assert.equal(dayPartOf(22), "NIGHT");
  assert.equal(dayPartOf(3), "NIGHT");
});

console.log("\nTEST 3 — repeated postponement offers help, never a label");
check("one or two moves of a task are not friction", () => {
  const p = (taskId: string) => ({ taskId, occurredAt: new Date() });
  assert.deepEqual(detectFriction([p("a"), p("a")]), []);
});
check("three moves of the same task surface it", () => {
  const p = (taskId: string) => ({ taskId, occurredAt: new Date() });
  const found = detectFriction([p("a"), p("a"), p("a")]);
  assert.equal(found.length, 1);
  assert.equal(found[0].taskId, "a");
  assert.equal(found[0].postponements, 3);
  assert.equal(found[0].confidence, "LOW");
});
check("moves spread across different tasks are not friction on any of them", () => {
  const p = (taskId: string) => ({ taskId, occurredAt: new Date() });
  assert.deepEqual(detectFriction([p("a"), p("b"), p("c"), p("d")]), []);
});
check("the finding carries no reason field at all", () => {
  const p = (taskId: string) => ({ taskId, occurredAt: new Date() });
  const found = detectFriction([p("a"), p("a"), p("a"), p("a")])[0];
  assert.deepEqual(Object.keys(found).sort(), ["confidence", "postponements", "stuckCount", "taskId"]);
  assert.equal(found.confidence, "MEDIUM");
});

console.log("\nTEST 4 — estimates improve from real durations");
const dur = (estimatedMinutes: number, actualMinutes: number): DurationObservation =>
  ({ taskType: "SESSION", estimatedMinutes, actualMinutes });
check("one overrun does not move the estimate", () => {
  assert.equal(calibrateDuration([dur(45, 75)], "SESSION"), null);
});
check("consistent overruns produce a calibration above 1", () => {
  const c = calibrateDuration([dur(45, 70), dur(45, 65), dur(30, 45), dur(60, 90)], "SESSION");
  assert.ok(c, "expected a calibration");
  assert.ok(c!.ratio > 1.3, `ratio was ${c!.ratio}`);
});
check("an accurate estimator gets no correction at all", () => {
  assert.equal(calibrateDuration([dur(45, 46), dur(30, 29), dur(60, 61), dur(25, 25)], "SESSION"), null);
});
check("a single wild outlier cannot drag the calibration (median, not mean)", () => {
  const c = calibrateDuration([dur(45, 70), dur(45, 65), dur(45, 68), dur(45, 900)], "SESSION");
  assert.ok(c!.ratio < 2, `ratio was ${c!.ratio} — an outlier got through`);
});
check("the calibrated answer is a range, not a false precision", () => {
  const c = calibrateDuration([dur(45, 70), dur(45, 65), dur(30, 45), dur(60, 90)], "SESSION")!;
  const r = calibratedRange(45, c);
  assert.ok(r.low < r.high);
  assert.ok(r.low > 45, "a student who runs long should be quoted more than the raw estimate");
});

console.log("\nTEST 5 — a student who changes is not held to an old profile");
check("recent contrary evidence flips the pattern rather than being outvoted", () => {
  // Was better in the evening; is now better in the morning, by the same margin.
  const before = [...many(10, 20, true), ...many(10, 9, false)];
  const after = [...many(10, 9, true), ...many(10, 20, false)];
  assert.equal(detectTimeOfDayPattern(before)!.best, "EVENING");
  assert.equal(detectTimeOfDayPattern(after)!.best, "MORNING");
});
check("a genuinely mixed record produces no claim in either direction", () => {
  assert.equal(detectTimeOfDayPattern([...many(6, 9, true), ...many(6, 20, true)]), null);
});
check("nothing in the pattern engine stores state between calls", () => {
  const input = [...many(10, 9, true), ...many(10, 20, false)];
  const a = detectTimeOfDayPattern(input);
  const b = detectTimeOfDayPattern([...many(10, 20, true), ...many(10, 9, false)]);
  const c = detectTimeOfDayPattern(input);
  assert.deepEqual(a, c, "a previous call changed a later result");
  assert.notEqual(a!.best, b!.best);
});

console.log("\nSession length");
check("no suggestion while long sessions are working", () => {
  assert.equal(detectSessionLengthPattern([...many(6, 9, true, 25), ...many(6, 9, true, 60)]), null);
});
check("short sessions clearly working better produces a suggestion", () => {
  const p = detectSessionLengthPattern([...many(6, 9, true, 25), ...many(6, 9, false, 60)]);
  assert.ok(p);
  assert.equal(p!.suggestedMinutes, 25);
  assert.equal(p!.confidence, "MEDIUM");
});
check("it never fires in reverse — long working better yields nothing", () => {
  assert.equal(detectSessionLengthPattern([...many(6, 9, false, 25), ...many(6, 9, true, 60)]), null);
});
check("four short sessions and one long one is not enough", () => {
  assert.equal(detectSessionLengthPattern([...many(6, 9, true, 25), ...many(1, 9, false, 60)]), null);
});

console.log(`\n${n} assertions passed`);
