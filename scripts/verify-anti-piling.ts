/**
 * منع التراكم — the rule the product exists for.
 *
 * Every number here comes from the rules file, and the last block runs the
 * engine over this student's REAL situation on 2026-10-08: a Critical Care
 * midterm four days out with five un-studied lectures behind it.
 */
import assert from "node:assert/strict";
import {
  buildPlan,
  doseOn,
  share,
  assignToExams,
  daysBetween,
  WINDOW_DAYS,
  PILING_AFTER_DAYS,
  MAX_PER_DAY,
  CLINICAL_SHARE,
  type PlannedLecture,
  type PlannedExam,
} from "../src/lib/anti-piling";

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

console.log("منع التراكم");
console.log("");

const d = (s: string) => new Date(`${s}T09:00:00`);
const COURSE = "nurc410";

function lecture(n: number, date: string, studied = false): PlannedLecture {
  return { id: `l${n}`, title: `Lecture ${n}`, subjectId: COURSE, date: d(date), studied };
}
const exam = (date: string, id = "e1", subjectId = COURSE): PlannedExam => ({
  id,
  title: "Midterm",
  subjectId,
  date: d(date),
});

/* ── the arithmetic ─────────────────────────────────────────────────────── */

check("A SPLIT NEVER LOSES OR INVENTS WORK", () => {
  /* The failure this guards: rounding each day's share on its own. Five over
     three rounds to 2+2+2 = six lectures, one of which does not exist. */
  for (const count of [0, 1, 2, 5, 7, 13, 51]) {
    for (const days of [1, 2, 3, 4, 7, 14]) {
      const parts = share(count, Array.from({ length: days }, () => 1));
      assert.equal(
        parts.reduce((s, p) => s + p, 0),
        count,
        `${count} over ${days} days summed to ${parts.reduce((s, p) => s + p, 0)}`
      );
      assert.ok(parts.every((p) => p >= 0), "a day was given negative work");
    }
  }
});

check("an even split is actually even", () => {
  assert.deepEqual(share(6, [1, 1, 1]), [2, 2, 2]);
  assert.deepEqual(share(4, [1, 1]), [2, 2]);
});

check("A HOSPITAL DAY IS GIVEN LESS THAN A FREE DAY", () => {
  const parts = share(8, [1, CLINICAL_SHARE, 1]);
  assert.ok(parts[1] < parts[0], `clinical day got ${parts[1]}, free day got ${parts[0]}`);
  assert.ok(parts[1] < parts[2], "clinical day was not lighter than the day after");
  assert.equal(parts.reduce((s, p) => s + p, 0), 8, "the split lost work");
});

/* ── which exam owns a lecture ──────────────────────────────────────────── */

check("A LECTURE IS PLANNED ONCE, NOT ONCE PER EXAM", () => {
  const lectures = [lecture(1, "2026-09-05"), lecture(2, "2026-09-20")];
  const { byExam } = assignToExams(lectures, [exam("2026-10-12", "mid"), exam("2026-12-21", "final")]);
  const seen = [...byExam.values()].flat().map((l) => l.id);
  assert.equal(new Set(seen).size, seen.length, "a lecture was handed to two exams");
  assert.equal(seen.length, 2, "a lecture went missing");
  assert.deepEqual(
    byExam.get("mid")?.map((l) => l.id),
    ["l1", "l2"],
    "lectures did not go to the EARLIEST exam that covers them"
  );
});

check("a lecture taught after the exam belongs to the next one", () => {
  const after = lecture(9, "2026-11-01");
  const { byExam } = assignToExams([after], [exam("2026-10-12", "mid"), exam("2026-12-21", "final")]);
  assert.equal(byExam.get("mid"), undefined, "a lecture taught after the exam was put in it");
  assert.deepEqual(byExam.get("final")?.map((l) => l.id), ["l9"]);
});

check("another course's exam does not claim this course's lectures", () => {
  const { byExam, unclaimed } = assignToExams(
    [lecture(1, "2026-09-05")],
    [exam("2026-10-12", "other", "nurp431")]
  );
  assert.equal(byExam.size, 0, "an exam claimed a lecture from a different course");
  assert.equal(unclaimed.length, 1);
});

check("a studied lecture is never planned", () => {
  const { byExam, unclaimed } = assignToExams(
    [lecture(1, "2026-09-05", true)],
    [exam("2026-10-12")]
  );
  assert.equal(byExam.size, 0);
  assert.equal(unclaimed.length, 0, "a finished lecture was called un-studied");
});

/* ── the window ─────────────────────────────────────────────────────────── */

