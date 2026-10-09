/**
 * المحاكاة.
 *
 * The agent writes this content from an uploaded deck, so nobody proof-reads it
 * before a student plays it. These checks are the proof-reader: every way a
 * generated decision graph can be broken is refused here rather than
 * discovered three steps in, during exam week.
 *
 * The long fixture is the real simulation from the student's own Management
 * Process app, transcribed. If the rules cannot accept the thing they were
 * modelled on, the rules are wrong.
 */
import assert from "node:assert/strict";
import {
  problemsWith,
  isSound,
  describeProblem,
  start,
  choose,
  isOver,
  bestScore,
  progressOf,
  END,
  MIN_NODES,
  MAX_NODES,
  type Simulation,
} from "../src/lib/simulation";

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

console.log("المحاكاة");
console.log("");

/** The student's own content, from Management-Process-Review.html. */
const WARD: Simulation = {
  title: "أول أسبوع لك كـ head nurse",
  start: "n1",
  meters: { Staff: "6/7", Patients: 28, Morale: "😐", Quality: "78%" },
  nodes: [
    {
      key: "n1",
      situation:
        "اتعيّنت head nurse لجناح الباطنية. أول يوم، لاحظت إن الممرضين يرجعون لممرضة قديمة اسمها نورة في كل شي.",
      question: "وش تفهم من هذا؟",
      choices: [
        {
          text: "عندي legitimate power من المنصب، ونورة leader قوتها من التأثير",
          next: "n2",
          score: 10,
          why: "صح. المدير assigned وله legitimate power، والقائد يأخذ قوته من influence.",
          slide: 5,
          effects: { Morale: "🙂" },
        },
        {
          text: "نورة هي المديرة الحقيقية وأنا مالي صلاحية",
          next: "n2",
          score: 0,
          why: "لا. أنت اللي عندك delegated authority من المنصب.",
          slide: 5,
        },
        {
          text: "لازم أنقل نورة لجناح ثاني",
          next: "n2",
          score: 0,
          why: "القائد غير الرسمي ممكن يكون عون لك.",
          effects: { Morale: "😟" },
        },
      ],
    },
    {
      key: "n2",
      situation: "الإدارة تبغا الجناح ينزل السقطات خلال الشهر الجاي.",
      question: "وش أول خطوة في الـ management process؟",
      choices: [
        {
          text: "Planning: أقرر من الحين وش نسوي، كيف، متى، وين، ومين",
          next: "n3",
          score: 10,
          why: "صح. Planning أول خطوة.",
          slide: 8,
        },
        {
          text: "Controlling: أقيس السقطات الحين",
          next: "n3",
          score: 0,
          why: "المراقبة آخر خطوة، تحتاج خطة وهدف قبلها.",
          slide: 13,
        },
      ],
    },
    {
      key: "n3",
      situation: "الخطة جاهزة. الحين لازم تحدد مين مسؤول عن أي غرف.",
      question: "هذي أي خطوة؟",
      choices: [
        {
          text: "Organizing: توزيع الشغل والصلاحيات وخط السلطة",
          next: END,
          score: 10,
          why: "صح. Organizing = assigning work with authority, line of authority.",
          slide: 10,
          effects: { Quality: "80%" },
        },
        {
          text: "Assembling resources",
          next: END,
          score: 0,
          why: "هذا لتوفير الموارد، مو توزيع الصلاحيات.",
          slide: 11,
        },
      ],
    },
  ],
};

/** A deep copy, so a mutation in one check cannot leak into the next. */
const copy = (s: Simulation): Simulation => JSON.parse(JSON.stringify(s)) as Simulation;

check("THE STUDENT'S OWN SIMULATION PASSES ITS OWN RULES", () => {
  const problems = problemsWith(WARD, 35);
  assert.deepEqual(
    problems.map(describeProblem),
    [],
    "the rules reject the content they were modelled on"
  );
  assert.equal(isSound(WARD, 35), true);
});

check("every problem has words a student could read", () => {
  const broken = copy(WARD);
  broken.title = "";
  broken.nodes[0].choices[0].next = "nowhere";
  for (const problem of problemsWith(broken)) {
    const text = describeProblem(problem);
    assert.ok(text.length > 0, `${problem.kind} describes as nothing`);
    assert.ok(!text.includes("undefined"), `${problem.kind} leaks undefined`);
  }
});

/* ── the graph ──────────────────────────────────────────────────────────── */

check("A CHOICE THAT LEADS NOWHERE IS REFUSED", () => {
  const broken = copy(WARD);
  broken.nodes[0].choices[0].next = "n9";
  const kinds = problemsWith(broken).map((p) => p.kind);
  assert.ok(kinds.includes("DEAD_END"), "a dangling choice was accepted");
});

