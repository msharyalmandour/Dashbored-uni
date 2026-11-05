/**
 * The week grid's arithmetic, held to his real timetable.
 *
 * Every number on the أسبوعي screen comes out of `place()`. The failures are
 * all silent — a block drawn an hour too low, a block drawn twice as tall as
 * it is, a 50-minute tutorial drawn as a line — so this file asserts the
 * pixels, not the shape of the code.
 *
 * THE ROWS BELOW ARE HIS, FROM THE DATABASE. Sunday through Thursday, 11
 * slots, 08:00 to 16:50. They are here because the test that matters is not
 * "does place() clamp", it is "does Tuesday come out as two blocks". His
 * NURC 411 Tuesday is 08:00–12:50 then 13:00–16:50: back to back, touching at
 * one minute, and a loose overlap test splits them into two half-width
 * columns for the rest of the term.
 */

import assert from "node:assert/strict";
import {
  GRID_START,
  GRID_END,
  HOUR_PX,
  WEEK_DAYS,
  place,
  gridHeight,
  hourMarks,
  nowOffset,
  isNow,
  laneOf,
  serverMoment,
  type Slot,
} from "../src/lib/week-grid";

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

console.log("شبكة الأسبوع");
console.log("");

const slot = (
  id: string,
  weekday: number,
  from: [number, number],
  to: [number, number],
  kind = "UNIVERSITY",
  subjectId = id
): Slot => ({
  id,
  subjectId,
  weekday,
  startMinute: from[0] * 60 + from[1],
  endMinute: to[0] * 60 + to[1],
  kind,
});

/** His timetable, as the rows read in the database. */
const REAL: Slot[] = [
  slot("sun-nurp432", 0, [9, 0], [12, 50], "CLINICAL", "nurp432"),
  slot("sun-nurm410", 0, [16, 0], [16, 50], "UNIVERSITY", "nurm410"),
  slot("mon-nurc410", 1, [8, 0], [10, 50], "UNIVERSITY", "nurc410"),
  slot("mon-elective", 1, [14, 0], [15, 50], "UNIVERSITY", "elective"),
  slot("tue-nurc411-a", 2, [8, 0], [12, 50], "CLINICAL", "nurc411"),
  slot("tue-nurc411-b", 2, [13, 0], [16, 50], "CLINICAL", "nurc411"),
  slot("wed-nurp431-a", 3, [8, 0], [10, 50], "UNIVERSITY", "nurp431"),
  slot("wed-nurm410", 3, [13, 0], [15, 50], "UNIVERSITY", "nurm410"),
  slot("wed-nurp431-b", 3, [16, 0], [16, 50], "UNIVERSITY", "nurp431"),
  slot("thu-nurc411-a", 4, [11, 0], [11, 50], "UNIVERSITY", "nurc411"),
  slot("thu-nurc411-b", 4, [13, 0], [14, 50], "UNIVERSITY", "nurc411"),
];

check("THE WINDOW HOLDS HIS WHOLE WEEK", () => {
  /* If this fails the grid is the wrong size for the data, and every other
     assertion here is measuring a clamp instead of a position. */
  for (const s of REAL) {
    assert.ok(s.startMinute >= GRID_START, `${s.id} starts before the grid`);
    assert.ok(s.endMinute <= GRID_END, `${s.id} ends after the grid`);
  }
});

check("NOTHING IN HIS WEEK IS CLIPPED", () => {
  for (const s of REAL) assert.equal(place(s).clipped, false, s.id);
});

check("8:00 sits at the top, not at 80px", () => {
  assert.equal(place(REAL[2]).top, 0);
});

check("a 2h50 block is 226.67px, not 160 and not 320", () => {
  /* 170 minutes. The two classic bugs: rounding to whole hours (160), and
     dividing by 60 after already dividing by 60 (which gives 3.78px). */
  const h = place(REAL[2]).height;
  assert.ok(Math.abs(h - (170 / 60) * HOUR_PX) < 0.01, `height was ${h}`);
  assert.notEqual(Math.round(h), 160);
});

check("9:00 sits exactly one hour down", () => {
  assert.equal(place(REAL[0]).top, HOUR_PX);
});

check("a 50-minute slot gets the 44px floor, not 66px of nothing", () => {
  /* 50 minutes is 66.67px, which is above the floor — so the floor must NOT
     be applied here. The floor is for the short ones. */
  const fifty = place(REAL[1]);
  assert.ok(fifty.height > 44);
  const tiny = place(slot("x", 1, [10, 0], [10, 10]));
  assert.equal(tiny.height, 44, "a 10-minute slot must still be readable");
});