check(`the plan starts ${WINDOW_DAYS} days before the exam, not earlier`, () => {
  const plan = buildPlan({
    lectures: [lecture(1, "2026-09-05"), lecture(2, "2026-09-06")],
    exams: [exam("2026-11-30")],
    clinicalDays: [],
    today: d("2026-10-08"),
  });
  const days = plan.plans[0].days;
  assert.equal(days.length, WINDOW_DAYS, `window was ${days.length} days`);
  assert.equal(daysBetween(days[0].date, d("2026-11-30")), WINDOW_DAYS, "window starts at the wrong day");
});

check("THE EXAM DAY ITSELF IS NEVER A STUDY DAY", () => {
  const plan = buildPlan({
    lectures: [lecture(1, "2026-09-05")],
    exams: [exam("2026-10-12")],
    clinicalDays: [],
    today: d("2026-10-08"),
  });
  for (const day of plan.plans[0].days) {
    assert.notEqual(
      daysBetween(day.date, d("2026-10-12")),
      0,
      "the plan asks the student to study on the morning of the exam"
    );
  }
});

check("the window never starts in the past", () => {
  const plan = buildPlan({
    lectures: [lecture(1, "2026-09-05")],
    exams: [exam("2026-10-12")],
    clinicalDays: [],
    today: d("2026-10-08"),
  });
  const first = plan.plans[0].days[0].date;
  assert.ok(daysBetween(d("2026-10-08"), first) >= 0, "the plan scheduled work in the past");
});

check("AN EXAM TOMORROW STILL PRODUCES A DOSE, AND SAYS IT DOES NOT FIT", () => {
  /* The honest failure mode. An empty plan the day before an exam is the
     product silently giving up. */
  const lectures = [1, 2, 3, 4, 5].map((n) => lecture(n, "2026-09-0" + n));
  const plan = buildPlan({
    lectures,
    exams: [exam("2026-10-09")],
    clinicalDays: [],
    today: d("2026-10-08"),
  });
  const today = doseOn(plan, d("2026-10-08"));
  assert.equal(today.lectures.length, 5, "work was dropped rather than flagged");
  assert.equal(today.overloaded, true, "five lectures in one day was not flagged");
});

check("a past exam is not planned for", () => {
  const plan = buildPlan({
    lectures: [lecture(1, "2026-09-05")],
    exams: [exam("2026-10-01")],
    clinicalDays: [],
    today: d("2026-10-08"),
  });
  assert.equal(plan.plans.length, 0, "the engine planned for an exam that already happened");
});

/* ── skipping ───────────────────────────────────────────────────────────── */

check("SKIPPING A DAY MAKES THE REMAINING DAYS HEAVIER, BY ITSELF", () => {
  const lectures = [1, 2, 3, 4].map((n) => lecture(n, "2026-09-0" + n));
  const args = { lectures, exams: [exam("2026-10-13")], clinicalDays: [] };
  const onDay1 = buildPlan({ ...args, today: d("2026-10-08") });
  const onDay4 = buildPlan({ ...args, today: d("2026-10-11") });
  assert.ok(
    onDay4.plans[0].days.length < onDay1.plans[0].days.length,
    "the window did not shrink as the exam approached"
  );
  const heaviestBefore = Math.max(...onDay1.plans[0].days.map((x) => x.lectures.length));
  const heaviestAfter = Math.max(...onDay4.plans[0].days.map((x) => x.lectures.length));
  assert.ok(
    heaviestAfter > heaviestBefore,
    `skipping did not redistribute: ${heaviestBefore} then ${heaviestAfter}`
  );
});

check("studying one lecture lightens every remaining day", () => {
  const lectures = [1, 2, 3, 4].map((n) => lecture(n, "2026-09-0" + n));
  const before = buildPlan({
    lectures,
    exams: [exam("2026-10-12")],
    clinicalDays: [],
    today: d("2026-10-08"),
  });
  const after = buildPlan({
    lectures: lectures.map((l, i) => (i === 0 ? { ...l, studied: true } : l)),
    exams: [exam("2026-10-12")],
    clinicalDays: [],
    today: d("2026-10-08"),
  });
  assert.equal(before.plans[0].remaining, 4);
  assert.equal(after.plans[0].remaining, 3, "marking one studied did not reduce the load");
});

/* ── the pile ───────────────────────────────────────────────────────────── */

check(`un-studied for more than ${PILING_AFTER_DAYS} days with no exam is piling`, () => {
  const plan = buildPlan({
    lectures: [lecture(1, "2026-10-01")],
    exams: [],
    clinicalDays: [],
    today: d("2026-10-08"),
  });
  assert.deepEqual(plan.piling.map((l) => l.id), ["l1"]);
});

check("a lecture taught yesterday is not yet piling", () => {
  const plan = buildPlan({
    lectures: [lecture(1, "2026-10-07")],
    exams: [],
    clinicalDays: [],
    today: d("2026-10-08"),
  });
  assert.equal(plan.piling.length, 0, "a lecture one day old was called a pile");
});

