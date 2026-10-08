/**
 * Arabic counts in five buckets. The app had been using one.
 */
import assert from "node:assert/strict";
import { pluralFormAr, pluralFormEn, pick } from "../src/lib/i18n/plural";

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

console.log("العدد والمعدود");
console.log("");

check("THE FIVE BUCKETS", () => {
  assert.equal(pluralFormAr(0), "zero");
  assert.equal(pluralFormAr(1), "one");
  assert.equal(pluralFormAr(2), "two", "two is the dual and must not fall in with 3-10");
  for (const n of [3, 4, 7, 10]) assert.equal(pluralFormAr(n), "few", `${n} should be few`);
  for (const n of [11, 12, 25, 99, 100]) assert.equal(pluralFormAr(n), "many", `${n} should be many`);
});

check("ELEVEN GOES BACK TO THE SINGULAR FORM, NOT ON TO THE PLURAL", () => {
  /* The bucket people get wrong: 10 is أيام and 11 is يومًا. A rule written as
     "n > 2 is plural" passes every test up to ten and is wrong forever after. */
  assert.equal(pluralFormAr(10), "few");
  assert.equal(pluralFormAr(11), "many");
});

check("the 3-10 bucket repeats in every hundred", () => {
  assert.equal(pluralFormAr(103), "few", "103 counts like 3");
  assert.equal(pluralFormAr(110), "few", "110 counts like 10");
  assert.equal(pluralFormAr(111), "many");
  assert.equal(pluralFormAr(200), "many");
});

check("a negative count is counted by its size", () => {
  assert.equal(pluralFormAr(-2), "two");
  assert.equal(pluralFormAr(-4), "few");
});

check("English has two buckets and zero reads as the plural", () => {
  assert.equal(pluralFormEn(0), "many");
  assert.equal(pluralFormEn(1), "one");
  assert.equal(pluralFormEn(2), "many");
  assert.equal(pluralFormEn(11), "many");
});

check("A MISSING FORM NEVER REACHES THE SCREEN", () => {
  assert.equal(pick({ many: "M", few: "F", one: "O" }, "two"), "M", "no fallback was taken");
  assert.equal(pick({ one: "O" }, "few"), "O");
  assert.equal(pick({}, "few"), "", "an empty bag must give an empty string, not undefined");
  for (const form of ["zero", "one", "two", "few", "many"] as const) {
    assert.equal(typeof pick({ few: "F" }, form), "string", `${form} returned a non-string`);
  }
});

console.log("");
console.log(failures === 0 ? "يوم، يومين، أيام، يومًا." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
