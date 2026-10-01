import { readFileSync } from "node:fs";
import {
  looksLikeSameTask,
  meaningfulWords,
  overlap,
  differentIndex,
  SAME_TASK_AT,
  type TaskLike,
} from "../src/lib/task-duplicate";

/**
 * The duplicate guard, against the failure it was written for.
 *
 * This is not a synthesised corpus. Every title below was in the student's
 * database on 2026-09-24: NURP (432) held twenty-one tasks, eleven real and
 * ten the same eleven imported again thirty seconds later. The second import
 * is recorded here exactly as it was stored, entity escapes and en dashes
 * included, because the guard has to survive the real text and not a cleaned
 * version of it.
 *
 * What the assertions are for. A similarity rule is the easiest kind of code
 * to test uselessly: pick two titles that are obviously alike, assert they
 * match, and learn nothing about the threshold or about what the rule does to
 * two tasks that are merely similar. Merging two real deadlines is strictly
 * worse than leaving a duplicate — it hides work the student still has to do
 * — so the negative cases are the point, and each one names the single guard
 * that rejects it. Delete that guard and exactly that test fails.
 */

let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
    failed++;
  }
}

const task = (title: string, type: string, day: string): TaskLike => ({
  title,
  type,
  deadline: new Date(`${day}T00:00:00`),
});

const score = (a: string, b: string) => overlap(meaningfulWords(a), meaningfulWords(b));

console.log("Task duplicates\n");

/* ── The real thing: ten pairs, one row each, taken from the two imports ──
   `kept` is the first import's title, `second` the second's. Both carried the
   same type and the same deadline — that is what made them a pair. */
const CORPUS: Array<{ kept: string; second: string; type: string; day: string; reach: boolean }> = [
  {
    // The one that is out of reach, documented in the module: one title
    // abbreviates (HN vs TL) what the other spells out, and adds three more
    // deliverables. Two shared words out of seven.
    kept: "Comparing job description of Head Nurse and Team Leader",
    second:
      "Weekly clinical assignment: Staff allocation, Shift report, Kardex + HN vs TL job description comparison",
    type: "ASSIGNMENT",
    day: "2026-09-13",
    reach: false,
  },
  {
    kept: "Healthcare delivery system / patient classification comparison (ideal vs unit)",
    second:
      "Weekly clinical assignment: Healthcare delivery system / patient classification comparison (ideal vs unit)",
    type: "ASSIGNMENT",
    day: "2026-09-27",
    reach: true,
  },
  {
    kept: "30-day staffing Rota + staff motivation plan",
    second: "Develop 30-day Staffing Rota and Motivation plan for staff nurses",
    type: "ASSIGNMENT",
    day: "2026-10-11",
    reach: true,
  },
  {
    // Stored with the entity escape intact, which is why decodeEntities exists.
    kept: "Staff development & team building (group work) + Quality checklist",
    second: "Staff development &amp; team building (group work) + Quality checklist",
    type: "ASSIGNMENT",
    day: "2026-10-25",
    reach: true,
  },
  {
    // One title numbers the simulation, the other numbers the week. The index
    // guard has to keep those two schemes apart or this pair is rejected.
    kept: "Pre-reading assignment \u2014 Simulation 1",
    second: "Pre-reading assignment for simulation (W12)",
    type: "READING",
    day: "2026-11-14",
    reach: true,
  },
  {
    kept: "Reflection paper \u2014 Simulation 1",
    second: "Simulation reflection paper (W12)",
    type: "ASSIGNMENT",
    day: "2026-11-16",
    reach: true,
  },
  {
    kept: "Pre-reading assignment \u2014 Simulation 2",
    second: "Pre-reading assignment for simulation (W13)",
    type: "READING",
    day: "2026-11-28",
    reach: true,
  },
  {
    kept: "Reflection paper \u2014 Simulation 2",
    second: "Simulation reflection paper (W13)",
    type: "ASSIGNMENT",
    day: "2026-11-30",
    reach: true,
  },
  {
    kept: "Problem-Solving Project submission (group, 10%)",
    second: "Problem-Solving Project submission (group)",
    type: "PROJECT",
    day: "2026-12-05",
    reach: true,
  },
  {
    // "(40%)" against "(NURP 432)": the percentage must not count as an index,
    // or these two are disjointly numbered and the pair is rejected.
    kept: "Final OSPE \u2014 Clinical Leadership and Management (40%)",
    second: "Final OSPE \u2013 Clinical Leadership and Management (NURP 432)",
    type: "EXAM",
    day: "2026-12-13",
    reach: true,
  },
];

ok("the corpus is the whole second import", CORPUS.length === 10, `${CORPUS.length} pairs`);

