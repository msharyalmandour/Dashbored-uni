/**
 * The tutor does not write the sheet.
 *
 * This is the one guard in the project that is about a rule rather than a
 * number, and it is here because the rule is enforceable in exactly one way
 * that is worth anything: by what leaves the machine. A prompt that says
 * "don't write the answer" is a request. A payload that does not contain the
 * student's draft is a fact.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildTutorRequest, TUTOR_RULE } from "../src/lib/sheet-tutor";

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

console.log("المعلّم ما يكتب الجواب");
console.log("");

const SOURCES = [
  { title: "Management Process", sections: ["Planning", "Organizing", "Staffing"] },
  { title: "Quality Improvement", sections: ["Root cause analysis"] },
];

const REQ = buildTutorRequest({
  prompt: "Describe a problem you observed on the unit and analyse its root cause.",
  criteria: "Evidence cited, root cause identified, action plan feasible.",
  sources: SOURCES,
});

check("THE PROHIBITION IS IN THE PROMPT THAT IS SENT", () => {
  assert.ok(REQ.system.includes(TUTOR_RULE));
  for (const word of ["Never write", "rewrite", "template", "starting sentence"]) {
    assert.ok(REQ.system.includes(word), `the rule lost "${word}"`);
  }
});

check("THE STUDENT'S DRAFT IS NOWHERE IN THE PAYLOAD", () => {
  /* The real guarantee. A model cannot improve what it was not shown. */
  const draft = "ZZZ_THE_STUDENTS_OWN_WORDS_ZZZ";
  const req = buildTutorRequest({
    prompt: "Describe a problem you observed on the unit.",
    criteria: null,
    sources: SOURCES,
    // @ts-expect-error — `draft?: never` exists so this cannot be done by accident.
    draft,
  });
  assert.ok(!JSON.stringify(req).includes(draft), "the draft reached the payload");
});

check("the builder's own type refuses a draft field", () => {
  /* Guard the guard: if `draft?: never` is ever relaxed to `draft?: string`,
     the @ts-expect-error above stops erroring and tsc fails the build. This
     check states the intent in words so the reason survives the refactor. */
  const src = readFileSync("src/lib/sheet-tutor.ts", "utf8");
  assert.ok(src.includes("draft?: never"), "the draft field stopped being impossible");
});

check("the examples come from HIS course, not from the model's memory", () => {
  assert.deepEqual(REQ.sources, SOURCES);
  assert.ok(REQ.sources.length > 0);
});

check("a sheet with no marking scheme does not get an invented one", () => {
  const req = buildTutorRequest({ prompt: "Q", criteria: null, sources: [] });
  assert.ok(req.system.includes("do not invent"));
  assert.ok(!req.system.includes("marked on:"));
});

check("the criteria are passed through as the sheet worded them", () => {
  assert.ok(REQ.system.includes("Evidence cited, root cause identified"));
});

check("NO SCREEN WRITES THE TUTOR'S TEXT INTO THE ANSWER FIELD", () => {
  /* The second half of the promise, and a property of the UI rather than the
     payload. The sheet component may read the answer state and may set it
     from the student's typing; what it must never contain is a path from a
     tutor reply to setAnswer. Scanned rather than reasoned about, because
     "surely nobody would" is how it gets added. */
  let src = "";
  try {
    src = readFileSync("src/components/sheets/sheet-paper.tsx", "utf8");
  } catch {
    /* The component is not written yet; the scan below runs once it is, and
       this check fails loudly rather than passing on an empty string. */
    assert.fail("src/components/sheets/sheet-paper.tsx is missing");
  }
  const forbidden = [/setAnswer\([^)]*tutor/i, /tutor[A-Za-z]*\s*\)\s*;?\s*\/\/\s*into/i];
  for (const re of forbidden) {
    assert.ok(!re.test(src), `the sheet writes a tutor reply into an answer: ${re}`);
  }
  /* And there is no control offering to do it. */
  for (const phrase of ["اكتب لي الجواب", "اكتبه لي", "Write it for me", "Use this answer"]) {
    assert.ok(!src.includes(phrase), `a "${phrase}" control exists`);
  }
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("يشرح ويسأل. ما يكتب.");
}
