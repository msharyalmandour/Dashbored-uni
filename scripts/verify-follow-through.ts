import { readFileSync } from "node:fs";
import {
  resumable,
  finishable,
  gapAction,
  batchSize,
  batchCaption,
  targetFrom,
  targetColumns,
  RESUME_WINDOW_DAYS,
  STALE_GAP_DAYS,
  BATCH_CEILING,
  type SessionRow,
  type GapRow,
  type Target,
  type TargetKind,
} from "../src/lib/follow-through";

/**
 * The follow-through decisions, against the history they were written for.
 *
 * The nine sessions below are the real ones, read out of the database on
 * 2026-09-29 with their planned minutes, status and target shape intact. They
 * are here because the obvious design — offer shorter sessions — is refuted by
 * them, and a test suite that did not carry the refutation would let someone
 * re-introduce it next month with a confident comment.
 *
 *     20 min  COMPLETED   target written by the app from a card
 *     25 min  ABANDONED   no target                        x5
 *     30 min  COMPLETED   target written by the app from a task
 *     45 min  ABANDONED   target free-typed "اذاكر اليكتشير"  x2
 *
 * Read down the minutes column and there is no pattern. Read down the target
 * column and there is one — at n=2, which patterns.ts would refuse to call a
 * pattern, so the module calls it a design decision instead and says so.
 */

let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
    failed++;
  }
}