/* ── 1. Every pair the rule claims to reach, it reaches ─────────────────── */

const missed = CORPUS.filter(
  (p) => p.reach && !looksLikeSameTask(task(p.second, p.type, p.day), task(p.kept, p.type, p.day))
);
ok(
  "every reachable pair from the real double import is caught",
  missed.length === 0,
  missed.map((p) => `${p.second}\n          vs ${p.kept} (${score(p.kept, p.second).toFixed(2)})`).join("\n        ")
);

ok("nine of the ten are reachable", CORPUS.filter((p) => p.reach).length === 9);

/* The documented miss is asserted as a miss.

   Not to bless it — to make the trade-off visible. A change that catches this
   pair has to come back here and delete this line, which means showing, in the
   same diff, that it does not also merge the two OSPEs below. */
const unreachable = CORPUS.find((p) => !p.reach)!;
ok(
  "the abbreviated pair is still a known miss, not a silent one",
  !looksLikeSameTask(
    task(unreachable.second, unreachable.type, unreachable.day),
    task(unreachable.kept, unreachable.type, unreachable.day)
  ) && score(unreachable.kept, unreachable.second) < 0.4,
  `containment ${score(unreachable.kept, unreachable.second).toFixed(2)} — if this now matches, ` +
    `the threshold moved far enough to merge two different courses' exams.`
);

/* ── 2. Each guard, and the case only it rejects ────────────────────────── */

/* TYPE. The reading before a simulation and the reflection after it: same
   material, same words, two deliverables. In the real data they were two days
   apart as well, so the dates here are made the same on purpose — this test is
   about the type guard alone, and it has to fail if the type check goes. */
{
  const a = "Pre-reading assignment \u2014 Simulation 1";
  const b = "Reflection paper \u2014 Simulation 1";
  ok(
    "TYPE: a reading and a reflection on the same material stay two tasks",
    !looksLikeSameTask(task(a, "READING", "2026-11-14"), task(b, "ASSIGNMENT", "2026-11-14")),
    "the type check is what rejects this"
  );
  ok(
    "TYPE: and nothing else would have rejected it",
    !differentIndex(a, b) && score(a, b) >= SAME_TASK_AT,
    `index says nothing and containment is ${score(a, b).toFixed(2)} — so if this passes, ` +
      `removing the type check would merge a reading into a reflection.`
  );
}

/* DAY. The same weekly assignment, this week and next. This is the mistake
   that is worse than a duplicate: it deletes a deadline the student still has
   to meet. Titles identical, so only the day can reject. */
{
  const t = "Weekly clinical assignment: Staff allocation, Shift report, Kardex";
  ok(
    "DAY: this week's weekly assignment is not next week's",
    !looksLikeSameTask(task(t, "ASSIGNMENT", "2026-09-20"), task(t, "ASSIGNMENT", "2026-09-13"))
  );
  ok(
    "DAY: and nothing else would have rejected it",
    !differentIndex(t, t) && score(t, t) === 1,
    "identical titles; the day check is the only thing standing between them"
  );
  /* The same calendar date, next year. A syllabus is re-imported every
     September, and a same-day check comparing only month and day would read
     last year's deadline as this year's and drop the new one. A mutation
     removing the year comparison passed every other assertion here. */
  ok(
    "DAY: and the same date a year later is a different deadline",
    !looksLikeSameTask(task(t, "ASSIGNMENT", "2027-09-13"), task(t, "ASSIGNMENT", "2026-09-13"))
  );
  ok(
    "DAY: the same title on the same day is still the same task",
    looksLikeSameTask(task(t, "ASSIGNMENT", "2026-09-13"), task(t, "ASSIGNMENT", "2026-09-13"))
  );
}

/* INDEX, plain numbers. Two courses' final exams. This is the case that rules
   out a design: as text they are MORE alike than most of the real duplicates,
   so no threshold separates them and the numbering has to. */
{
  const a = "Final OSPE \u2014 Clinical Leadership (NURP 431)";
  const b = "Final OSPE \u2014 Clinical Leadership (NURP 432)";
  ok(
    "INDEX: two courses' final exams stay two exams",
    !looksLikeSameTask(task(a, "EXAM", "2026-12-13"), task(b, "EXAM", "2026-12-13"))
  );
  const lowestReal = Math.min(
    ...CORPUS.filter((p) => p.reach).map((p) => score(p.kept, p.second))
  );
  ok(
    "INDEX: no threshold could have done this job",
    score(a, b) > SAME_TASK_AT && score(a, b) > lowestReal,
    `these two score ${score(a, b).toFixed(2)}, above the threshold ${SAME_TASK_AT} and above ` +
      `the weakest genuine duplicate at ${lowestReal.toFixed(2)}. A score-only rule merges them.`
  );
}