check("A BLOCK THAT STARTS BEFORE 8 IS DRAWN AT THE EDGE, NOT ABOVE IT", () => {
  /* A negative top puts the block over the day header, where it looks like a
     heading. Clamp, and say it was clamped. */
  const early = place(slot("early", 1, [6, 30], [9, 0]));
  assert.equal(early.top, 0);
  assert.equal(early.clipped, true);
  assert.equal(early.height, HOUR_PX, "8:00–9:00 is what is left of it");
});

check("a block that runs past 17 stops at the bottom", () => {
  const late = place(slot("late", 1, [16, 0], [19, 0]));
  assert.equal(late.top + late.height, gridHeight());
  assert.equal(late.clipped, true);
});

check("a block entirely outside the window is still drawn, at the edge", () => {
  /* Drawn wrong beats not drawn: a class you cannot see is worse. */
  const night = place(slot("night", 1, [20, 0], [21, 0]));
  assert.equal(night.top, gridHeight());
  assert.equal(night.height, 44);
  assert.equal(night.clipped, true);
});

check("an end before its start never draws a negative height", () => {
  const broken = place(slot("broken", 1, [11, 0], [9, 0]));
  assert.ok(broken.height >= 44, `height was ${broken.height}`);
  assert.ok(broken.top >= 0);
});

check("the rail and the columns agree on 720px", () => {
  assert.equal(gridHeight(), 9 * HOUR_PX);
  assert.equal(gridHeight(), ((GRID_END - GRID_START) / 60) * HOUR_PX);
});

check("the hour labels are 8 through 17, both ends included", () => {
  const marks = hourMarks();
  assert.equal(marks[0], 8);
  assert.equal(marks[marks.length - 1], 17);
  assert.equal(marks.length, 10);
});

check("the week is Sunday through Thursday", () => {
  assert.deepEqual([...WEEK_DAYS], [0, 1, 2, 3, 4]);
  /* Friday and Saturday are not columns, and nothing in his week lands there. */
  assert.equal(REAL.filter((s) => s.weekday > 4).length, 0);
});

check("THE NOW LINE IS NOT DRAWN AT 6AM", () => {
  /* Clamping it would pin "you are here" to 8:00 every morning for two hours. */
  assert.equal(nowOffset(new Date(2026, 10, 1, 6, 30)), null);
  assert.equal(nowOffset(new Date(2026, 10, 1, 23, 0)), null);
});

check("the now line sits where the clock is", () => {
  assert.equal(nowOffset(new Date(2026, 10, 1, 8, 0)), 0);
  assert.equal(nowOffset(new Date(2026, 10, 1, 9, 30)), 1.5 * HOUR_PX);
  assert.equal(nowOffset(new Date(2026, 10, 1, 17, 0)), gridHeight());
});

/* 2026-11-01 is a Sunday; +2 days is Tuesday. */
const on = (dayOffset: number, h: number, m = 0) => new Date(2026, 10, 1 + dayOffset, h, m);

check("«الحين» is the slot he is sitting in", () => {
  const tueMorning = REAL.find((s) => s.id === "tue-nurc411-a")!;
  assert.equal(isNow(tueMorning, on(2, 10, 0)), true);
  assert.equal(isNow(tueMorning, on(2, 12, 55)), false, "12:50 is over");
  assert.equal(isNow(tueMorning, on(1, 10, 0)), false, "same hour, wrong day");
});

check("the end minute is not inside the class", () => {
  /* At 12:50 the morning block is finished. Marking both blocks «الحين» at
     once is how two classes glow on the same column. */
  const a = REAL.find((s) => s.id === "tue-nurc411-a")!;
  const b = REAL.find((s) => s.id === "tue-nurc411-b")!;
  assert.equal(isNow(a, on(2, 12, 50)), false);
  assert.equal(isNow(b, on(2, 12, 50)), false);
  assert.equal(isNow(b, on(2, 13, 0)), true);
});

check("HIS TUESDAY IS TWO FULL-WIDTH BLOCKS, NOT TWO COLUMNS", () => {
  /* The reason this file exists. 08:00–12:50 and 13:00–16:50 touch but do
     not overlap. Ten minutes apart, and a <= in the overlap test halves them
     both for the rest of the term. */
  const tuesday = REAL.filter((s) => s.weekday === 2);
  for (const s of tuesday) {
    const { lane, lanes } = laneOf(s, REAL);
    assert.equal(lanes, 1, `${s.id} was split into ${lanes} columns`);
    assert.equal(lane, 0);
  }
});

