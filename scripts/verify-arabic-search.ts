/**
 * Arabic found the way Arabic gets typed.
 *
 * `normalizeArabicText` settles which alphabet a word is in. This settles
 * something else: two spellings of one word. Arabic carries distinctions that
 * readers treat as optional and typists apply inconsistently, and `contains`
 * compares codepoints, so none of these match:
 *
 *     الحموضة / الحموضه      ta marbuta typed as a plain ha
 *     أهداف / اهداف          hamza on the alef, or not
 *     يُعطى / يعطي            alef maqsura typed as ya
 *     مُسْتَوى / مستوى         with the vowel marks, or without
 *
 * Measured before this existed: seven out of seven ordinary respellings found
 * nothing, in material that plainly contains the word. Nobody reads that as "I
 * typed a different character"; they read it as the app losing their lecture.
 *
 * Half of these checks are about what must NOT match. A fold that reaches
 * further starts joining words that are genuinely different, and the two
 * failures are not equal: a search that finds nothing is one you retype, and a
 * search that returns the wrong lecture is one you believe.
 *
 * Run: npx tsx scripts/verify-arabic-search.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { arabicAwareIncludes, foldArabicForSearch, hasArabic } from "../src/lib/pdf-text";
import { pickMatching, RESULT_LIMIT, rowsToRead, SCAN_LIMIT } from "../src/lib/search-fold";

let failures = 0;
function check(label: string, run: () => void) {
  try {
    run();
    console.log(`  ok  ${label}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL  ${label}\n        ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log("Arabic search\n");

/* ── The spellings a student actually types ───────────────────────────────── */

const SHOULD_MATCH: [string, string, string][] = [
  ["درجة الحموضة الطبيعية", "الحموضه", "ة typed as ه"],
  ["أهداف التعلم للطالب", "اهداف", "hamza dropped"],
  ["إسهال حاد", "اسهال", "hamza below dropped"],
  ["آلام البطن", "الام", "madda dropped"],
  ["مُسْتَوى الأكسجين", "مستوى", "diacritics dropped"],
  ["يُعطى المريض", "يعطي", "alef maqsura typed as ya"],
  ["الرئة اليمنى", "الريه", "hamza on ya, and ة for ه"],
  ["تركيز البيكربونات", "بيكربونات", "a word from the middle"],
];

for (const [haystack, needle, why] of SHOULD_MATCH) {
  check(`finds ${needle} — ${why}`, () => {
    assert.ok(arabicAwareIncludes(haystack, needle), `"${needle}" not found in "${haystack}"`);
  });
}

check("tatweel does not hide a word", () => {
  /* ـــ (U+0640) stretches a letter's join and carries no sound. It appears in
     headings set by hand and in text pasted out of a PDF whose typesetter
     justified a line with it. A student types the word without it. */
  assert.ok(arabicAwareIncludes("الحمـــوضة الطبيعية", "الحموضة"), "stretched in the material");
  assert.ok(arabicAwareIncludes("الحموضة الطبيعية", "الحمـوضة"), "stretched in the query");
});

check("decomposed diacritics are stripped as surely as composed ones", () => {
  /* The same word can arrive with its marks as separate codepoints or already
     combined, depending on the keyboard and the source. Folding has to reach
     both, or the fix works for text typed one way and not the other. */
  const decomposed = "\u0645\u064F\u0633\u0652\u062A\u064E\u0648\u0649"; // مُسْتَوى, marks separate
  assert.equal(foldArabicForSearch(decomposed), foldArabicForSearch("مستوي"));
  assert.ok(arabicAwareIncludes(`${decomposed} الأكسجين`, "مستوى"));
});