/* INDEX, numbered siblings. Simulation 1 and Simulation 2 — the pair whose
   words are all but identical. */
{
  const a = "Pre-reading assignment \u2014 Simulation 1";
  const b = "Pre-reading assignment \u2014 Simulation 2";
  ok(
    "INDEX: Simulation 1 is not Simulation 2",
    !looksLikeSameTask(task(a, "READING", "2026-11-14"), task(b, "READING", "2026-11-14"))
  );
  ok(
    "INDEX: their words alone would have merged them",
    score(a, b) >= SAME_TASK_AT,
    `containment ${score(a, b).toFixed(2)}`
  );
}

/* INDEX, week numbers. The same sibling case written in the other scheme. */
{
  const a = "Simulation reflection paper (W12)";
  const b = "Simulation reflection paper (W13)";
  ok(
    "INDEX: W12 is not W13",
    !looksLikeSameTask(task(a, "ASSIGNMENT", "2026-11-16"), task(b, "ASSIGNMENT", "2026-11-16"))
  );
  ok("INDEX: 'Week 3' and 'W3' are the same marker", !differentIndex("Quiz W3", "Quiz Week 3"));
  ok("INDEX: 'Week 3' and 'W4' are not", differentIndex("Quiz Week 3", "Quiz W4"));
}

/* INDEX, and the two ways it must stay quiet.

   A guard that rejects too eagerly is invisible: the duplicate simply comes
   back, and nobody knows a rule decided it was a different task. Both of these
   are taken from the real pairs. */
ok(
  "INDEX: a percentage is a weight, not an identity",
  !differentIndex(
    "Final OSPE \u2014 Clinical Leadership and Management (40%)",
    "Final OSPE \u2013 Clinical Leadership and Management (NURP 432)"
  ),
  "40% must not be read as an index, or this true duplicate is rejected"
);
ok(
  "INDEX: a number on one side only decides nothing",
  !differentIndex("Pre-reading assignment \u2014 Simulation 1", "Pre-reading assignment for simulation"),
  "silence is not evidence of difference"
);
ok(
  "INDEX: a simulation number is not compared against a week number",
  !differentIndex("Pre-reading assignment \u2014 Simulation 1", "Pre-reading assignment for simulation (W12)"),
  "1 against 12 across two schemes would reject most of the real corpus"
);
/* The same case in the spaced form, and it is not redundant.

   "W12" produces no plain index at all — there is no word boundary inside
   "w12" for the number pattern to find — so the real corpus never exercised
   the line in plainIndex that keeps week markers out of the number namespace.
   A mutation deleting that line passed every other assertion here. "Week 12"
   does have the boundary, so this is the case that holds it. */
ok(
  "INDEX: nor when the week is spelt out",
  !differentIndex(
    "Pre-reading assignment \u2014 Simulation 1",
    "Pre-reading assignment for simulation (Week 12)"
  ),
  "Week 12 must land in the week namespace, not beside Simulation 1's 1"
);

/* WORDS. Two genuinely different pieces of work in the same course, same type,
   same words about problems and leadership — rejected on containment alone. */
{
  const a = "Problem solving form (with evidence) + Leadership checklist";
  const b = "Problem-Solving Project submission (group, 10%)";
  ok(
    "WORDS: a problem-solving form is not the problem-solving project",
    !looksLikeSameTask(task(a, "ASSIGNMENT", "2026-11-08"), task(b, "ASSIGNMENT", "2026-11-08"))
  );
  ok(
    "WORDS: and the other three guards all allowed it through",
    !differentIndex(a, b) && score(a, b) < SAME_TASK_AT,
    `containment ${score(a, b).toFixed(2)} — the threshold is the only thing rejecting this`
  );
}

/* ── 3. The threshold sits in a measured gap ─────────────────────────────── */