check("A NODE NOBODY CAN REACH IS REFUSED", () => {
  const broken = copy(WARD);
  broken.nodes.push({
    key: "orphan",
    situation: "موقف ما يوصله أحد",
    question: "؟",
    choices: [
      { text: "أ", next: END, score: 10, why: "تفسير" },
      { text: "ب", next: END, score: 0, why: "تفسير" },
    ],
  });
  const kinds = problemsWith(broken).map((p) => p.kind);
  assert.ok(kinds.includes("UNREACHABLE"), "content no student can see was accepted");
});

check("A SIMULATION THAT NEVER ENDS IS REFUSED", () => {
  const broken = copy(WARD);
  broken.nodes[2].choices.forEach((c) => (c.next = "n1"));
  const kinds = problemsWith(broken).map((p) => p.kind);
  assert.ok(kinds.includes("NEVER_ENDS"), "a simulation with no exit was accepted");
});

check("a choice that loops back onto its own question is refused", () => {
  const broken = copy(WARD);
  broken.nodes[0].choices[1].next = "n1";
  const kinds = problemsWith(broken).map((p) => p.kind);
  assert.ok(kinds.includes("SELF_LOOP"));
});

check("a missing start is refused", () => {
  const broken = copy(WARD);
  broken.start = "n0";
  const kinds = problemsWith(broken).map((p) => p.kind);
  assert.ok(kinds.includes("START_MISSING"));
});

check("two nodes with the same key are refused", () => {
  const broken = copy(WARD);
  broken.nodes.push({ ...copy(WARD).nodes[0] });
  const kinds = problemsWith(broken).map((p) => p.kind);
  assert.ok(kinds.includes("DUPLICATE_KEY"));
});

/* ── the questions ──────────────────────────────────────────────────────── */

check("A STEP WHERE EVERY ANSWER IS WRONG IS REFUSED", () => {
  /* It cannot be passed, which reads as the app being broken. */
  const broken = copy(WARD);
  broken.nodes[1].choices.forEach((c) => (c.score = 0));
  const kinds = problemsWith(broken).map((p) => p.kind);
  assert.ok(kinds.includes("NO_RIGHT_ANSWER"));
});

check("A STEP WHERE EVERY ANSWER IS RIGHT IS ALSO REFUSED", () => {
  /* It teaches nothing and inflates the score. */
  const broken = copy(WARD);
  broken.nodes[1].choices.forEach((c) => (c.score = 10));
  const kinds = problemsWith(broken).map((p) => p.kind);
  assert.ok(kinds.includes("ALL_RIGHT_ANSWERS"));
});

check("a question with one answer is refused", () => {
  const broken = copy(WARD);
  broken.nodes[1].choices = [broken.nodes[1].choices[0]];
  const kinds = problemsWith(broken).map((p) => p.kind);
  assert.ok(kinds.includes("TOO_FEW_CHOICES"));
});

check("AN ANSWER WITH NO EXPLANATION IS REFUSED", () => {
  /* The explanation is the only part of this that is studying. */
  const broken = copy(WARD);
  broken.nodes[0].choices[1].why = "   ";
  const kinds = problemsWith(broken).map((p) => p.kind);
  assert.ok(kinds.includes("MISSING_WHY"));
});

check(`fewer than ${MIN_NODES} nodes, or more than ${MAX_NODES}, is refused`, () => {
  const short = copy(WARD);
  short.nodes = short.nodes.slice(0, 1);
  short.nodes[0].choices.forEach((c) => (c.next = END));
  assert.ok(problemsWith(short).some((p) => p.kind === "TOO_FEW_NODES"));

  const long = copy(WARD);
  for (let i = 0; i < MAX_NODES; i += 1) {
    long.nodes.push({
      key: `x${i}`,
      situation: "موقف",
      question: "؟",
      choices: [
        { text: "أ", next: END, score: 10, why: "تفسير" },
        { text: "ب", next: END, score: 0, why: "تفسير" },
      ],
    });
    long.nodes[0].choices[0].next = `x${i}`;
  }
  assert.ok(problemsWith(long).some((p) => p.kind === "TOO_MANY_NODES"));
});

/* ── the meters ─────────────────────────────────────────────────────────── */

check("A CHOICE CANNOT INVENT A METER MID-GAME", () => {
  /* A typo would make a dial appear three steps in that was not on the ward
     when the student started. */
  const broken = copy(WARD);
  broken.nodes[0].choices[0].effects = { Moral: "🙂" };
  const kinds = problemsWith(broken).map((p) => p.kind);
  assert.ok(kinds.includes("UNKNOWN_METER"), "a misspelt meter was accepted");
});

check("meters that are not numbers survive being set", () => {
  /* "6/7", "78%" and an emoji are all legal readings, which is why effects
     replace rather than add. */
  let run = start(WARD);
  assert.equal(run.meters.Morale, "😐");
  run = choose(WARD, run, 0);
  assert.equal(run.meters.Morale, "🙂", "an emoji meter did not update");
  assert.equal(run.meters.Patients, 28, "an untouched meter changed");
});