check("a hamza written as its own codepoint folds like one that is built in", () => {
  /* أ has two spellings in Unicode: one codepoint (U+0623), or ا followed by a
     combining hamza above (U+0627 U+0654). Which one arrives depends on the
     keyboard and on what produced the text. Both have to reach the same letter,
     and this asserts the half that is easy to lose: the combining marks are in
     ARABIC_MARKS, so stripping them lands exactly where the fold table sends
     the composed form. This is the check that makes the absent
     `.normalize("NFC")` in foldArabicForSearch safe — take U+0654 out of
     ARABIC_MARKS and this fails, which is the whole reason the call could go. */
  const PAIRS: [string, string, string][] = [
    ["\u0623", "\u0627\u0654", "أ"],
    ["\u0625", "\u0627\u0655", "إ"],
    ["\u0622", "\u0627\u0653", "آ"],
    ["\u0624", "\u0648\u0654", "ؤ"],
    ["\u0626", "\u064A\u0654", "ئ"],
  ];
  for (const [composed, decomposed, name] of PAIRS) {
    assert.equal(
      foldArabicForSearch(decomposed),
      foldArabicForSearch(composed),
      `${name} folds differently depending on how it was typed`
    );
  }
  assert.ok(arabicAwareIncludes("\u0627\u0654\u0647\u062F\u0627\u0641 \u0627\u0644\u062A\u0639\u0644\u0645", "اهداف"));
});

check("it works in the other direction too", () => {
  // The student's material may be the loosely-spelled side.
  assert.ok(arabicAwareIncludes("درجة الحموضه", "الحموضة"));
  assert.ok(arabicAwareIncludes("اهداف التعلم", "أهداف"));
});

check("presentation forms from a PDF viewer still match typed letters", () => {
  /* A student can paste straight out of a PDF. The fold runs
     normalizeArabicText first, so both sides reach the same alphabet before
     anything else is compared. */
  const asPdfGaveIt = "\uFEB1\uFEDF\uFE8E\uFEE1"; // سلام, as a PDF reports it
  assert.ok(arabicAwareIncludes(asPdfGaveIt, "سلام"), "stored as forms, typed as letters");
  assert.ok(arabicAwareIncludes("قال سلام عليكم", asPdfGaveIt), "stored as letters, pasted as forms");
});

/* ── What must not match ──────────────────────────────────────────────────── */

const MUST_NOT_MATCH: [string, string, string][] = [
  ["الرئة", "الكلية", "two different organs"],
  ["أهداف", "اهتمام", "different words, shared letters"],
  ["الدم", "الدماغ", "one is not a respelling of the other"],
  ["كتاب", "كتب", "a shorter word is a different word"],
];

for (const [haystack, needle, why] of MUST_NOT_MATCH) {
  check(`does not confuse ${needle} with ${haystack} — ${why}`, () => {
    assert.ok(!arabicAwareIncludes(haystack, needle), `"${needle}" wrongly matched "${haystack}"`);
  });
}

check("a bare hamza is not folded away", () => {
  /* It was, briefly, to make an invented test case pass. The rule DELETES a
     letter, and a fold that deletes letters joins words that merely became the
     same once something was removed from both. */
  assert.ok(foldArabicForSearch("ء").includes("ء"), "the bare hamza was deleted");
});

/* ── The switch that decides whether any of this costs anything ───────────── */

check("a Latin query is not treated as Arabic", () => {
  // A Latin search must issue exactly the queries it always did; folding it
  // would read rows for no possible gain.
  assert.equal(hasArabic("Gas Exchange"), false);
  assert.equal(hasArabic("PaCO2 35-45 mmHg"), false);
  assert.equal(hasArabic(""), false);
});

check("Arabic is recognised wherever it appears", () => {
  assert.equal(hasArabic("الحموضة"), true);
  assert.equal(hasArabic("Gas Exchange — تبادل الغازات"), true, "a mixed query is still Arabic");
  assert.equal(hasArabic("ﺱﻟ"), true, "presentation forms count");
});

/* ── Latin is untouched ───────────────────────────────────────────────────── */

check("Latin text is compared case-insensitively and not otherwise altered", () => {
  assert.ok(arabicAwareIncludes("Gas Exchange and Respiratory Function", "gas exchange"));
  assert.ok(!arabicAwareIncludes("Gas Exchange", "Cardiac"));
  // The fold must not touch science notation, for the same reason
  // normalizeArabicText does not: PaCO₂ is on every page of this lecture.
  assert.equal(foldArabicForSearch("PaCO₂ m³"), "PaCO₂ m³");
});

check("an empty query matches everything rather than nothing", () => {
  // The caller guards on length; this is about not inverting the meaning.
  assert.ok(arabicAwareIncludes("anything", ""));
  assert.ok(!arabicAwareIncludes("", "something"));
});