{
  const positives = CORPUS.filter((p) => p.reach).map((p) => score(p.kept, p.second));
  const lowestTrue = Math.min(...positives);
  /* Pairs that are genuinely different AND that type, day and index all allow
     through — the only pairs the threshold actually adjudicates. */
  const NEGATIVE_BY_WORDS: Array<[string, string]> = [
    ["Problem solving form (with evidence) + Leadership checklist", "Problem-Solving Project submission (group, 10%)"],
    ["30-day staffing Rota + staff motivation plan", "Staff development & team building (group work) + Quality checklist"],
    ["Comparing job description of Head Nurse and Team Leader", "Healthcare delivery system / patient classification comparison (ideal vs unit)"],
    ["Final OSPE \u2014 Clinical Leadership and Management (40%)", "Problem-Solving Project submission (group)"],
  ];
  const highestFalse = Math.max(...NEGATIVE_BY_WORDS.map(([a, b]) => score(a, b)));

  ok(
    "the weakest genuine duplicate is above the threshold",
    lowestTrue >= SAME_TASK_AT,
    `lowest true positive ${lowestTrue.toFixed(3)} vs threshold ${SAME_TASK_AT}`
  );
  ok(
    "the closest genuine non-duplicate is below it",
    highestFalse < SAME_TASK_AT,
    `highest false candidate ${highestFalse.toFixed(3)} vs threshold ${SAME_TASK_AT}`
  );
  /* Pinned rather than merely ordered. A future edit that drags the threshold
     to 0.66 would still satisfy both bounds above while leaving no room at
     all; this says there is real daylight and prints how much. */
  ok(
    "and there is real daylight between them",
    lowestTrue - highestFalse >= 0.1,
    `gap ${(lowestTrue - highestFalse).toFixed(3)} (true ${lowestTrue.toFixed(3)} / false ${highestFalse.toFixed(3)})`
  );
  console.log(
    `        measured: duplicates ${lowestTrue.toFixed(2)}–${Math.max(...positives).toFixed(2)}, ` +
      `different ${highestFalse.toFixed(2)} and below, threshold ${SAME_TASK_AT}`
  );
}

/* ── 4. The text handling the real titles needed ─────────────────────────── */

ok(
  "the entity escape is decoded, not compared",
  meaningfulWords("Staff development &amp; team building").has("staff") &&
    !meaningfulWords("Staff development &amp; team building").has("amp"),
  "'amp' as a word would count as agreement between any two escaped titles"
);
ok(
  "an en dash and an em dash read the same as a hyphen",
  score("Final OSPE \u2014 Clinical Leadership", "Final OSPE \u2013 Clinical Leadership") === 1
);
/* The alternative metric, with the number the module comment quotes. An
   elaborated re-import adds words; Jaccard charges for them. */
{
  const a = "Reflection paper \u2014 Simulation 1";
  const b = "Simulation reflection paper (W12)";
  const wa = meaningfulWords(a);
  const wb = meaningfulWords(b);
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared += 1;
  const jaccard = shared / (wa.size + wb.size - shared);
  ok(
    "Jaccard would have missed a real pair; containment does not",
    jaccard < SAME_TASK_AT && score(a, b) >= SAME_TASK_AT,
    `Jaccard ${jaccard.toFixed(2)} vs containment ${score(a, b).toFixed(2)}, threshold ${SAME_TASK_AT}`
  );
}

ok(
  "a number keeps its place in the words",
  meaningfulWords("Simulation 1").has("1") && meaningfulWords("30-day rota").has("30")
);
ok(
  "a single letter is not a word",
  !meaningfulWords("Section A reflection").has("a")
);
ok("Arabic titles survive tokenising", meaningfulWords("\u0648\u0627\u062c\u0628 \u0627\u0644\u062a\u0645\u0631\u064a\u0636").size === 2);

/* Filler must never contain something that distinguishes two real tasks. Every
   word that does any work in the corpus is checked against it. */
{
  const stripped = CORPUS.flatMap((p) => [p.kept, p.second]).filter(
    (t) => meaningfulWords(t).size === 0
  );
  ok("no real title is reduced to nothing by the filler list", stripped.length === 0, stripped.join(", "));
}

/* ── 5. The relation is symmetric ────────────────────────────────────────── */

{
  const asymmetric = CORPUS.filter(
    (p) =>
      looksLikeSameTask(task(p.second, p.type, p.day), task(p.kept, p.type, p.day)) !==
      looksLikeSameTask(task(p.kept, p.type, p.day), task(p.second, p.type, p.day))
  );
  ok(
    "which title arrived first does not change the answer",
    asymmetric.length === 0,
    asymmetric.map((p) => p.kept).join(", ")
  );
}

/* ── 6. The guard is actually wired into the tool that needed it ─────────── */

{
  const tools = readFileSync("src/lib/ai/agent/tools.ts", "utf8");
  ok(
    "create_task uses this rule",
    /looksLikeSameTask/.test(tools),
    "the module is the whole point only if the agent calls it"
  );
  ok(
    "and no longer decides on an exact title match",
    !/title:\s*\{\s*equals:\s*args\.data\.title/.test(tools),
    "the `equals` lookup is the bug this replaces"
  );
}

console.log("");
console.log(
  failed === 0
    ? "Nine of ten real duplicates caught; nothing that must stay separate was merged."
    : `${failed} FAILED`
);
process.exit(failed === 0 ? 0 : 1);
