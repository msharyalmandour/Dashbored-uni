/**
 * The day panel, against the account whose day it had stopped showing.
 *
 * Read out of the database on 2026-09-30. The student's timetable, as eleven
 * recurring weekly commitments (weekday 0 = Sunday, the Saudi week):
 *
 *   Sun  09:00-12:50 NURP (432) Nursing Leadership   CLINICAL
 *        16:00-16:50 NURM (410) Research Methods
 *   Mon  08:00-10:50 NURC (410) Critical Care Nursing
 *        14:00-15:50 Elective Course
 *   Tue  08:00-12:50 NURC (411) Critical Care Nursing CLINICAL
 *        13:00-16:50 NURC (411) Critical Care Nursing CLINICAL
 *   Wed  08:00-10:50 NURP (431) Nursing Leadership
 *        13:00-15:50 NURM (410) Research Methods
 *        16:00-16:50 NURP (431) Nursing Leadership
 *   Thu  11:00-11:50 NURC (411) Critical Care Nursing
 *        13:00-14:50 NURC (411) Critical Care Nursing
 *
 * And the same eleven classes AGAIN as dated events — but only for the week
 * of 10-16 September, which is the week the importer ran. Zero dated events
 * exist on or after that. It was 30 September.
 *
 * So the panel whose entire job is "what do I have today" had been empty for
 * a fortnight, on an account whose timetable was correct and stored the whole
 * time. The first test below is that refutation.
 *
 * Run: npx tsx scripts/verify-today-classes.ts
 */

import { classesOn, nextUp, minuteOfDay, type DatedRow } from "../src/lib/today-classes";
import type { CommitmentRow } from "../src/lib/time-intelligence";

let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
    failed++;
  }
}

console.log("Today's classes\n");

const c = (
  id: string,
  weekday: number | null,
  startMinute: number,
  endMinute: number,
  label: string | null,
  kind = "UNIVERSITY"
): CommitmentRow => ({ id, kind: kind as CommitmentRow["kind"], label, weekday, startMinute, endMinute });

/* The real eleven. */
const TIMETABLE: CommitmentRow[] = [
  c("s1", 0, 540, 770, "NURP (432) Nursing Leadership", "CLINICAL"),
  c("s2", 0, 960, 1010, "NURM (410) Research Methods"),
  c("m1", 1, 480, 650, "NURC (410) Critical Care Nursing"),
  c("m2", 1, 840, 950, "Elective Course"),
  c("t1", 2, 480, 770, "NURC (411) Critical Care Nursing", "CLINICAL"),
  c("t2", 2, 780, 1010, "NURC (411) Critical Care Nursing", "CLINICAL"),
  c("w1", 3, 480, 650, "NURP (431) Nursing Leadership"),
  c("w2", 3, 780, 950, "NURM (410) Research Methods"),
  c("w3", 3, 960, 1010, "NURP (431) Nursing Leadership"),
  c("h1", 4, 660, 710, "NURC (411) Critical Care Nursing"),
  c("h2", 4, 780, 890, "NURC (411) Critical Care Nursing"),
];

/* Wednesday 30 September 2026 — the day it was measured. */
const WED = new Date(2026, 8, 30, 9, 0, 0);

/* ── The refutation ───────────────────────────────────────────────────────── */

{
  // Dated events exist only for 10-16 September. On the 30th there are none,
  // which is exactly what the panel was being handed.
  const datedToday: DatedRow[] = [];
  ok("the old source has nothing to show on this day", datedToday.length === 0);

  const day = classesOn(TIMETABLE, datedToday, WED);
  ok("the recurring source has his three Wednesday classes",
    day.length === 3, JSON.stringify(day.map((d) => d.title)));
  ok("in the order he attends them",
    day.map((d) => d.startMinute).join() === "480,780,960", JSON.stringify(day.map((d) => d.startMinute)));
  ok("with real durations, not guesses",
    day.map((d) => d.minutes).join() === "170,170,50", JSON.stringify(day.map((d) => d.minutes)));
  ok("and the right lecture first",
    day[0].title === "NURP (431) Nursing Leadership", day[0].title);
}

{
  // Each weekday gets its own classes, and Friday and Saturday get none —
  // the Saudi weekend, which is what weekdays 5 and 6 being absent means.
  const count = (weekday: number) =>
    classesOn(TIMETABLE, [], new Date(2026, 8, 27 + weekday)).length;
  ok("Sunday has two", count(0) === 2, String(count(0)));
  ok("Tuesday has two clinicals", count(2) === 2, String(count(2)));
  ok("Friday has none", count(5) === 0, String(count(5)));
  ok("Saturday has none", count(6) === 0, String(count(6)));
  ok("the whole week adds up to the eleven he imported",
    [0, 1, 2, 3, 4, 5, 6].reduce((n, d) => n + count(d), 0) === 11);
}

/* ── The week both tables describe ────────────────────────────────────────── */