check("folding twice is the same as folding once", () => {
  const once = foldArabicForSearch("مُسْتَوى الأكسجين");
  assert.equal(foldArabicForSearch(once), once);
});

/* ── What the search action does with the rows ────────────────────────────
 *
 * The checks above are about one string against another. These are about the
 * step that turns a table's rows into results, because that is where an
 * Arabic search can fail in the loud direction: the query reads up to
 * SCAN_LIMIT rows of the student's own material, and if the filter is skipped
 * then every lecture they own comes back as a match for any Arabic word.
 */

check("a Latin query's rows are handed back exactly as SQL narrowed them", () => {
  // Already filtered and already limited by the database. Touching them here
  // would either re-do work or, worse, disagree with what the query asked for.
  const rows = [{ t: "Gas Exchange" }, { t: "Cardiac Cycle" }];
  assert.deepEqual(pickMatching(rows, false, "gas", (r) => r.t), rows);
});

check("an Arabic query keeps only the rows that actually match", () => {
  const rows = [
    { t: "درجة الحموضة" },
    { t: "تشريح الرئة" },
    { t: "الحموضه والقلوية" },
  ];
  const kept = pickMatching(rows, true, "الحموضة", (r) => r.t).map((r) => r.t);
  assert.deepEqual(kept, ["درجة الحموضة", "الحموضه والقلوية"]);
});

check("an Arabic query cannot return the student's whole library", () => {
  /* The failure this guards is not "no results" — it is a one-word search
     answering with 500 rows, every one of them unrelated, because the rows
     came back unnarrowed and nothing filtered them. */
  const library = Array.from({ length: SCAN_LIMIT }, (_, i) => ({ t: `تشريح الجزء ${i}` }));
  assert.equal(pickMatching(library, true, "الحموضة", (r) => r.t).length, 0);
  const withMatches = [...library.map((r) => ({ t: r.t })), ...Array.from({ length: 9 }, () => ({ t: "درجة الحموضة" }))];
  assert.equal(pickMatching(withMatches, true, "الحموضه", (r) => r.t).length, RESULT_LIMIT);
});

check("folding reads more rows than it returns, and only when folding", () => {
  assert.equal(rowsToRead(false), RESULT_LIMIT, "a Latin query read more than it needed");
  assert.equal(rowsToRead(true), SCAN_LIMIT);
  assert.ok(SCAN_LIMIT > RESULT_LIMIT, "there would be nothing to fold through");
});

/* ── The queries the action issues ─────────────────────────────────────────
 *
 * Asserted against the source, which is unusual and is the point: the Arabic
 * branch removes the `contains` from the `where`, and the one thing that must
 * survive that removal is the clause naming whose rows these are. A `where`
 * that loses it still compiles, still returns rows, still looks right in the
 * panel — and is another student's material. Nothing else in this file would
 * notice.
 */

check("every folded query is still scoped to the student who asked", () => {
  const src = readFileSync(new URL("../src/app/actions/search.ts", import.meta.url), "utf8");
  const branches = [...src.matchAll(/where: folded \? (.+?) : (.+?),\n/g)];
  assert.ok(branches.length >= 8, `found ${branches.length} folded where-clauses, expected every table`);
  for (const [, foldedBranch, latinBranch] of branches) {
    assert.match(foldedBranch, /userId/, `a folded query reads rows with no owner: ${foldedBranch}`);
    assert.match(latinBranch, /userId/, `a Latin query reads rows with no owner: ${latinBranch}`);
  }
});

check("no table's rows escape the filter", () => {
  /* One findMany, one pickMatching. A table read for folding and then mapped
     straight into results is the 500-row answer described above. */
  const src = readFileSync(new URL("../src/app/actions/search.ts", import.meta.url), "utf8");
  const reads = (src.match(/\.findMany\(/g) ?? []).length;
  const filters = (src.match(/pickMatching\(/g) ?? []).length;
  assert.equal(filters, reads, `${reads} tables read, ${filters} filtered`);
  const takes = (src.match(/take: rowsToRead\(folded\)/g) ?? []).length;
  assert.equal(takes, reads, `${reads} tables read, ${takes} bounded`);
});

console.log("");
console.log(failures === 0 ? "Arabic is found the way it is typed." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
