/**
 * The week map, checked against the cases that actually bite.
 *
 * Lane assignment and window clamping are the two places this can silently go
 * wrong: a lane bug hides one class behind another, and a window bug renders a
 * day as a single fat bar. Neither throws, and neither is visible in a diff.
 */
import assert from "node:assert/strict";
import { buildWeekMap, startOfWeek, activeWindow, type WeekInput } from "../src/lib/week-map";

let failures = 0;
function check(name: string, run: () => void) {
  try {
    run();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** A Tuesday, so nothing depends on the test running on a particular day. */
const NOW = new Date(2026, 8, 15, 10, 30);
const WEEK = startOfWeek(NOW);

function at(dayIndex: number, hour: number, minute = 0): Date {
  const d = new Date(WEEK);
  d.setDate(d.getDate() + dayIndex);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function input(over: Partial<WeekInput> = {}): WeekInput {
  return {
    weekStart: WEEK,
    now: NOW,
    events: [],
    commitments: [],
    tasks: [],
    reviews: [],
    reviewLabel: "مراجعة",
    ...over,
  };
}

function ev(id: string, dayIndex: number, from: number, to: number) {
  return { id, title: id, type: "LECTURE", startsAt: at(dayIndex, from), endsAt: at(dayIndex, to), subjectId: null };
}

function main() {
  console.log("\nThe week, drawn rather than explained\n");

  check("the week starts on Saturday", () => {
    assert.equal(WEEK.getDay(), 6, "getDay() 6 is Saturday");
    assert.ok(WEEK <= NOW, "the week containing now cannot start after it");
    // An empty week draws the five teaching days; the weekend has to earn its
    // column. `days` is what gets drawn, never the seven of the calendar week.
    const map = buildWeekMap(input());
    assert.equal(map.days.length, 5);
    assert.deepEqual(map.days.map((d) => d.index), [1, 2, 3, 4, 5]);
    assert.equal(map.days.filter((d) => d.isToday).length, 1, "exactly one day is today");
  });

  check("two classes at the same hour get different lanes", () => {
    const map = buildWeekMap(input({ events: [ev("a", 1, 9, 11), ev("b", 1, 10, 12)] }));
    const [a, b] = ["event:a", "event:b"].map((id) => map.spans.find((s) => s.id === id)!);
    assert.notEqual(a.lane, b.lane, "overlapping spans must not share a lane");
    assert.equal(a.laneCount, 2);
    assert.equal(b.laneCount, 2, "both sides of an overlap report the same width");
  });

  check("classes that do not overlap share one lane", () => {
    const map = buildWeekMap(input({ events: [ev("a", 1, 9, 10), ev("b", 1, 11, 12)] }));
    for (const s of map.spans) {
      assert.equal(s.lane, 0, `${s.id} should reuse the free lane`);
      assert.equal(s.laneCount, 1, `${s.id} should not be narrowed by a stranger`);
    }
  });

  check("a busy morning does not narrow a lonely evening", () => {
    // The bug this exists to stop: computing laneCount per DAY rather than per
    // overlapping cluster, which squeezes the 8pm class to a third for no reason.
    const map = buildWeekMap(input({
      events: [ev("m1", 2, 9, 11), ev("m2", 2, 9, 11), ev("m3", 2, 9, 11), ev("evening", 2, 20, 21)],
    }));
    const evening = map.spans.find((s) => s.id === "event:evening")!;
    assert.equal(evening.laneCount, 1, "an evening alone is full width");
    assert.equal(map.spans.find((s) => s.id === "event:m1")!.laneCount, 3);
  });

  check("an event with no end still has a duration", () => {
    const map = buildWeekMap(input({
      events: [{ id: "x", title: "x", type: "LECTURE", startsAt: at(1, 9), endsAt: null, subjectId: null }],
    }));
    const s = map.spans[0];
    assert.ok(s.endMinute > s.startMinute, "a zero-width bar is invisible");
  });

  check("a recurring commitment lands on the right column", () => {
    // weekday 0 = Sunday, and the grid starts on Saturday, so Sunday is index 1.
    const map = buildWeekMap(input({
      commitments: [{ id: "c", label: "عمل", kind: "WORK", weekday: 0, startMinute: 540, endMinute: 660, subjectId: null }],
    }));
    assert.equal(map.spans[0].dayIndex, 1, "Sunday sits one index after Saturday");
    // Looked up by index, never by position — position shifts with the weekend.
    const sunday = map.days.find((d) => d.index === 1)!;
    assert.equal(sunday.date.getDay(), 0, "and that day really is a Sunday");
  });

  check("a deadline is a point, and the work behind it is separate", () => {
    const map = buildWeekMap(input({
      tasks: [{ id: "t", title: "تقرير", deadline: at(3, 23, 59), estimatedMinutes: 90, status: "NOT_STARTED", subjectId: null }],
    }));
    assert.equal(map.points.length, 1, "the deadline is drawn");
    assert.equal(map.spans.length, 0, "but never as a block of hours nobody scheduled");
    assert.equal(map.unplaced.length, 1, "the work itself waits in the tray");
    assert.equal(map.unplaced[0].minutes, 90);
  });

  check("finished tasks leave the week", () => {
    const map = buildWeekMap(input({
      tasks: [
        { id: "done", title: "خلصت", deadline: at(2, 12), estimatedMinutes: 30, status: "COMPLETED", subjectId: null },
        { id: "open", title: "باقية", deadline: at(2, 12), estimatedMinutes: 30, status: "NOT_STARTED", subjectId: null },
      ],
    }));
    assert.deepEqual(map.points.map((p) => p.id), ["task:open"]);
    assert.deepEqual(map.unplaced.map((u) => u.id), ["task:open"]);
  });

  check("sixty-nine reviews become one mark per day, not sixty-nine", () => {
    const reviews = Array.from({ length: 69 }, (_, i) => ({
      id: `r${i}`, scheduledDate: at(2, 9), status: "DUE", subjectId: null,
    }));
    const map = buildWeekMap(input({ reviews }));
    const marks = map.points.filter((p) => p.kind === "REVIEW");
    assert.equal(marks.length, 1, "one day, one mark");
    assert.ok(marks[0].title.startsWith("69"), `expected a count, got ${marks[0].title}`);
  });

  check("the window covers the day's real extent, padded", () => {
    const w = activeWindow([{ startMinute: 9 * 60, endMinute: 17 * 60 }]);
    assert.ok(w.startMinute <= 8 * 60, `starts before the first class, got ${w.startMinute}`);
    assert.ok(w.endMinute >= 18 * 60, `ends after the last, got ${w.endMinute}`);
    assert.ok(w.startMinute >= 0 && w.endMinute <= 1440, "and stays inside a day");
  });

  check("one short class still gets a readable window", () => {
    // Without a floor, a single 09:00–09:30 class renders as one fat bar filling
    // the screen, which tells the student nothing about when their day is.
    const w = activeWindow([{ startMinute: 540, endMinute: 570 }]);
    assert.ok(w.endMinute - w.startMinute >= 6 * 60, `window was ${w.endMinute - w.startMinute} minutes`);
  });

  check("a midnight deadline does not stretch the grid to midnight", () => {
    // Rendered, this was the fault: one 23:59 due date pulled the window down
    // to 24:00, so two thirds of every column was empty and the deadline's own
    // label was clipped by the bottom edge.
    const map = buildWeekMap(input({
      events: [ev("class", 1, 9, 11)],
      tasks: [{ id: "t", title: "تقرير", deadline: at(1, 23, 59), estimatedMinutes: null, status: "NOT_STARTED", subjectId: null }],
    }));
    assert.ok(map.window.endMinute <= 13 * 60, `window ran to ${map.window.endMinute} minutes`);
    assert.equal(map.points.length, 1, "the deadline is still reported");
  });

  check("the weekend is dropped unless it carries something", () => {
    // The teaching week is Sunday–Thursday. Drawing Friday and Saturday always
    // spends two of seven columns on nothing — 29% of the width, on a phone.
    const quiet = buildWeekMap(input({ events: [ev("sun", 1, 9, 11)] }));
    assert.equal(quiet.days.length, 5, "a normal week is five columns");
    assert.deepEqual(quiet.days.map((d) => d.index), [1, 2, 3, 4, 5]);

    const busy = buildWeekMap(input({ events: [ev("sun", 1, 9, 11), ev("sat", 0, 10, 12)] }));
    assert.equal(busy.days.length, 6, "a Saturday with a class earns its column");
    assert.ok(busy.days.some((d) => d.index === 0));
  });

  check("a span keeps its own day index when the weekend is dropped", () => {
    // The bug this exists to stop: the timeline filtered spans by the ARRAY
    // position of the day, which stops matching the moment a column is removed
    // — Sunday's classes would be drawn in Monday's column with no error.
    const map = buildWeekMap(input({ events: [ev("wed", 4, 9, 11)] }));
    const span = map.spans[0];
    const column = map.days.findIndex((d) => d.index === span.dayIndex);
    assert.notEqual(column, -1, "the span's day must still be drawn");
    assert.equal(map.days[column].date.getDay(), 3, "index 4 really is a Wednesday");
    assert.notEqual(column, span.dayIndex, "and position is NOT the index — that is the trap");
  });

  check("a timetable's own session types survive", () => {
    const kinds = ["LECTURE", "TUTORIAL", "LAB", "CLINICAL", "ACTIVITY"];
    const map = buildWeekMap(input({
      events: kinds.map((t, i) => ({
        id: t, title: t, type: t, startsAt: at(2, 8 + i), endsAt: at(2, 9 + i), subjectId: null,
      })),
    }));
    assert.deepEqual(
      map.spans.map((s) => s.kind).sort(),
      ["ACTIVITY", "CLASS", "CLINICAL", "LAB", "TUTORIAL"],
      "three of these used to collapse into one grey block"
    );
  });

  check("an empty week says so once instead of apologising three times", () => {
    const map = buildWeekMap(input());
    assert.equal(map.empty, true);
    assert.equal(map.spans.length + map.points.length + map.unplaced.length, 0);
  });

  check("last week's data does not leak into this week's grid", () => {
    const lastWeek = new Date(WEEK);
    lastWeek.setDate(lastWeek.getDate() - 3);
    const map = buildWeekMap(input({
      events: [{ id: "old", title: "قديمة", type: "LECTURE", startsAt: lastWeek, endsAt: null, subjectId: null }],
    }));
    assert.equal(map.spans.length, 0, "a class outside the window is not drawn");
  });

  check("the now line is only drawn on the week that contains now", () => {
    const here = buildWeekMap(input());
    assert.ok(here.now, "this week has a now line");
    assert.equal(here.now!.minute, 10 * 60 + 30);

    const next = new Date(WEEK);
    next.setDate(next.getDate() + 7);
    const later = buildWeekMap(input({ weekStart: next }));
    assert.equal(later.now, null, "next week must not claim to contain now");
  });

  console.log("");
  if (failures > 0) {
    console.log(`${failures} failed.\n`);
    process.exit(1);
  }
  console.log("The week assembles from every source it has.\n");
}

main();
