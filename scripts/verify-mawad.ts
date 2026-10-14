/**
 * The موادي header, and the bar under the countdown.
 *
 * Both of these are small enough to look obviously right and are not: the
 * Hijri year is a conversion nobody can check by eye, and the term bar is the
 * one thing on the screen that can quietly draw a lie at full width.
 */

import assert from "node:assert/strict";
import { hijriYear, termProgress } from "../src/lib/mawad";
import { pluralForm, pick } from "../src/lib/i18n/plural";
import { arabicCourseName } from "../src/lib/course-name-ar";
import { getDictionary } from "../src/lib/i18n/dictionaries";

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

console.log("ترويسة موادي");
console.log("");

/* His real term, as the row stands: 2026-09-05 → 2027-07-27. */
const START = new Date(2026, 8, 5);
const END = new Date(2027, 6, 27);

check("HIS TERM STARTS IN 1448", () => {
  assert.equal(hijriYear(START), "1448");
});

check("the year comes from the date, not from today", () => {
  /* The whole reason this is derived. A term starting a year later says so
     without anyone editing a constant. */
  assert.equal(hijriYear(new Date(2025, 8, 5)), "1447");
  assert.equal(hijriYear(new Date(2027, 8, 5)), "1449");
});

check("NO ERA IN THE DIGITS", () => {
  /* The header template writes "هـ" itself. Returning "1448 AH" would print
     the era twice, in two scripts. */
  const y = hijriYear(START);
  assert.ok(y && /^\d+$/.test(y), `expected digits only, got ${JSON.stringify(y)}`);
});

check("a broken date is null rather than a throw on the server", () => {
  assert.equal(hijriYear(new Date("nonsense")), null);
  assert.equal(hijriYear(undefined as unknown as Date), null);
});

check("THE BAR AT A KNOWN POINT OF HIS TERM", () => {
  /* 2026-10-14 is 39 days into a 325-day term. */
  const p = termProgress(START, END, new Date(2026, 9, 14));
  assert.ok(p !== null);
  assert.ok(Math.abs(p - 39 / 325) < 0.001, `expected ~0.12, got ${p}`);
});

check("BOTH ENDS ARE CLAMPED", () => {
  /* Before it starts is 0, not negative — a negative width renders as an
     empty track, which reads as "nothing done" instead of "not yet". */
  assert.equal(termProgress(START, END, new Date(2026, 0, 1)), 0);
  assert.equal(termProgress(START, END, new Date(2030, 0, 1)), 1);
});

check("A TERM WITH NO LENGTH DRAWS NOTHING", () => {
  /* Equal dates would divide by zero; reversed ones are a data error that a
     0%-wide bar would hide behind something that looks normal. */
  assert.equal(termProgress(START, START, new Date(2026, 9, 14)), null);
  assert.equal(termProgress(END, START, new Date(2026, 9, 14)), null);
});

check("a broken date draws nothing rather than NaN%", () => {
  assert.equal(termProgress(new Date("x"), END, new Date()), null);
  assert.equal(termProgress(START, new Date("x"), new Date()), null);
  assert.equal(termProgress(START, END, new Date("x")), null);
});

/* The cover pill: "{count} محاضرة جاهزة".
 *
 * TODAY IT IS ALWAYS "1", which is why this was never noticed — one course
 * has one lecture with a breakdown and the singular is correct for one. The
 * moment he drops the rest of his lectures, most covers land in the 3-10
 * bucket, where Arabic takes the broken plural and "7 محاضرة جاهزة" is wrong.
 */
const ready = (locale: "ar" | "en", count: number) =>
  pick(getDictionary(locale).academics.lecturesReady, pluralForm(locale, count)).replace(
    "{count}",
    String(count)
  );

check("THE READY PILL AGREES WITH ITS NUMBER IN ARABIC", () => {
  assert.equal(ready("ar", 1), "محاضرة جاهزة");
  assert.equal(ready("ar", 2), "محاضرتين جاهزتين");
  /* The bucket is the LAST TWO DIGITS, so 108 ends in 8 and takes the broken
     plural exactly as 8 does — مئة وثمان محاضرات. */
  for (const n of [3, 5, 7, 9, 10, 103, 108]) {
    assert.equal(ready("ar", n), `${n} محاضرات جاهزة`, `${n} ends in the 3-10 bucket`);
  }
  for (const n of [11, 14, 23, 99, 100, 111]) {
    assert.equal(ready("ar", n), `${n} محاضرة جاهزة`, `${n} ends in the 11+ bucket`);
  }
});

const courses = (locale: "ar" | "en", count: number) =>
  pick(getDictionary(locale).academics.courseCount, pluralForm(locale, count)).replace(
    "{count}",
    String(count)
  );

