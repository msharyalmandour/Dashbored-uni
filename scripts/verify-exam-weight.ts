/**
 * Reading "40%" out of a title the importer wrote.
 *
 * This decides what a chip says on the one deadline the student is looking at,
 * so the way it must fail is silently-absent, never confidently-wrong: a
 * wrong weight changes what he studies tonight.
 */

import assert from "node:assert/strict";
import { weightFromTitle } from "../src/lib/exam-weight";

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

console.log("نسبة الاختبار من عنوانه");
console.log("");

check("HIS REAL DEADLINES", () => {
  /* Straight out of the account, spelled as the importer stored them. */
  assert.equal(
    weightFromTitle("Final OSPE — Clinical Leadership and Management (40%)"),
    40
  );
  assert.equal(weightFromTitle("Problem-Solving Project submission (group, 10%)"), 10);
  assert.equal(weightFromTitle("30-day staffing Rota + staff motivation plan"), null);
  assert.equal(weightFromTitle("Pre-reading assignment — Simulation 1"), null);
});

check("A BARE NUMBER IS NEVER A WEIGHT", () => {
  /* Both of these are real titles in this account. Without requiring the %
     sign, the first reads as 2026% and the second as 1%. */
  assert.equal(weightFromTitle("NURC 410 revision (2026)"), null);
  assert.equal(weightFromTitle("Quiz 1"), null);
  assert.equal(weightFromTitle("Lecture 2 — Management Process"), null);
  assert.equal(weightFromTitle("OSPE/OSCE examination period – NURC 410"), null);
});

check("the usual spellings all read", () => {
  assert.equal(weightFromTitle("Midterm (20%)"), 20);
  assert.equal(weightFromTitle("Midterm 20 %"), 20);
  assert.equal(weightFromTitle("Midterm - 20%"), 20);
  assert.equal(weightFromTitle("اختبار نصفي (20%)"), 20);
  assert.equal(weightFromTitle("12.5%"), 12.5);
  assert.equal(weightFromTitle("12,5%"), 12.5);
});

check("THE FIRST PERCENTAGE WINS, NOT THE BIGGEST", () => {
  /* "worth 40% (was 30%)" means 40. Taking the largest would be right here
     and wrong the moment the order reverses, which is the same bug. */
  assert.equal(weightFromTitle("Final worth 40% (was 30%)"), 40);
  assert.equal(weightFromTitle("Final worth 30% (up from 40%)"), 30);
});

check("0% AND OVER 100% ARE REFUSED, NOT SHOWN", () => {
  /* "0% من الدرجة" on an exam tells a student it does not matter. */
  assert.equal(weightFromTitle("Attendance (0%)"), null);
  assert.equal(weightFromTitle("Mark out of 150%"), null);
  assert.equal(weightFromTitle("Scored 120%"), null);
  assert.equal(weightFromTitle("100%"), 100);
});

check("nothing, empty and junk all come back null rather than throwing", () => {
  for (const title of [null, undefined, "", "   ", "%", "%%", "abc%", "-5%"]) {
    assert.equal(weightFromTitle(title), null, `title ${JSON.stringify(title)}`);
  }
});

check("a trailing zero does not make the chip wider for nothing", () => {
  assert.equal(weightFromTitle("Quiz (12.50%)"), 12.5);
  assert.equal(weightFromTitle("Quiz (40.0%)"), 40);
});

/* ── mutations ──────────────────────────────────────────────────────────── */

function mutationBites(name: string, read: (t: string) => number | null, probe: (r: (t: string) => number | null) => void) {
  try {
    probe(read);
    failures += 1;
    console.log(`  MUTATION DID NOT BITE  ${name}`);
  } catch {
    console.log(`  bites  ${name}`);
  }
}

console.log("");
console.log("mutations");

mutationBites(
  "not requiring the % sign",
  (t) => { const m = /(\d{1,3})/.exec(t); return m ? Number(m[1]) : null; },
  (r) => assert.equal(r("NURC 410 revision (2026)"), null)
);

mutationBites(
  "taking the biggest percentage instead of the first",
  (t) => {
    const all = [...t.matchAll(/(\d+)\s*%/g)].map((m) => Number(m[1]));
    return all.length ? Math.max(...all) : null;
  },
  (r) => assert.equal(r("Final worth 30% (up from 40%)"), 30)
);

mutationBites(
  "letting 0% through",
  (t) => { const m = /(\d+)\s*%/.exec(t); return m ? Number(m[1]) : null; },
  (r) => assert.equal(r("Attendance (0%)"), null)
);

mutationBites(
  "letting a mark out of 150 through",
  (t) => { const m = /(\d+)\s*%/.exec(t); return m ? Number(m[1]) : null; },
  (r) => assert.equal(r("Mark out of 150%"), null)
);

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("النسبة تطلع من العنوان، وإلا ما تطلع أصلاً.");
}
