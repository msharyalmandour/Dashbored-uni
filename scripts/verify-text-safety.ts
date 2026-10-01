/**
 * What can be stored, against the two documents that could not be.
 *
 * On 2026-09-30 two of this student's documents sat at FAILED with a database
 * error where a lecture should have been:
 *
 *     PostgresError code 22021
 *     invalid byte sequence for encoding "UTF8": 0x00
 *
 * Extraction had succeeded. The PDF's text layer contained a NUL byte, which
 * a PDF may hold, a JavaScript string may hold, and a Postgres `text` column
 * cannot. The transaction died on the way in and the student was told his
 * file failed.
 *
 * The second half of this file is the half that matters. `Document.metadata`
 * is jsonb, the per-page text of a PDF is written to `metadata.pages[n].text`,
 * and jsonb rejects a NUL too — with a different code, measured against the
 * live database:
 *
 *     22P05  unsupported Unicode escape sequence
 *     DETAIL: \u0000 cannot be converted to text.
 *
 * So a fix confined to `extractedText` would have moved the same two failures
 * from 22021 to 22P05 and looked, from the row, like no fix at all.
 *
 * Run: npx tsx scripts/verify-text-safety.ts
 */

import { readFileSync } from "node:fs";
import { makeStorable, makeStorableJson } from "../src/lib/processors/text-safety";

let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
    failed++;
  }
}

console.log("Storable text\n");

const NUL = "\u0000";

/* ── The failure itself ───────────────────────────────────────────────────── */

{
  // A slide's text as the extractor handed it over: a NUL in the middle of a
  // heading, which is what a broken font map in a PDF produces.
  const extracted = `GAS EXCHANGE${NUL}\nAlveolar ventilation${NUL}${NUL} 4.2 L/min`;

  ok("the input is the shape that failed", extracted.includes(NUL));

  const r = makeStorable(extracted);
  ok("no NUL survives", r.text !== null && !r.text.includes(NUL), JSON.stringify(r.text));
  ok("all three are counted", r.removed === 3, `removed=${r.removed}`);
  ok("nothing else is touched",
    r.text === "GAS EXCHANGE\nAlveolar ventilation 4.2 L/min", JSON.stringify(r.text));
}

{
  // The newline and the tab are the shape of a slide. Scrubbing control
  // characters generally would be the easy over-reach and would damage every
  // document to guard against two.
  const r = makeStorable("Stage 1\tRest\nStage 2\tExertion\r\n");
  ok("tabs, newlines and returns are left alone",
    r.text === "Stage 1\tRest\nStage 2\tExertion\r\n" && r.removed === 0, JSON.stringify(r.text));

  // Arabic, and a code point outside the BMP, both round-trip. This student's
  // documents are half Arabic.
  const ar = "المحاضرة الثانية — تبادل الغازات 🫁";
  ok("Arabic and astral characters round-trip", makeStorable(ar).text === ar);
}

{
  // Null in, null out. An unread document and a document read as an empty
  // string are different facts and the row records which.
  ok("null stays null", makeStorable(null).text === null);
  ok("undefined becomes null", makeStorable(undefined).text === null);
  ok("an empty string stays a string", makeStorable("").text === "");

  // A document that is nothing BUT NULs reads as empty, not as unread —
  // read-quality then calls it a bad read, which is the true verdict.
  const allNul = makeStorable(NUL + NUL);
  ok("a text layer of pure NULs becomes empty, not null",
    allNul.text === "" && allNul.removed === 2, JSON.stringify(allNul));
}

/* ── The jsonb column, which is the same bug one field over ───────────────── */

{
  // Exactly what the pipeline writes for a PDF: per-page text inside
  // metadata. This is the case a fix confined to extractedText would miss.
  const metadata = {
    processor: "pdf-text",
    pages: [
      { pageNumber: 1, text: `Title${NUL}` },
      { pageNumber: 2, text: "Clean page" },
    ],
    wordCount: 12,
  };

  const clean = makeStorableJson(metadata);
  const asJson = JSON.stringify(clean);
  ok("no NUL anywhere in the metadata", !asJson.includes(NUL) && !asJson.includes("\\u0000"), asJson);
  ok("the page text is otherwise intact", clean.pages[0].text === "Title", clean.pages[0].text);
  ok("the clean page is untouched", clean.pages[1].text === "Clean page");
  ok("numbers and structure survive",
    clean.wordCount === 12 && clean.pages.length === 2 && clean.pages[1].pageNumber === 2, asJson);
}

{
  // Keys as well as values: processor metadata keys come from file formats.
  const cleaned = makeStorableJson({ [`sheet${NUL}1`]: "rows" }) as Record<string, string>;
  ok("a NUL in a key is removed too",
    Object.keys(cleaned)[0] === "sheet1" && cleaned.sheet1 === "rows", JSON.stringify(cleaned));
}

{
  // Nesting, and the values jsonb carries that are not strings.
  const deep = makeStorableJson({
    a: [{ b: { c: [`x${NUL}`, 1, true, null] } }],
  }) as { a: [{ b: { c: [string, number, boolean, null] } }] };
  const c = deep.a[0].b.c;
  ok("arbitrary nesting is walked", c[0] === "x", JSON.stringify(deep));
  ok("non-strings are passed through unchanged",
    c[1] === 1 && c[2] === true && c[3] === null, JSON.stringify(c));

  // A Date is not a plain object and must not be rebuilt entry by entry —
  // that would turn it into `{}` and silently lose the timestamp.
  const when = new Date("2026-09-30T06:17:00Z");
  const held = makeStorableJson({ recordedAt: when }) as { recordedAt: Date };
  ok("a Date is passed through, not flattened to an object",
    held.recordedAt instanceof Date && held.recordedAt.getTime() === when.getTime(),
    JSON.stringify(held));
}

{
  // The distinguishing case for the common path: a clean object must come
  // back equal, so the walk cannot be "return {}" and still pass.
  const original = { processor: "text", format: "md", pages: null, wordCount: 0 };
  ok("a clean object comes back equal",
    JSON.stringify(makeStorableJson(original)) === JSON.stringify(original),
    JSON.stringify(makeStorableJson(original)));
}

/* ── That the pipeline actually uses it ───────────────────────────────────── */

{
  // A sanitizer nothing calls is the same as no sanitizer, and this one sits
  // one call away from the write that failed. So the write path is read.
  const src = readFileSync(new URL("../src/lib/processors/index.ts", import.meta.url), "utf8");

  ok("the text column is written from the cleaned string",
    /extractedText:\s*storable\.text/.test(src) && !/extractedText:\s*result\.extractedText/.test(src));
  ok("the jsonb column is written through the walker",
    /metadata:\s*makeStorableJson\(/.test(src));
  ok("the read is assessed on what gets stored, not on what was extracted",
    /text:\s*storable\.text/.test(src));
}

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
