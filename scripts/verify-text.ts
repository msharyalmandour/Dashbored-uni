/**
 * The decoder, and the ordering bug that is easy to reintroduce.
 *
 * This runs on every title the agent writes out of a student's document. The
 * failure it exists to stop is visible rather than subtle — a heading reading
 * "Management Process &amp; First-Line…" on the student's own screen — but the
 * interesting check is the last one: decoding the ampersand FIRST invents
 * markup the document never contained.
 */

import assert from "node:assert/strict";
import { decodeEntities, cleanTitle } from "../src/lib/text";

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

console.log("Text out of a document");
console.log("");

check("THE TITLE THAT CAUSED THIS IS FIXED", () => {
  assert.equal(
    cleanTitle("2. Management Process &amp; First-Line Nurse Manager's Roles"),
    "2. Management Process & First-Line Nurse Manager's Roles"
  );
});

check("THE AMPERSAND IS DECODED LAST, SO NO TAG IS INVENTED", () => {
  /* A document containing the literal text "&lt;" encodes it "&amp;lt;".
     Decoding & first gives "&lt;" and then "<" — a tag the document never
     had. Decoding & last leaves the literal text the author wrote. */
  assert.equal(decodeEntities("&amp;lt;b&amp;gt;"), "&lt;b&gt;");
});

check("the common entities all decode", () => {
  assert.equal(decodeEntities("a &lt; b &gt; c"), "a < b > c");
  assert.equal(decodeEntities("&quot;quoted&quot;"), '"quoted"');
  assert.equal(decodeEntities("Manager&#39;s"), "Manager's");
  assert.equal(decodeEntities("Manager&apos;s"), "Manager's");
  assert.equal(decodeEntities("a&nbsp;b"), "a b");
});

check("numeric and hex entities decode, Arabic included", () => {
  assert.equal(decodeEntities("&#1575;&#1604;&#1578;&#1582;&#1591;&#1610;&#1591;"), "التخطيط");
  assert.equal(decodeEntities("&#x645;"), "م");
  assert.equal(decodeEntities("&#128161;"), "💡");
});

check("CASE DOES NOT MATTER, BECAUSE DOCUMENTS ARE INCONSISTENT", () => {
  assert.equal(decodeEntities("A &AMP; B"), "A & B");
  assert.equal(decodeEntities("x &LT; y"), "x < y");
});

check("AN UNRENDERABLE ENTITY IS DROPPED, NOT THROWN", () => {
  /* A lone surrogate and an out-of-range code point both make
     String.fromCodePoint throw. One bad entity must not lose the title. */
  assert.equal(decodeEntities("a&#55296;b"), "ab");
  assert.equal(decodeEntities("a&#1114112;b"), "ab");
  assert.equal(decodeEntities("a&#0;b"), "ab");
});

check("text with no entities is returned unchanged", () => {
  for (const text of [
    "NURC (410) Critical Care Nursing",
    "تعيّنت head nurse لجناح الباطنية",
    "",
    "100% & rising",
  ]) {
    assert.equal(decodeEntities(text), text);
  }
});

check("A TITLE NEVER KEEPS A LINE BREAK INSIDE IT", () => {
  /* A heading pulled from a two-line text box; a newline in it breaks every
     layout that truncates. */
  assert.equal(cleanTitle("  Management\n  Process  "), "Management Process");
  assert.equal(cleanTitle("a\t\tb"), "a b");
});

/* ── mutations ──────────────────────────────────────────────────────────── */

type Decoder = (text: string) => string;

function mutationBites(name: string, decode: Decoder, probe: (d: Decoder) => void) {
  try {
    probe(decode);
    failures += 1;
    console.log(`  MUTATION DID NOT BITE  ${name}`);
  } catch {
    console.log(`  bites  ${name}`);
  }
}

console.log("");
console.log("mutations");

mutationBites(
  "decoding the ampersand FIRST",
  (text) =>
    text
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">"),
  (d) => assert.equal(d("&amp;lt;b&amp;gt;"), "&lt;b&gt;")
);

mutationBites(
  "forgetting the ampersand entirely",
  (text) => text.replace(/&lt;/gi, "<").replace(/&gt;/gi, ">"),
  (d) => assert.equal(d("Management Process &amp; Roles"), "Management Process & Roles")
);

mutationBites(
  "being case sensitive",
  (text) => text.replace(/&amp;/g, "&"),
  (d) => assert.equal(d("A &AMP; B"), "A & B")
);

mutationBites(
  "letting a bad code point throw",
  (text) => text.replace(/&#(\d+);/g, (_, c: string) => String.fromCodePoint(Number(c))),
  (d) => assert.equal(d("a&#55296;b"), "ab")
);

mutationBites(
  "leaving a newline inside a title",
  (text) => text.trim(),
  (d) => assert.equal(d("  Management\n  Process  "), "Management Process")
);

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("العنوان يطلع زي ما هو مكتوب في الملف.");
}