/* ── the slides ─────────────────────────────────────────────────────────── */

check("A SLIDE NUMBER PAST THE END OF THE DECK IS REFUSED", () => {
  /* "سلايد 40" on a 35-page deck sends the student to a page that is not
     there, which is worse than citing nothing. */
  const broken = copy(WARD);
  broken.nodes[0].choices[0].slide = 40;
  const kinds = problemsWith(broken, 35).map((p) => p.kind);
  assert.ok(kinds.includes("SLIDE_OUT_OF_RANGE"));

  assert.ok(
    !problemsWith(broken).some((p) => p.kind === "SLIDE_OUT_OF_RANGE"),
    "a slide was range-checked against a deck length nobody supplied"
  );
});

check("slide 0 and a fractional slide are refused", () => {
  for (const slide of [0, -1, 2.5]) {
    const broken = copy(WARD);
    broken.nodes[0].choices[0].slide = slide;
    assert.ok(
      problemsWith(broken, 35).some((p) => p.kind === "SLIDE_OUT_OF_RANGE"),
      `slide ${slide} was accepted`
    );
  }
});

/* ── playing it ─────────────────────────────────────────────────────────── */

check("PLAYING IT THROUGH SCORES AND ENDS", () => {
  let run = start(WARD);
  assert.equal(isOver(run), false);
  run = choose(WARD, run, 0);
  run = choose(WARD, run, 0);
  run = choose(WARD, run, 0);
  assert.equal(isOver(run), true, "three right answers did not finish it");
  assert.equal(run.score, 30);
  assert.equal(run.taken.length, 3);
  assert.equal(run.meters.Quality, "80%");
});

check("every wrong answer still reaches the end", () => {
  let run = start(WARD);
  run = choose(WARD, run, 1);
  run = choose(WARD, run, 1);
  run = choose(WARD, run, 1);
  assert.equal(isOver(run), true, "a student who answers badly gets stuck");
  assert.equal(run.score, 0);
});

check("A STALE CLICK CHANGES NOTHING", () => {
  /* A second click after the page has moved on must not score and must not
     navigate. */
  const run = choose(WARD, start(WARD), 0);
  assert.deepEqual(choose(WARD, run, 99), run, "an impossible choice was taken");
  const done = choose(WARD, choose(WARD, run, 0), 0);
  assert.equal(isOver(done), true);
  assert.deepEqual(choose(WARD, done, 0), done, "a click after the end scored");
});

check("A NODE NAMED AFTER THE ENDING IS REFUSED", () => {
  const broken = copy(WARD);
  broken.nodes[2].key = END;
  broken.nodes[1].choices.forEach((c) => (c.next = END));
  const kinds = problemsWith(broken).map((p) => p.kind);
  assert.ok(kinds.includes("RESERVED_KEY"), `"${END}" was accepted as a node key`);
});

check("AND EVEN THEN, PLAYING IT STOPS AT THE END", () => {
  /* `choose` does not require that anything validated the content first, so
     the guard has to hold on a simulation that would have been refused. */
  const broken = copy(WARD);
  broken.nodes[2].key = END;
  broken.nodes[1].choices.forEach((c) => (c.next = END));
  assert.equal(isSound(broken), false, "this fixture is supposed to be invalid");

  let run = start(broken);
  run = choose(broken, run, 0);
  run = choose(broken, run, 0);
  assert.equal(isOver(run), true, "the run did not stop at the ending");
  const after = choose(broken, run, 0);
  assert.deepEqual(after, run, "the run continued past its own ending and scored");
});

check("the best score is reachable and never exceeded", () => {
  const best = bestScore(WARD);
  assert.equal(best, 30);
  let run = start(WARD);
  for (let i = 0; i < 10 && !isOver(run); i += 1) run = choose(WARD, run, 0);
  assert.ok(run.score <= best, `scored ${run.score} against a maximum of ${best}`);
  assert.equal(run.score, best, "the best path does not reach the best score");
});

check("progress never exceeds 1", () => {
  let run = start(WARD);
  assert.equal(progressOf(WARD, run), 0);
  for (let i = 0; i < 10 && !isOver(run); i += 1) {
    run = choose(WARD, run, 0);
    const p = progressOf(WARD, run);
    assert.ok(p >= 0 && p <= 1, `progress was ${p}`);
  }
  assert.equal(progressOf(WARD, run), 1);
});

console.log("");
console.log(
  failures === 0
    ? "المحاضرة، تنلعب — وكل تفسير يرجّع لسلايده."
    : `${failures} check(s) failed.`
);
process.exit(failures === 0 ? 0 : 1);
