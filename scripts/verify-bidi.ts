/**
 * The one thing this must never do is lose a character.
 *
 * `bidiSegments` regroups a string so a Latin run can be isolated. It runs on
 * every piece of content the student owns — lecture titles, notes, the
 * explanations in a simulation — so a bug here does not misplace a full stop,
 * it silently eats part of a note. Every check below joins the segments back
 * together and compares them to the input, and the mutations at the end prove
 * the checks would notice if it stopped holding.
 */

import assert from "node:assert/strict";
import { bidiSegments, isMixed } from "../src/lib/bidi";

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

console.log("Mixed Arabic and English, kept whole");
console.log("");

/** Real strings: from the simulation, the course list and his lecture titles. */
const REAL = [
  "صح. Planning is deciding in advance what should be done, how, when, where and by whom.",
  "صح. Organizing = setting up the group, allocating resources, and assigning work with enough authority and responsibilities. ومنها تطلع line of authority و minimize friction.",
  "أنا مدير: قوتي من المنصب. وهي قائدة: قوتها من التأثير",
  "Directing: تواصل، تدريب، أوامر، وتحفيز — وهي شغل مستمر",
  "NURC (410) Critical Care Nursing",
  "تعيّنت head nurse لجناح الباطنية.",
  "لا، وهي نقطة يحبها الامتحان: الخطوات cycle مو list. بعد Controlling ترجع لـ Planning.",
  "2. Management Process & First-Line Nurse Manager's Roles",
  "الموارد خمسة: manpower · financial · time · material · physical facilities.",
  "",
  "محاضرة بدون إنجليزي أبداً",
];

check("NOTHING IS LOST: the segments rejoin into exactly the input", () => {
  for (const text of REAL) {
    assert.equal(bidiSegments(text).map((s) => s.text).join(""), text, `lost text in: ${text}`);
  }
});

check("nothing is lost on awkward input either", () => {
  const awkward = [
    "...",
    "A",
    "ا",
    "A ا A",
    "()[]{}",
    "ABC… — مرحبا — DEF.",
    "line one\nline two with English",
    "    ",
    "٣ من ٨",
    "😐 Morale 🙂",
    "Dr. Ahlam Z. with menti activity",
    "a".repeat(400) + "ع".repeat(400),
  ];
  for (const text of awkward) {
    assert.equal(bidiSegments(text).map((s) => s.text).join(""), text, `lost text in: ${text}`);
  }
});

check("A LATIN SENTENCE KEEPS ITS OWN FULL STOP", () => {
  const segments = bidiSegments(REAL[0]);
  const latin = segments.filter((s) => s.latin);
  assert.equal(latin.length, 1, "the English clause was split into pieces");
  assert.ok(
    latin[0].text.endsWith("whom."),
    `the full stop was left outside the run: ${JSON.stringify(latin[0].text)}`
  );
  assert.ok(latin[0].text.startsWith("Planning"), "the run did not start at the first word");
});

check("A RUN NEVER SWALLOWS ARABIC", () => {
  for (const text of REAL) {
    for (const segment of bidiSegments(text)) {
      if (segment.latin) {
        assert.ok(
          !/[؀-ۿ]/.test(segment.text),
          `an isolated run contains Arabic: ${JSON.stringify(segment.text)}`
        );
      }
    }
  }
});

check("a run never ends on the space before an Arabic word", () => {
  for (const text of REAL) {
    for (const segment of bidiSegments(text)) {
      if (segment.latin) {
        assert.ok(!/\s$/.test(segment.text), `trailing space in run: ${JSON.stringify(segment.text)}`);
      }
    }
  }
});

check("a line break ends a run", () => {
  const segments = bidiSegments("first English line\nsecond English line");
  assert.equal(segments.filter((s) => s.latin).length, 2, "two lines became one isolate");
});

check("ALL-ARABIC AND ALL-LATIN ARE LEFT ALONE BY isMixed", () => {
  assert.equal(isMixed("محاضرة بدون إنجليزي أبداً"), false);
  assert.equal(isMixed("Management Process"), false);
  assert.equal(isMixed("تعيّنت head nurse"), true);
  assert.equal(isMixed(""), false);
});

check("every segment carries text", () => {
  for (const text of REAL) {
    for (const segment of bidiSegments(text)) {
      if (text !== "") assert.notEqual(segment.text, "", "an empty segment was produced");
    }
  }
});

/* ── the mutations ──────────────────────────────────────────────────────────
   Each one breaks the function on purpose. A mutation that does not make a
   check above fail is a check that is testing nothing.
   ──────────────────────────────────────────────────────────────────────── */

type Segmenter = (text: string) => { text: string; latin: boolean }[];

function mutationBites(name: string, segment: Segmenter, probe: (s: Segmenter) => void) {
  try {
    probe(segment);
    failures += 1;
    console.log(`  MUTATION DID NOT BITE  ${name}`);
  } catch {
    console.log(`  bites  ${name}`);
  }
}

console.log("");
console.log("mutations");

const joinsBack = (s: Segmenter) => {
  for (const text of REAL) assert.equal(s(text).map((x) => x.text).join(""), text);
};

mutationBites("dropping the text between two runs", (text) => {
  /* The classic: emit the matches and forget the gaps. */
  return [...text.matchAll(/[A-Za-z][A-Za-z0-9 .,]*[A-Za-z0-9.]/g)].map((m) => ({
    text: m[0],
    latin: true,
  }));
}, joinsBack);

mutationBites("letting a run swallow the Arabic after it", (text) => {
  const out: { text: string; latin: boolean }[] = [];
  let at = 0;
  for (const m of text.matchAll(/[A-Za-z][^\n]*/g)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index), latin: false });
    out.push({ text: m[0], latin: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), latin: false });
  return out;
}, (s) => {
  for (const text of REAL) {
    for (const segment of s(text)) {
      if (segment.latin) assert.ok(!/[؀-ۿ]/.test(segment.text));
    }
  }
});

mutationBites("leaving the full stop outside the run", (text) => {
  const out: { text: string; latin: boolean }[] = [];
  let at = 0;
  for (const m of text.matchAll(/[A-Za-z][A-Za-z0-9 ,:;'()\-]*[A-Za-z0-9]|[A-Za-z]/g)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index), latin: false });
    out.push({ text: m[0], latin: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), latin: false });
  return out;
}, (s) => {
  const latin = s(REAL[0]).filter((x) => x.latin);
  assert.ok(latin[latin.length - 1].text.endsWith("whom."));
});

mutationBites("letting a run end on a trailing space", (text) => {
  const out: { text: string; latin: boolean }[] = [];
  let at = 0;
  for (const m of text.matchAll(/[A-Za-z][A-Za-z0-9 .,]*/g)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index), latin: false });
    out.push({ text: m[0], latin: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), latin: false });
  return out;
}, (s) => {
  for (const text of REAL) {
    for (const segment of s(text)) {
      if (segment.latin) assert.ok(!/\s$/.test(segment.text));
    }
  }
});

mutationBites("joining two lines into one isolate", (text) => {
  const out: { text: string; latin: boolean }[] = [];
  let at = 0;
  for (const m of text.matchAll(/[A-Za-z][A-Za-z0-9 .,\n]*[A-Za-z0-9.]/g)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index), latin: false });
    out.push({ text: m[0], latin: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), latin: false });
  return out;
}, (s) => {
  assert.equal(s("first English line\nsecond English line").filter((x) => x.latin).length, 2);
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("الجملة الإنجليزية تحتفظ بنقطتها.");
}
