/**
 * The sheet's three numbers, held to the ways they go wrong quietly.
 *
 * None of these throws when it is wrong. A sheet that says "جاوبت 5 من 8"
 * when two of those five are blank, or "بعد 2 يوم و57 س" on a deadline two
 * days out, or a live "سلّم" on a sheet with nothing on it — all three render
 * perfectly and all three are the app lying to a student about work he is
 * being marked on.
 */

import assert from "node:assert/strict";
import {
  isAnswered,
  isStarted,
  answeredCount,
  nextUnanswered,
  canSubmit,
  timeLeft,
  savedMinutesAgo,
  lastSavedAt,
  type SheetAnswer,
} from "../src/lib/sheet";

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

console.log("الشيت");
console.log("");

const q = (id: string, answer: string | null, answeredAt: Date | null = null): SheetAnswer => ({
  id,
  answer,
  answeredAt,
});

/* His real one: "Problem solving form (with evidence) + Leadership checklist",
   NURP 431, due 2026-11-08 00:00. Eight questions is the shape a problem
   solving form takes; the count here is a fixture, the deadline is his. */
const DUE = new Date(2026, 10, 8, 0, 0);

check("AN ANSWER THAT IS ONLY SPACES IS NOT AN ANSWER", () => {
  assert.equal(isAnswered(q("a", "   ")), false);
  assert.equal(isAnswered(q("b", "\n\t ")), false);
  assert.equal(isAnswered(q("c", "لأن الفريق ما كان عنده خطة")), true);
});

check("null and empty are both unanswered, and are not the same thing", () => {
  assert.equal(isAnswered(q("a", null)), false);
  assert.equal(isAnswered(q("b", "")), false);
  assert.equal(isStarted(q("a", null)), false);
  assert.equal(isStarted(q("b", "")), true, "he opened it and cleared it");
});

check("THE COUNT DOES NOT COUNT A FIELD HE CLEARED", () => {
  const sheet = [q("1", "جواب"), q("2", ""), q("3", "   "), q("4", "جواب"), q("5", null)];
  assert.equal(answeredCount(sheet), 2);
});

check("«كمّل السؤال N» sends him to a gap, not to where he was", () => {
  const sheet = [q("1", "جواب"), q("2", "جواب"), q("3", null), q("4", "جواب")];
  assert.equal(nextUnanswered(sheet), 3);
});

check("nothing left to fill reads as null, not as question 1", () => {
  assert.equal(nextUnanswered([q("1", "a"), q("2", "b")]), null);
});

check("AN EMPTY SHEET CANNOT BE SUBMITTED", () => {
  /* `[].every(...)` is true. The one-liner lights «سلّم» on a sheet whose
     questions failed to import — the single case where submitting is
     guaranteed to be the wrong thing. */
  assert.equal(canSubmit([]), false);
});

check("«سلّم» goes live only when every question has something in it", () => {
  assert.equal(canSubmit([q("1", "a"), q("2", "")]), false);
  assert.equal(canSubmit([q("1", "a"), q("2", "b")]), true);
});

check("THE HOURS ARE THE REMAINDER AFTER THE DAYS", () => {
  /* 2 days 9 hours before his 8 Nov deadline. The bug: dividing the whole
     gap by an hour, which renders "بعد 2 يوم و57 س". */
  const now = new Date(2026, 10, 5, 15, 0);
  const t = timeLeft(DUE, now);
  assert.equal(t.days, 2);
  assert.equal(t.hours, 9);
  assert.ok(t.hours < 24);
  assert.equal(t.late, false);
});

check("47 hours is one day and 23 hours, never two days", () => {
  /* Rounding up here tells him he has two days when he has one. */
  const now = new Date(DUE.getTime() - 47 * 3600000);
  const t = timeLeft(DUE, now);
  assert.equal(t.days, 1);
  assert.equal(t.hours, 23);
});

check("past due is reported as late, not as a negative day count", () => {
  const now = new Date(2026, 10, 10, 9, 0); // two days after
  const t = timeLeft(DUE, now);
  assert.equal(t.late, true);
  assert.ok(t.days >= 0, `days was ${t.days}`);
  assert.ok(t.hours >= 0 && t.hours < 24);
});

check("under an hour either side is imminent", () => {
  assert.equal(timeLeft(DUE, new Date(DUE.getTime() - 30 * 60000)).imminent, true);
  assert.equal(timeLeft(DUE, new Date(DUE.getTime() + 30 * 60000)).imminent, true);
  assert.equal(timeLeft(DUE, new Date(DUE.getTime() - 5 * 3600000)).imminent, false);
});

