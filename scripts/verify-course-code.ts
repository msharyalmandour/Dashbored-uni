/**
 * A note that is longer than the label eats the label.
 */
import assert from "node:assert/strict";
import { courseCode, shortCourseName, MAX_SHORT_NAME } from "../src/lib/course-code";

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

console.log("Course codes");
console.log("");

/** Every course name on this account, read from the database. */
const REAL = [
  "NURP (432) Nursing Leadership",
  "NURM (410) Research Methods",
  "NURC (410) Critical Care Nursing",
  "Elective Course",
  "NURC (411) Critical Care Nursing",
  "NURP (431) Nursing Leadership",
];

check("THIS STUDENT'S SIX COURSES", () => {
  assert.deepEqual(
    REAL.map((n) => courseCode(n, null)),
    ["NURP 432", "NURM 410", "NURC 410", null, "NURC 411", "NURP 431"]
  );
});

check("NURC 410 AND NURC 411 DO NOT COLLAPSE INTO ONE LABEL", () => {
  /* The reason the number is kept at all: two of this account's courses share
     everything but the last digit. */
  assert.notEqual(courseCode(REAL[2], null), courseCode(REAL[4], null));
});

check("a stored code always wins over the name", () => {
  assert.equal(courseCode("NURC (410) Critical Care Nursing", "NUR-410"), "NUR-410");
  assert.equal(courseCode("Elective Course", "  ELEC 101  "), "ELEC 101");
});

check("an empty stored code falls through to the name", () => {
  for (const empty of [null, undefined, "", "   "]) {
    assert.equal(courseCode("NURC (410) Critical Care", empty), "NURC 410");
  }
});

check("the usual spellings all parse", () => {
  assert.equal(courseCode("NURC410 Critical Care", null), "NURC 410");
  assert.equal(courseCode("NURC 410 Critical Care", null), "NURC 410");
  assert.equal(courseCode("nurc (410) critical care", null), "NURC 410");
});

check("A NUMBER LATER IN THE TITLE IS NOT A CODE", () => {
  assert.equal(courseCode("Advanced Nursing 2 and 410 topics", null), null);
  assert.equal(courseCode("Elective Course", null), null);
});

check("EVERY SHORT NAME FITS THE NOTE COLUMN", () => {
  for (const name of [...REAL, "A Very Long Elective Course Title That Runs On", "x".repeat(60)]) {
    const short = shortCourseName(name, null);
    assert.ok(
      short.length <= MAX_SHORT_NAME + 1,
      `"${short}" is ${short.length} characters, over the ${MAX_SHORT_NAME} the column holds`
    );
    assert.ok(short.length > 0, `"${name}" produced nothing`);
  }
});

check("a title with no code is cut on a word, not mid-word", () => {
  const short = shortCourseName("Clinical Decision Making Seminar", null);
  assert.ok(short.endsWith("…"), "a cut name did not say it was cut");
  assert.ok(!/\w…$/.test(short) || short.startsWith("Clinical"), "cut in a strange place");
  assert.ok(short.startsWith("Clinical"), `got "${short}"`);
});

console.log("");
console.log(failures === 0 ? "Short enough to sit beside the thing that matters." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