check("THE TERM LINE COUNTS COURSES IN ARABIC TOO", () => {
  /* "6 مواد" is right today and hid this. A term with one course is a real
     state: it is what every term looks like the moment the first course is
     added to it. */
  assert.equal(courses("ar", 0), "ما فيه مواد", "zero must not render as \"0 مادة\"");
  assert.equal(courses("ar", 1), "مادة وحدة");
  assert.equal(courses("ar", 2), "مادتين");
  assert.equal(courses("ar", 6), "6 مواد");
  assert.equal(courses("ar", 12), "12 مادة");
  /* English keeps the number at zero; only Arabic drops the noun. */
  assert.equal(courses("en", 0), "0 courses");
  assert.equal(courses("en", 1), "1 course");
  assert.equal(courses("en", 6), "6 courses");
});

check("no count ever renders a placeholder or an empty phrase", () => {
  for (const locale of ["ar", "en"] as const) {
    for (let n = 0; n <= 130; n++) {
      for (const [what, text] of [["pill", ready(locale, n)], ["term line", courses(locale, n)]] as const) {
        assert.ok(text.length > 0, `${locale} ${what} ${n} rendered nothing`);
        assert.ok(!text.includes("{count}"), `${locale} ${what} ${n} left the placeholder in`);
        assert.ok(!text.includes("undefined"), `${locale} ${what} ${n} rendered undefined`);
      }
    }
  }
});

check("English stays English, and says 1 rather than 1 lectures", () => {
  assert.equal(ready("en", 1), "1 lecture ready");
  assert.equal(ready("en", 7), "7 lectures ready");
});

/* The Arabic name on the cover.
 *
 * The largest type on the most-used screen in the app is a word that is
 * nowhere in the database: the only name a course has there is English. These
 * are the names the OWNER wrote on his board, and the point of the check is
 * that nothing else ever joins them.
 */
check("THE ARABIC NAMES ARE HIS, FOR THE CODES HE NAMED", () => {
  assert.equal(arabicCourseName({ name: "NURC (410) Critical Care Nursing" }), "العناية المركزة");
  assert.equal(arabicCourseName({ name: "NURC (411) Critical Care Nursing" }), "العناية المركزة");
  assert.equal(arabicCourseName({ name: "NURP (431) Nursing Leadership" }), "القيادة التمريضية");
  assert.equal(arabicCourseName({ name: "NURP (432) Nursing Leadership" }), "القيادة التمريضية");
});

check("A COURSE HE HAS NOT NAMED COMES BACK NULL, NOT TRANSLATED", () => {
  /* Project rule 9. "Research Methods" could be مناهج البحث, طرق البحث or
     مناهج البحث العلمي, and the registrar's Arabic transcript says exactly
     one of them. The cover shows the English and visibly misses the Arabic,
     which is the state somebody can fix. */
  assert.equal(arabicCourseName({ name: "NURM (410) Research Methods" }), null);
  assert.equal(arabicCourseName({ name: "Elective Course" }), null);
  assert.equal(arabicCourseName({ name: "NURS (420) Something New" }), null);
});

check("every spelling of a code he named lands on the same word", () => {
  /* The three the importer has actually written into this account at
     different times. A hyphenated "NURC-410" is NOT here on purpose:
     course-code.ts does not read that spelling, so it would be a test of
     that parser rather than of this map, and widening a parser the worlds
     and the short names also depend on is not this change's business. */
  for (const spelling of ["NURC (410) x", "NURC 410 x", "nurc410 x"]) {
    assert.equal(arabicCourseName({ name: spelling }), "العناية المركزة", spelling);
  }
});

/* ── mutations ──────────────────────────────────────────────────────────── */

function mutationBites(name: string, probe: () => void) {
  try {
    probe();
    failures += 1;
    console.log(`  MUTATION DID NOT BITE  ${name}`);
  } catch {
    console.log(`  bites  ${name}`);
  }
}

console.log("");
console.log("mutations");

mutationBites("taking the whole formatted Hijri string", () => {
  const whole = (d: Date) =>
    new Intl.DateTimeFormat("en-US-u-ca-islamic-nu-latn", { year: "numeric" }).format(d);
  assert.ok(/^\d+$/.test(whole(START)), "era came along for the ride");
});

mutationBites("hard-coding the current Hijri year", () => {
  const fixed = () => "1448";
  assert.equal(fixed(), hijriYear(new Date(2027, 8, 5)));
});

mutationBites("leaving the bar unclamped at the low end", () => {
  const raw = (s: Date, e: Date, n: Date) => (n.getTime() - s.getTime()) / (e.getTime() - s.getTime());
  assert.equal(raw(START, END, new Date(2026, 0, 1)), 0);
});

mutationBites("falling back to the English name instead of saying there is none", () => {
  const fallback = (subject: { name: string }) =>
    arabicCourseName(subject) ?? subject.name;
  assert.equal(fallback({ name: "NURM (410) Research Methods" }), null);
});

mutationBites("one Arabic plural for every count, as the pill had", () => {
  const single = (n: number) => `${n} محاضرة جاهزة`;
  assert.equal(single(7), ready("ar", 7));
});

mutationBites("drawing 0% for a term whose dates have no length", () => {
  const zeroed = (s: Date, e: Date) => (e.getTime() <= s.getTime() ? 0 : 0.5);
  assert.equal(zeroed(START, START), null);
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("الترويسة تقول اللي في البيانات، وإلا ما تقول شي.");
}