check("exactly on the deadline is not yet late", () => {
  const t = timeLeft(DUE, DUE);
  assert.equal(t.late, false);
  assert.equal(t.days, 0);
  assert.equal(t.hours, 0);
});

check("ZERO MINUTES AGO IS ZERO, NOT ONE", () => {
  /* Rounding it up to make the sentence read better is the app reporting a
     minute that did not pass. The screen has a word for 0. */
  const now = new Date(2026, 10, 5, 12, 0, 0);
  assert.equal(savedMinutesAgo(new Date(2026, 10, 5, 11, 59, 50), now), 0);
  assert.equal(savedMinutesAgo(new Date(2026, 10, 5, 11, 59, 0), now), 1);
  assert.equal(savedMinutesAgo(new Date(2026, 10, 5, 11, 0, 0), now), 60);
});

check("a clock a few seconds ahead never says «saved in 2 minutes»", () => {
  const now = new Date(2026, 10, 5, 12, 0, 0);
  assert.equal(savedMinutesAgo(new Date(2026, 10, 5, 12, 0, 30), now), 0);
});

check("nothing saved yet says nothing", () => {
  assert.equal(savedMinutesAgo(null, new Date()), null);
});

check("the sheet's save line takes the LATEST question, not the first", () => {
  const sheet = [
    q("1", "a", new Date(2026, 10, 5, 10, 0)),
    q("2", "b", new Date(2026, 10, 5, 11, 30)),
    q("3", null, null),
  ];
  assert.equal(lastSavedAt(sheet)?.getHours(), 11);
});

check("a sheet nobody has written on has no save line", () => {
  assert.equal(lastSavedAt([q("1", null), q("2", null)]), null);
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

mutationBites("counting a field he typed in and cleared", () => {
  const bad = (x: SheetAnswer) => x.answer !== null;
  const sheet = [q("1", "جواب"), q("2", ""), q("3", "   ")];
  assert.equal(sheet.filter(bad).length, answeredCount(sheet));
});

mutationBites("length > 0 instead of trimmed — a space counts as an answer", () => {
  const bad = (x: SheetAnswer) => (x.answer ?? "").length > 0;
  assert.equal(bad(q("a", "   ")), false);
});

mutationBites("`every` alone — «سلّم» live on a sheet with no questions", () => {
  const bad = (qs: SheetAnswer[]) => qs.every(isAnswered);
  assert.equal(bad([]), false);
});

mutationBites("the hours as the whole gap — «بعد 2 يوم و57 س»", () => {
  const now = new Date(2026, 10, 5, 15, 0);
  const bad = Math.floor((DUE.getTime() - now.getTime()) / 3600000);
  assert.ok(bad < 24, `bad hours was ${bad}`);
});

mutationBites("rounding the days up — two days when he has one", () => {
  const now = new Date(DUE.getTime() - 47 * 3600000);
  const bad = Math.round((DUE.getTime() - now.getTime()) / 86400000);
  assert.equal(bad, 1);
});

mutationBites("no absolute value — «بعد -2 يوم» after the deadline", () => {
  const now = new Date(2026, 10, 10, 9, 0);
  const bad = Math.floor((DUE.getTime() - now.getTime()) / 86400000);
  assert.ok(bad >= 0, `bad days was ${bad}`);
});

mutationBites("the last unanswered instead of the first", () => {
  const sheet = [q("1", "جواب"), q("2", null), q("3", "جواب"), q("4", null)];
  const bad = sheet.map((x, i) => (isAnswered(x) ? -1 : i)).filter((i) => i >= 0).pop()! + 1;
  assert.equal(bad, nextUnanswered(sheet));
});

mutationBites("the save line taking the first question rather than the latest", () => {
  const sheet = [
    q("1", "a", new Date(2026, 10, 5, 10, 0)),
    q("2", "b", new Date(2026, 10, 5, 11, 30)),
  ];
  assert.equal(sheet.find((x) => x.answeredAt)?.answeredAt?.getHours(), lastSavedAt(sheet)?.getHours());
});

mutationBites("rounding the save up so it never says «الحين»", () => {
  const now = new Date(2026, 10, 5, 12, 0, 0);
  const bad = Math.max(1, Math.floor((now.getTime() - new Date(2026, 10, 5, 11, 59, 50).getTime()) / 60000));
  assert.equal(bad, 0);
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("الشيت يعدّ صح، والوقت الباقي يقول الصدق.");
}