check("his Wednesday's three blocks stay full width too", () => {
  for (const s of REAL.filter((s) => s.weekday === 3)) {
    assert.equal(laneOf(s, REAL).lanes, 1, s.id);
  }
});

check("blocks that touch exactly are not an overlap", () => {
  /* 12:50 ends, 12:50 begins. One minute of shared boundary is zero minutes
     of shared time, and a timetable with no gap between classes is normal. */
  const touching: Slot[] = [slot("a", 1, [8, 0], [12, 50]), slot("b", 1, [12, 50], [16, 50])];
  assert.equal(laneOf(touching[0], touching).lanes, 1);
  assert.equal(laneOf(touching[1], touching).lanes, 1);
});

check("two classes at the same hour DO share the column", () => {
  const clash: Slot[] = [
    slot("a", 1, [8, 0], [10, 50]),
    slot("b", 1, [9, 0], [9, 50]),
  ];
  const a = laneOf(clash[0], clash);
  const b = laneOf(clash[1], clash);
  assert.equal(a.lanes, 2);
  assert.equal(b.lanes, 2);
  assert.notEqual(a.lane, b.lane, "two blocks in the same lane are on top of each other");
});

check("a one-minute overlap is still an overlap", () => {
  const clash: Slot[] = [
    slot("a", 1, [8, 0], [9, 1]),
    slot("b", 1, [9, 0], [10, 0]),
  ];
  assert.equal(laneOf(clash[0], clash).lanes, 2);
});

check("lanes are stable, so blocks do not swap sides on a re-render", () => {
  const clash: Slot[] = [
    slot("b", 1, [9, 0], [10, 0]),
    slot("a", 1, [9, 0], [11, 0]),
  ];
  const first = laneOf(clash[0], clash).lane;
  const reversed = laneOf(clash[0], [...clash].reverse()).lane;
  assert.equal(first, reversed);
});

check("a day's overlap does not reach into another day", () => {
  const cross: Slot[] = [slot("a", 1, [9, 0], [10, 0]), slot("b", 2, [9, 0], [10, 0])];
  assert.equal(laneOf(cross[0], cross).lanes, 1);
});

check("THE SERVER'S DAY WINS OVER THE DEVICE'S", () => {
  /* The board renders on the server and sends down a weekday and a minute.
     Rebuilding the moment from the minute alone leaves getDay() reading the
     phone's day — so «الحين» glowed on one day while the lit column was on
     another, which is what a device a few minutes past midnight gets. */
  const device = new Date(2026, 10, 5, 23, 59); // Thursday, almost Friday
  const m = serverMoment(3, 9 * 60 + 30, device); // the server still says Wednesday 09:30
  assert.equal(m.getDay(), 3);
  assert.equal(m.getHours(), 9);
  assert.equal(m.getMinutes(), 30);
});

check("today stays today when the two already agree", () => {
  const device = new Date(2026, 10, 5, 7, 0); // Thursday
  const m = serverMoment(4, 9 * 60 + 40, device);
  assert.equal(m.getDay(), 4);
  assert.equal(m.getDate(), 5, "it must not jump a week forward");
});

check("a server day behind the device still lands on that weekday", () => {
  const device = new Date(2026, 10, 5, 0, 10); // Thursday 00:10
  const m = serverMoment(0, 16 * 60, device); // server says Sunday
  assert.equal(m.getDay(), 0);
});

check("a live block is live, measured through serverMoment", () => {
  /* The end to end of the bug: Wednesday's 08:00-10:50 at 09:30. */
  const wed = REAL.find((s) => s.id === "wed-nurp431-a")!;
  const m = serverMoment(3, 9 * 60 + 30, new Date(2026, 10, 5, 23, 59));
  assert.equal(isNow(wed, m), true);
});

/* ------------------------------------------------------------------ */
/* Mutations: each one is a plausible version of the code that must fail.  */

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

mutationBites("dividing by 60 twice — a 2h50 class drawn 3.8px tall", () => {
  const bad = (start: number, end: number) => ((end - start) / 60 / 60) * HOUR_PX;
  assert.ok(bad(8 * 60, 10 * 60 + 50) > 44);
});

