/**
 * The exam band, against the exam this student actually has.
 *
 * Read out of the database on 2026-10-01:
 *
 *     Midterm — Critical Care Nursing (NURC 410)    12 Oct    11 days away
 *       mechanical ventilation    51 pages   read to 1    50 unread
 *       Cardiovascular system     42 pages   read to 0    42 unread
 *       GAS EXCHANGE               1 page    read to 1     0 unread
 *       Revascular system          no deck                 0 unread
 *
 *     Next assignment               11 Oct    10 days away
 *     Next exam after the midterm   none in the term's remaining tasks
 *
 * Ninety-two unread pages, eleven days, and the app said nothing. Every number
 * was already stored; none of them had ever been put in one sentence.
 *
 * Run: npx tsx scripts/verify-exam-readiness.ts
 */

import {
  examReadiness,
  startWith,
  unreadOf,
  daysUntil,
  type ExamRow,
  type UnreadLecture,
} from "../src/lib/exam-readiness";

let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
    failed++;
  }
}

console.log("Exam readiness\n");

const NOW = new Date(2026, 9, 1, 9, 0, 0);
const d = (day: number) => new Date(2026, 9, day, 9, 0, 0);

const lec = (id: string, title: string, pages: number, furthestPage: number): UnreadLecture => ({
  lectureId: id, title, pages, furthestPage,
});

/* The real course. */
const NURC: UnreadLecture[] = [
  lec("vent", "mechanical ventilation", 51, 1),
  lec("cardio", "Cardiovascular system", 42, 0),
  lec("gas", "GAS EXCHANGE", 1, 1),
  lec("revasc", "Revascular system", 0, 0),
];

const MIDTERM: ExamRow = {
  id: "mid",
  title: "Midterm exam – Critical Care Nursing (NURC 410)",
  courseName: "NURC (410) Critical Care Nursing",
  deadline: d(12),
};

const byCourse = new Map([["NURC (410) Critical Care Nursing", NURC]]);

/* ── The real situation ───────────────────────────────────────────────────── */

{
  const r = examReadiness([MIDTERM], byCourse, NOW);
  ok("the band speaks", r.kind === "CALL", JSON.stringify(r));
  if (r.kind !== "CALL") process.exit(1);

  ok("eleven days", r.daysAway === 11, String(r.daysAway));
  ok("ninety-two unread pages", r.unreadPages === 92, String(r.unreadPages));
  // 92 / 11 = 8.36 → 9. Rounded up: a figure you can fall behind on, never one
  // that quietly promises a day you do not have.
  ok("nine pages a day", r.pagesPerDay === 9, String(r.pagesPerDay));

  // Started beats untouched, even though Cardiovascular is not much shorter.
  ok("it starts him on the lecture he is already inside",
    r.startLectureId === "vent", r.startLectureId);
  ok("and says how much of that one is left", r.startUnread === 50, String(r.startUnread));
}

{
  // The lecture with no deck contributes nothing — he cannot read a file that
  // does not exist, and counting it would inflate the total he is measured on.
  ok("a lecture with no material adds no unread pages", unreadOf(lec("x", "x", 0, 0)) === 0);
  // A count corrected downward must not produce a negative remainder.
  ok("being past the end is zero unread, never negative",
    unreadOf(lec("x", "x", 10, 99)) === 0);
}

/* ── When it stays quiet ──────────────────────────────────────────────────── */

{
  // THE THRESHOLD. While a page a day still gets there, the student knows
  // more about their own week than this band does.
  const far = { ...MIDTERM, deadline: new Date(2027, 2, 1) };
  ok("an exam far enough away that a page a day would do says nothing",
    examReadiness([far], byCourse, NOW).kind === "QUIET");

  // And the boundary is the sentence, not a constant: 92 pages, 92 days.
  const exactly = { ...MIDTERM, deadline: new Date(NOW.getTime() + 92 * 86_400_000) };
  ok("exactly a page a day is still quiet",
    examReadiness([exactly], byCourse, NOW).kind === "QUIET");
  const oneFewer = { ...MIDTERM, deadline: new Date(NOW.getTime() + 91 * 86_400_000) };
  ok("one day fewer than that speaks",
    examReadiness([oneFewer], byCourse, NOW).kind === "CALL");
}

{
  const readEverything = new Map([[
    "NURC (410) Critical Care Nursing",
    [lec("vent", "mechanical ventilation", 51, 51), lec("cardio", "Cardiovascular system", 42, 42)],
  ]]);
  ok("a student who has read the material is not told the date",
    examReadiness([MIDTERM], readEverything, NOW).kind === "QUIET");

  ok("an exam already past is not a call to action",
    examReadiness([{ ...MIDTERM, deadline: d(1) }], byCourse, NOW).kind === "QUIET");

  ok("no exams at all is quiet", examReadiness([], byCourse, NOW).kind === "QUIET");

  ok("an exam whose course has no material is quiet",
    examReadiness([{ ...MIDTERM, courseName: "NURP (431) Nursing Leadership" }], byCourse, NOW).kind === "QUIET");
}

/* ── Which exam, when there are several ───────────────────────────────────── */

{
  const later: ExamRow = { ...MIDTERM, id: "late", title: "Final", deadline: d(30) };
  const r = examReadiness([later, MIDTERM], byCourse, NOW);
  ok("the nearest exam wins, whatever order they arrive in",
    r.kind === "CALL" && r.daysAway === 11, JSON.stringify(r));

  /* The distinguishing case: the nearest exam's reading is DONE, so the band
     moves to the one behind it rather than falling silent. Reading only the
     first upcoming exam would have gone quiet here. */
  const twoCourses = new Map([
    ["A", [lec("a", "A", 10, 10)]],
    ["B", [lec("b", "B", 60, 0)]],
  ]);
  const soonDone: ExamRow = { id: "1", title: "A exam", courseName: "A", deadline: d(5) };
  const laterOpen: ExamRow = { id: "2", title: "B exam", courseName: "B", deadline: d(20) };
  const r2 = examReadiness([soonDone, laterOpen], twoCourses, NOW);
  ok("an exam whose reading is done is skipped for the next one that is not",
    r2.kind === "CALL" && r2.examTitle === "B exam", JSON.stringify(r2));
}

/* ── Days, and where to start ─────────────────────────────────────────────── */

{
  // Rounded up: an exam in twenty-six hours is two days, not one. Rounding
  // down promises a day that does not exist.
  ok("part of a day counts as a day",
    daysUntil(new Date(NOW.getTime() + 26 * 3_600_000), NOW) === 2);
  ok("an exam in the past is zero days, never negative",
    daysUntil(d(1), NOW) === 0);
}

{
  ok("nothing to read means nowhere to start", startWith([lec("x", "x", 5, 5)]) === null);
  ok("with nothing started, the longest unread wins",
    startWith([lec("s", "short", 10, 0), lec("l", "long", 40, 0)])?.lectureId === "l");
  // The rule that costs something: a started lecture wins even when the
  // untouched one is four times longer.
  ok("a started lecture beats a longer untouched one",
    startWith([lec("s", "started", 10, 3), lec("l", "long", 40, 0)])?.lectureId === "s");
}

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