{
  /* Wednesday 16 September: the importer wrote the weekly shape AND that
     week's dated rows, so both sources describe the same three classes.
     Showing six would read as a broken timetable rather than a bug in one
     query. */
  const sept16 = new Date(2026, 8, 16, 9, 0, 0);
  const dated: DatedRow[] = [
    {
      id: "e1", title: "NURP (431) Nursing Leadership", type: "LECTURE",
      startsAt: new Date(2026, 8, 16, 8, 0), endsAt: new Date(2026, 8, 16, 10, 50),
      location: null, subjectName: "NURP (431) Nursing Leadership", subjectColor: "#7c3aed", lectureId: "lec1",
    },
    {
      id: "e2", title: "NURM (410) Research Methods", type: "LECTURE",
      startsAt: new Date(2026, 8, 16, 13, 0), endsAt: new Date(2026, 8, 16, 15, 50),
      location: null, subjectName: null, subjectColor: null, lectureId: null,
    },
    {
      id: "e3", title: "NURP (431) Nursing Leadership", type: "LECTURE",
      startsAt: new Date(2026, 8, 16, 16, 0), endsAt: new Date(2026, 8, 16, 16, 50),
      location: null, subjectName: null, subjectColor: null, lectureId: null,
    },
  ];

  const day = classesOn(TIMETABLE, dated, sept16);
  ok("a week both tables describe shows each class once, not twice",
    day.length === 3, `${day.length}: ${JSON.stringify(day.map((d) => `${d.startMinute}${d.recurring ? "R" : "D"}`))}`);
  ok("and the dated row is the one kept, because it knows the room and the lecture",
    day.every((d) => !d.recurring) && day[0].lectureId === "lec1",
    JSON.stringify(day.map((d) => ({ r: d.recurring, l: d.lectureId }))));
}

{
  // A class MOVED to a different hour is a different fact, and both must
  // show: one of the two is the student's day being wrong, and hiding either
  // is how they miss it.
  const moved: DatedRow[] = [{
    id: "moved", title: "NURP (431) Nursing Leadership (moved)", type: "LECTURE",
    startsAt: new Date(2026, 8, 30, 11, 0), endsAt: new Date(2026, 8, 30, 12, 0),
    location: "Room 4", subjectName: null, subjectColor: null, lectureId: null,
  }];
  const day = classesOn(TIMETABLE, moved, WED);
  ok("a class moved to another hour shows alongside the weekly one",
    day.length === 4, JSON.stringify(day.map((d) => d.startMinute)));
  ok("and it sorts into its real place in the day",
    day.map((d) => d.startMinute).join() === "480,660,780,960",
    JSON.stringify(day.map((d) => d.startMinute)));
}

{
  // A one-off with no end time — the column allows it, and a deadline is a
  // moment. No duration is better than an invented hour.
  const instant: DatedRow[] = [{
    id: "x", title: "Assignment due", type: "DEADLINE",
    startsAt: new Date(2026, 8, 30, 23, 59), endsAt: null,
    location: null, subjectName: null, subjectColor: null, lectureId: null,
  }];
  const day = classesOn(TIMETABLE, instant, WED);
  ok("an event with no end shows no duration rather than a guessed one",
    day[day.length - 1].minutes === null, JSON.stringify(day[day.length - 1]));
}

/* ── What is a class, and what is a life ──────────────────────────────────── */

{
  // Sleep, meals and a commute are commitments too, and they are not the
  // student's timetable. Putting them on the day panel would bury three
  // classes under "sleep" every morning.
  const withLife: CommitmentRow[] = [
    ...TIMETABLE,
    c("sleep", null, 1380, 420, "Sleep", "SLEEP"),
    c("meal", null, 720, 780, null, "MEALS"),
    c("drive", 3, 420, 480, "Commute", "COMMUTE"),
  ];
  const day = classesOn(withLife, [], WED);
  ok("sleep, meals and the commute are not classes",
    day.length === 3, JSON.stringify(day.map((d) => d.title)));
  ok("and the three real ones are untouched",
    day.map((d) => d.startMinute).join() === "480,780,960");
}

{
  // An unlabelled class is shown by its kind. `label` is optional on purpose
  // — "the kind alone is often enough" for a commute — so an empty row is a
  // reachable state and must not render as a blank line.
  const day = classesOn([c("n", 3, 600, 660, null, "CLINICAL")], [], WED);
  ok("an unlabelled commitment still says something", day[0].title === "CLINICAL", day[0]?.title);
  ok("and a clinical keeps its type so the timeline can colour it",
    day[0].type === "CLINICAL", day[0]?.type);
}

/* ── What is next ─────────────────────────────────────────────────────────── */

{
  const day = classesOn(TIMETABLE, [], WED);

  ok("before the day starts, the first class is next",
    nextUp(day, minuteOfDay(new Date(2026, 8, 30, 7, 30)))?.startMinute === 480);

  // Sitting IN the 08:00 lecture at 09:00. The next thing is the 13:00, not
  // the room he is already in — being told to head somewhere he is sitting is
  // the kind of wrongness that costs trust in everything else on the screen.
  ok("during a class, the NEXT one is next",
    nextUp(day, minuteOfDay(new Date(2026, 8, 30, 9, 0)))?.startMinute === 780);

  // Exactly on the hour it begins: it has started, so it is not "next".
  ok("a class starting this very minute is not 'next'",
    nextUp(day, 480)?.startMinute === 780, JSON.stringify(nextUp(day, 480)));

  ok("after the last class there is nothing next",
    nextUp(day, minuteOfDay(new Date(2026, 8, 30, 17, 30))) === null);
  ok("an empty day has nothing next", nextUp([], 600) === null);
}

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