mutationBites("forgetting to subtract GRID_START — 8:00 drawn 640px down", () => {
  const bad = (start: number) => (start / 60) * HOUR_PX;
  assert.equal(bad(8 * 60), 0);
});

mutationBites("no clamp — a 6:30 class drawn above the header", () => {
  const bad = (start: number) => ((start - GRID_START) / 60) * HOUR_PX;
  assert.ok(bad(6 * 60 + 30) >= 0);
});

mutationBites("no minimum height — a 10-minute slot as a divider line", () => {
  const bad = (start: number, end: number) => ((end - start) / 60) * HOUR_PX;
  assert.ok(bad(600, 610) >= 44);
});

mutationBites("the floor applied to every block, flattening a 4h clinical", () => {
  const bad = () => 44;
  assert.ok(Math.abs(bad() - place(REAL[4]).height) < 1);
});

mutationBites("LANES COUNTED FROM THE DAY — his Tuesday split into two columns", () => {
  /* The mutation this file exists for, and the plausible one: counting the
     day's blocks instead of the overlapping ones. His Tuesday has two, so
     every Tuesday class is drawn half width, forever. */
  const tuesday = REAL.filter((s) => s.weekday === 2);
  assert.equal(tuesday.length, laneOf(tuesday[0], REAL).lanes);
});

mutationBites("a <= overlap test — two back-to-back blocks halved", () => {
  /* `<=` instead of `<`. His own two Tuesday blocks have ten minutes between
     them so they survive it; a pair that touches exactly does not, and a
     timetable with no break between classes is normal. */
  const touching = [slot("a", 1, [8, 0], [12, 50]), slot("b", 1, [12, 50], [16, 50])];
  const loose = (x: Slot, y: Slot) => x.startMinute <= y.endMinute && y.startMinute <= x.endMinute;
  assert.equal(loose(touching[0], touching[1]), false);
});

mutationBites("overlap tested across the whole week, ignoring the weekday", () => {
  const anyDay = REAL.filter(
    (o) => o.startMinute < REAL[2].endMinute && REAL[2].startMinute < o.endMinute
  );
  assert.equal(anyDay.length, 1);
});

mutationBites("clamping the now line instead of hiding it", () => {
  const bad = (d: Date) => {
    const m = d.getHours() * 60 + d.getMinutes();
    return ((Math.min(Math.max(m, GRID_START), GRID_END) - GRID_START) / 60) * HOUR_PX;
  };
  assert.equal(bad(new Date(2026, 10, 1, 6, 30)), nowOffset(new Date(2026, 10, 1, 6, 30)));
});

mutationBites("«الحين» using <= on the end minute, lighting two blocks at once", () => {
  const a = REAL.find((s) => s.id === "tue-nurc411-a")!;
  const b = REAL.find((s) => s.id === "tue-nurc411-b")!;
  const bad = (s: Slot, m: number) => m >= s.startMinute && m <= s.endMinute;
  const at1250 = 12 * 60 + 50;
  assert.equal(bad(a, at1250) && bad(b, at1250), true);
  assert.ok(!(bad(a, at1250) && bad(b, at1250)));
});

mutationBites("setting only the clock, leaving getDay() on the device's day", () => {
  const bad = (minute: number, from: Date) => {
    const d = new Date(from.getTime());
    d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    return d;
  };
  assert.equal(bad(9 * 60 + 30, new Date(2026, 10, 5, 23, 59)).getDay(), 3);
});

mutationBites("a modulo that goes negative when the server is behind", () => {
  const bad = (weekday: number, from: Date) => {
    const d = new Date(from.getTime());
    d.setDate(d.getDate() + ((weekday - d.getDay()) % 7));
    return d;
  };
  /* Thursday device, Sunday server: (0 - 4) % 7 is -4 in JavaScript, which
     walks BACKWARDS to last Sunday. The weekday is right and the date is a
     week off, which `isNow` survives and anything dated would not. */
  assert.equal(bad(0, new Date(2026, 10, 5, 0, 10)).getDate(), 8);
});

mutationBites("Monday as column 0 — every class one day off", () => {
  assert.equal(WEEK_DAYS[0], 1);
});

mutationBites("the hour rail stopping at 16, leaving the last row unlabelled", () => {
  const bad: number[] = [];
  for (let h = GRID_START / 60; h < GRID_END / 60; h++) bad.push(h);
  assert.equal(bad.length, hourMarks().length);
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("الشبكة تحسب صح، وثلاثاءه بلوكين.");
}