check("A LECTURE INSIDE AN EXAM WINDOW IS SCHEDULED, NOT PILING", () => {
  /* Otherwise the Today screen says "you are behind" about the exact lecture
     it has just told the student to study this evening. */
  const plan = buildPlan({
    lectures: [lecture(1, "2026-09-05")],
    exams: [exam("2026-10-12")],
    clinicalDays: [],
    today: d("2026-10-08"),
  });
  assert.equal(plan.piling.length, 0, "a scheduled lecture was also reported as a pile");
  assert.equal(plan.plans[0].remaining, 1);
});

/* ── the day the student actually faces ─────────────────────────────────── */

check("TWO EXAMS IN ONE FORTNIGHT ADD UP INTO ONE DAY", () => {
  const plan = buildPlan({
    lectures: [
      ...[1, 2, 3, 4].map((n) => lecture(n, "2026-09-0" + n)),
      ...[5, 6, 7, 8].map((n) => ({ ...lecture(n, "2026-09-0" + (n - 4)), subjectId: "nurp431" })),
    ],
    exams: [exam("2026-10-12", "a"), exam("2026-10-13", "b", "nurp431")],
    clinicalDays: [],
    today: d("2026-10-08"),
  });
  const today = doseOn(plan, d("2026-10-08"));
  const perExam = plan.plans.map(
    (p) => p.days.find((x) => daysBetween(x.date, d("2026-10-08")) === 0)?.lectures.length ?? 0
  );
  assert.equal(
    today.lectures.length,
    perExam.reduce((s, n) => s + n, 0),
    "the day's total is not the sum of its exams"
  );
  assert.ok(today.lectures.length > 0, "both exams produced nothing today");
});

check("a hospital day is marked light on the Today screen", () => {
  const plan = buildPlan({
    lectures: [1, 2, 3, 4].map((n) => lecture(n, "2026-09-0" + n)),
    exams: [exam("2026-10-12")],
    clinicalDays: [d("2026-10-09")],
    today: d("2026-10-08"),
  });
  assert.equal(doseOn(plan, d("2026-10-09")).light, true, "the rota day was not marked light");
  assert.equal(doseOn(plan, d("2026-10-08")).light, false, "a free day was marked light");
});

check("a day with nothing on it returns an empty dose rather than throwing", () => {
  const plan = buildPlan({ lectures: [], exams: [], clinicalDays: [], today: d("2026-10-08") });
  const today = doseOn(plan, d("2026-10-08"));
  assert.deepEqual(today.lectures, []);
  assert.equal(today.overloaded, false);
});

/* ── this student, on this day ──────────────────────────────────────────── */

check("THIS STUDENT'S REAL MIDTERM, FOUR DAYS OUT", () => {
  /* Read from the database on 2026-10-08: NURC 410's midterm is 2026-10-12 and
     five of its lectures are not COMPLETED. */
  const real: PlannedLecture[] = [
    { id: "1", title: "GAS EXCHANGE", subjectId: COURSE, date: d("2026-09-05"), studied: false },
    { id: "2", title: "mechanical ventilation", subjectId: COURSE, date: d("2026-09-24"), studied: false },
    { id: "3", title: "Cardiovascular system", subjectId: COURSE, date: d("2026-09-24"), studied: false },
    { id: "4", title: "Revascular system", subjectId: COURSE, date: d("2026-09-24"), studied: false },
    { id: "5", title: "ECG", subjectId: COURSE, date: d("2026-10-02"), studied: false },
  ];
  const plan = buildPlan({
    lectures: real,
    exams: [{ id: "mid", title: "Midterm NURC 410", subjectId: COURSE, date: d("2026-10-12") }],
    clinicalDays: [],
    today: d("2026-10-08"),
  });

  const days = plan.plans[0].days;
  assert.equal(days.length, 4, `expected the 8th to the 11th, got ${days.length} days`);
  assert.equal(
    days.reduce((s, x) => s + x.lectures.length, 0),
    5,
    "the five lectures were not all planned"
  );
  /* Five over four days: nobody gets more than two, so no day is overloaded
     and the student is never told the plan does not fit when it does. */
  for (const day of days) {
    assert.ok(day.lectures.length <= 2, `a day got ${day.lectures.length} lectures`);
    assert.equal(day.overloaded, false, "a 2-lecture day was flagged as too much");
  }
  assert.equal(doseOn(plan, d("2026-10-08")).lectures.length, 2, "today's dose is wrong");
  assert.equal(plan.piling.length, 0, "scheduled lectures were also reported as a pile");
});

console.log("");
console.log(
  failures === 0
    ? `Every un-studied lecture has a day, and no day holds more than ${MAX_PER_DAY} quietly.`
    : `${failures} check(s) failed.`
);
process.exit(failures === 0 ? 0 : 1);