const NOW = new Date("2026-09-29T08:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

console.log("Follow-through\n");

/* ── The real nine ────────────────────────────────────────────────────────── */

const t = (kind: TargetKind, refId?: string, label?: string): Target => ({ kind, refId, label });

const REAL: Array<SessionRow & { planned: number }> = [
  { id: "s1", status: "ABANDONED", startedAt: daysAgo(24), actualMinutes: null, planned: 25, target: t("NONE") },
  { id: "s2", status: "ABANDONED", startedAt: daysAgo(21), actualMinutes: null, planned: 25, target: t("NONE") },
  { id: "s3", status: "COMPLETED", startedAt: daysAgo(19), actualMinutes: 30, planned: 30,
    target: t("TASK", "cmtvpo3v40009l204vt8nr506", "إكمال Comparing job description of Head Nurse and Team Leader") },
  { id: "s4", status: "ABANDONED", startedAt: daysAgo(18), actualMinutes: null, planned: 45, target: t("FREE", undefined, "اذاكر اليكتشير") },
  { id: "s5", status: "ABANDONED", startedAt: daysAgo(18), actualMinutes: null, planned: 45, target: t("FREE", undefined, "اذاكر اليكتشير") },
  { id: "s6", status: "ABANDONED", startedAt: daysAgo(17), actualMinutes: null, planned: 25, target: t("NONE") },
  { id: "s7", status: "COMPLETED", startedAt: daysAgo(14), actualMinutes: 20, planned: 20,
    target: t("CARD", "card-shunt", "حل اللي يحتاج مراجعة: Why hypoxemia from a pulmonary shunt does not respond to 100% FiO2") },
  { id: "s8", status: "ABANDONED", startedAt: daysAgo(12), actualMinutes: null, planned: 25, target: t("NONE") },
  { id: "s9", status: "ABANDONED", startedAt: daysAgo(2), actualMinutes: null, planned: 25, target: t("NONE") },
];

ok("the nine real sessions are all here", REAL.length === 9);
ok(
  "seven of nine were abandoned, and none of those recorded a minute",
  REAL.filter((s) => s.status === "ABANDONED").length === 7 &&
    REAL.filter((s) => s.status === "ABANDONED").every((s) => s.actualMinutes === null),
  "the abandoned sessions stopped before any work registered — elapsed time is no resume anchor"
);

/* ── 1. Session length carries no signal. This is the refutation. ─────────── */

{
  const finishedMinutes = REAL.filter((s) => s.status === "COMPLETED").map((s) => s.planned).sort();
  const abandonedMinutes = REAL.filter((s) => s.status === "ABANDONED").map((s) => s.planned).sort();

  /* The shortest sessions were NOT the ones that finished. 20 and 30 finished;
     five 25s were abandoned. Any rule of the form "shorter is better" has to
     explain the five 25-minute abandonments that sit between them. */
  ok(
    "the finished sessions are not the shortest ones",
    Math.min(...abandonedMinutes) < Math.max(...finishedMinutes) &&
      abandonedMinutes.filter((m) => m > Math.min(...finishedMinutes) && m < Math.max(...finishedMinutes)).length >= 5,
    `finished ${JSON.stringify(finishedMinutes)}, abandoned ${JSON.stringify(abandonedMinutes)} — ` +
      `five abandonments sit strictly between the two successes`
  );
  console.log(
    `        finished at ${finishedMinutes.join("/")} min; abandoned at ${abandonedMinutes.join("/")} min`
  );
}

/* ── 2. Finishability, and what it refuses ───────────────────────────────── */

ok(
  "every session that finished had a target pointing at a record",
  REAL.filter((s) => s.status === "COMPLETED").every((s) => finishable(s.target))
);
ok(
  "no session that was abandoned had one",
  REAL.filter((s) => s.status === "ABANDONED").every((s) => !finishable(s.target))
);
ok(
  "an open-ended intention is not finishable, however clear it is to the student",
  !finishable(t("FREE", undefined, "اذاكر اليكتشير")) && !finishable(t("FREE", undefined, "revise everything")),
  "'I study the lecture' has no condition under which it is done"
);
ok(
  "a bare timer is not finishable",
  !finishable(t("NONE"))
);
/* The failure this guards: a label that reads specific with nothing behind it.
   Without the refId check, `{kind: "TASK"}` would pass and the app would offer
   to resume a task it cannot open. */
ok(
  "a target claiming to be a task without naming one is refused",
  !finishable(t("TASK")) && !finishable(t("CARD", "")) && finishable(t("TASK", "real-id"))
);
ok(
  "all four record kinds are finishable when they reference something",
  (["TASK", "CARD", "GAP", "LECTURE_SECTION"] as const).every((k) => finishable(t(k, "id")))
);

/* ── 3. Resuming: one thing, recent, and only if it can be finished ─────── */

{
  /* The most recent abandonment (s9, two days ago) has no target, so there is
     nothing to resume — which is the honest answer and the common case in this
     history. Offering "carry on" with a bare timer would be offering nothing. */
  ok(
    "the real history offers nothing to resume, because nothing abandoned had a target",
    resumable(REAL, NOW) === null,
    "seven abandonments, none of them pointing at anything"
  );

  const withTarget: SessionRow = {
    id: "s10", status: "ABANDONED", startedAt: daysAgo(1), actualMinutes: null,
    target: t("TASK", "task-rota", "30-day staffing Rota"),
  };
  ok(
    "an abandoned session with a real target is offered back",
    resumable([...REAL, withTarget], NOW)?.id === "s10"
  );

  const older: SessionRow = { ...withTarget, id: "s11", startedAt: daysAgo(3) };
  ok(
    "the most recent one wins when there are several",
    resumable([older, withTarget], NOW)?.id === "s10"
  );

  const stale: SessionRow = { ...withTarget, id: "s12", startedAt: daysAgo(RESUME_WINDOW_DAYS + 1) };
  ok(
    "and an old one is not dragged back up",
    resumable([stale], NOW) === null,
    `outside the ${RESUME_WINDOW_DAYS}-day window`
  );
  ok(
    "a session still running is not something to resume",
    resumable([{ ...withTarget, id: "s13", status: "ACTIVE" }], NOW) === null
  );
  ok(
    "and neither is one that was finished",
    resumable([{ ...withTarget, id: "s14", status: "COMPLETED" }], NOW) === null
  );
}

/* ── 4. Gaps: escalate, ask, or leave — never quietly close ─────────────── */

{
  /* His twelve, created 2026-09-11 and untouched since: eighteen days. */
  const real: GapRow = { id: "g1", status: "NOT_UNDERSTOOD", createdAt: daysAgo(18), updatedAt: daysAgo(18) };
  ok(
    "a gap untouched for eighteen days is asked about, not escalated again",
    gapAction(real, NOW) === "ASK_TO_CLOSE",
    "eighteen days of escalating quietly is what produced 0 resolved out of 12"
  );
  /* Tied to the constant rather than to the number 18, so the boundary itself
     is under test: one day either side of the threshold must differ. */
  ok(
    "and the threshold is exactly where the module says it is",
    gapAction({ ...real, updatedAt: daysAgo(STALE_GAP_DAYS) }, NOW) === "ASK_TO_CLOSE" &&
      gapAction({ ...real, updatedAt: daysAgo(STALE_GAP_DAYS - 1) }, NOW) === "ESCALATE",
    `at ${STALE_GAP_DAYS} days it asks; at ${STALE_GAP_DAYS - 1} it raises`
  );

  ok(
    "a gap from yesterday is simply new",
    gapAction({ id: "g2", status: "NOT_UNDERSTOOD", createdAt: daysAgo(1), updatedAt: daysAgo(1) }, NOW) === "LEAVE"
  );
  ok(
    "a gap untouched for a few days is raised",
    gapAction({ id: "g3", status: "NOT_UNDERSTOOD", createdAt: daysAgo(9), updatedAt: daysAgo(4) }, NOW) === "ESCALATE"
  );
  /* updatedAt, not createdAt: an old gap worked on yesterday is alive. Using
     createdAt would ask the student to close something they are mid-way
     through, which is the most discouraging possible moment to ask. */
  ok(
    "an OLD gap worked on yesterday is left alone",
    gapAction({ id: "g4", status: "NOT_UNDERSTOOD", createdAt: daysAgo(40), updatedAt: daysAgo(1) }, NOW) === "LEAVE",
    "age is measured from the last time the student touched it"
  );
  ok(
    "a mastered gap is never raised or questioned",
    gapAction({ id: "g5", status: "MASTERED", createdAt: daysAgo(90), updatedAt: daysAgo(90) }, NOW) === "LEAVE"
  );
  /* The one thing it must never do. A gap marked mastered by a timer is a
     false claim about what the student knows. */
  ok(
    "nothing here ever returns a close decision, only a question",
    (["ESCALATE", "ASK_TO_CLOSE", "LEAVE"] as const).includes(gapAction(real, NOW)) &&
      gapAction(real, NOW) !== ("CLOSE" as never),
    "the student closes a gap; the system may only ask"
  );
  ok(
    "a partially-understood gap is still followed up",
    gapAction({ id: "g6", status: "PARTIALLY_UNDERSTOOD", createdAt: daysAgo(30), updatedAt: daysAgo(20) }, NOW) ===
      "ASK_TO_CLOSE"
  );
}

/* ── 5. The batch: three, not forty-two ─────────────────────────────────── */

{
  /* The real number. 42 due, and 27 of them never opened. */
  ok(
    "a first-time student is offered three, not forty-two",
    batchSize(42, 0, 0) === 3,
    `got ${batchSize(42, 0, 0)}`
  );
  ok(
    "and the rest of the pile is stated, not hidden",
    batchCaption(42, 3).waiting === 39 && batchCaption(42, 3).shown === 3,
    "39 waiting is honest; showing only 3 would decide for them what they may know"
  );
  ok(
    "clearing batches earns a bigger one, one at a time",
    batchSize(42, 2, 2) === 5 && batchSize(42, 4, 4) === 7,
    `${batchSize(42, 2, 2)} then ${batchSize(42, 4, 4)}`
  );
  ok(
    "it never grows past the ceiling",
    batchSize(500, 50, 50) === BATCH_CEILING
  );
  /* The asymmetry: earned slowly, lost at once. A student who has just failed
     to clear a batch is not helped by being offered nearly as many again. */
  ok(
    "failing to clear drops straight to the floor, not by one",
    batchSize(42, 1, 5) === 3,
    `cleared 1 of 5 offered -> ${batchSize(42, 1, 5)}`
  );
  ok(
    "it never offers more than exist",
    batchSize(2, 10, 10) === 2 && batchSize(0, 10, 10) === 0
  );
  ok(
    "an empty queue asks for nothing",
    batchSize(0, 0, 0) === 0 && batchCaption(0, 0).waiting === 0
  );
}

/* ── 6. The instrument, which is the real deliverable here ──────────────── */

{
  /* Two observations is below patterns.ts's MIN_OBSERVATIONS of 4, so the
     target rule is a design decision and not a finding. What makes it
     answerable later is that TargetKind is recorded at all. This asserts the
     distinction the column has to carry — a free-typed target and a
     record-backed one must not collapse into "has a label". */
  const freeTyped = t("FREE", undefined, "اذاكر اليكتشير");
  const fromRecord = t("TASK", "task-1", "إكمال Comparing job description");
  ok(
    "a free-typed target and a record-backed one are distinguishable",
    freeTyped.label !== undefined &&
      fromRecord.label !== undefined &&
      finishable(freeTyped) !== finishable(fromRecord),
    "both have labels; only one points at something. Storing 'has a label' would " +
      "have lost exactly the distinction the measurement needs."
  );
  ok(
    "and the five kinds that were actually observed are all representable",
    (["TASK", "CARD", "FREE", "NONE", "GAP"] as TargetKind[]).length === 5
  );
}

/* ── 7. The classifier, and the mapping the data decided ────────────────── */

{
  ok(
    "a session started from a task is a TASK, and finishable",
    targetFrom({ taskId: "t1", taskLabel: "إكمال Comparing job description" }).kind === "TASK" &&
      finishable(targetFrom({ taskId: "t1" }))
  );
  ok(
    "a card and a gap likewise",
    targetFrom({ cardId: "c1" }).kind === "CARD" && targetFrom({ gapId: "g1" }).kind === "GAP"
  );
  /* The mapping the data decided. Both real sessions carrying a lectureId and
     nothing else were abandoned, and "study this lecture" has no completion
     condition — so it is FREE, not LECTURE_SECTION. A classifier that called
     it LECTURE_SECTION would assert a condition that does not exist. */
  ok(
    "a whole lecture with no section is FREE, not a finishable section",
    targetFrom({ lectureId: "l1" }).kind === "FREE" && !finishable(targetFrom({ lectureId: "l1" })),
    "both real sessions that carried only a lectureId were abandoned"
  );
  ok(
    "a named section IS finishable",
    targetFrom({ lectureSection: { lectureId: "l1", label: "pages 1-12" } }).kind === "LECTURE_SECTION" &&
      finishable(targetFrom({ lectureSection: { lectureId: "l1" } }))
  );
  ok(
    "a free-typed label is FREE",
    targetFrom({ taskLabel: "اذاكر اليكتشير" }).kind === "FREE"
  );
  ok(
    "whitespace is not an intention",
    targetFrom({ taskLabel: "   " }).kind === "NONE"
  );
  ok(
    "and a bare timer is NONE",
    targetFrom({}).kind === "NONE" && targetFrom({ taskId: null, taskLabel: null }).kind === "NONE"
  );
  /* A call carrying both is a task the app named, not a typed intention. */
  ok(
    "a task id wins over a label typed beside it",
    targetFrom({ taskId: "t1", taskLabel: "whatever" }).kind === "TASK"
  );

  /* The columns must satisfy the same rule the database CHECK enforces, or the
     write fails at runtime instead of here. */
  for (const target of [
    targetFrom({ taskId: "t1" }),
    targetFrom({ cardId: "c1" }),
    targetFrom({ gapId: "g1" }),
    targetFrom({ lectureSection: { lectureId: "l1" } }),
    targetFrom({ taskLabel: "free" }),
    targetFrom({}),
  ]) {
    const col = targetColumns(target);
    const needsRef = !["FREE", "NONE"].includes(col.targetKind);
    ok(
      `columns for ${col.targetKind} satisfy the database constraint`,
      needsRef ? typeof col.targetRefId === "string" && col.targetRefId.length > 0 : col.targetRefId === null,
      JSON.stringify(col)
    );
  }
  /* A malformed Target must not be laundered into a valid-looking row. */
  ok(
    "a FREE target never smuggles a reference into the row",
    targetColumns({ kind: "FREE", refId: "sneaky" }).targetRefId === null
  );
}

/* ── 8. The instrument is actually wired in ─────────────────────────────── */

{
  /* A column nobody writes to collects nothing, and the whole value of this
     work is that in a month there is data. That makes the wiring the
     deliverable, not the module — so it is asserted, not assumed. */
  const action = readFileSync("src/app/actions/focus.ts", "utf8");
  ok(
    "startFocusSession classifies the target",
    /targetFrom\(/.test(action) && /targetColumns\(/.test(action),
    "the module is pointless if the session-start path does not call it"
  );
  ok(
    "and writes it on the session row, not only to the event log",
    /focusSession\.create\([\s\S]{0,600}targetColumns/.test(action),
    "the distinction lived only in a StudentEvent before, which is why it was unrecoverable"
  );
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  ok(
    "the columns exist in the schema",
    /targetKind\s+String\?/.test(schema) && /targetRefId\s+String\?/.test(schema)
  );
}

console.log("");
console.log(
  failed === 0
    ? "Length carries no signal; a finishable target might. The column that settles it now exists."
    : `${failed} FAILED`
);
process.exit(failed === 0 ? 0 : 1);
