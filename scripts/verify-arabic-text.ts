/**
 * Arabic that a search box can find.
 *
 * Unicode encodes Arabic twice: the letters people type (U+0600 block) and the
 * "presentation forms" (U+FB50–FDFF, U+FE70–FEFF) — one codepoint per shape a
 * letter takes beside its neighbours. A PDF may declare its glyphs to mean
 * either, and Arabic lectures routinely declare the second.
 *
 * That failure hides. The page reads correctly to a human and to a model, the
 * quality check calls it good, the lecture is stored — and then the student
 * searches for الضغط الجزئي and gets nothing, because the database holds
 * ﺍﻝﺽﻍﻁ ﺍﻝﺝﺯﺉﻱ, the same words in codepoints no query contains. Nothing
 * anywhere reports an error.
 *
 * The other half of the job is what must NOT change. Blanket NFKC fixes the
 * Arabic and quietly rewrites ₂ to 2 — turning PaCO₂ into PaCO2 in a
 * respiratory lecture, and m³ into m3. A fix that trades one silent
 * corruption for another is not a fix, so the preservation cases below carry
 * the same weight as the repair cases.
 *
 * Run: npx tsx scripts/verify-arabic-text.ts
 */

import { joinTextPieces, normalizeArabicText, type TextPiece } from "../src/lib/pdf-text";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) {
    failures++;
    console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

const show = (s: string) =>
  [...s].map((c) => "U+" + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")).join(" ");

console.log("Arabic text normalisation\n");

/* ── What must be repaired ───────────────────────────────────────────────── */

{
  // The exact string the extractor produced from a real Arabic lecture page.
  const extracted = "ﺍﻝﺽﻍﻁ ﺍﻝﺝﺯﺉﻱ ﻝﻝﺃﻙﺱﺝﻱﻥ";
  const typed = "الضغط الجزئي للأكسجين";
  const got = normalizeArabicText(extracted);
  check(
    "presentation forms become the letters a student types",
    got === typed,
    `got ${JSON.stringify(got)}\n        want ${JSON.stringify(typed)}`
  );
}

{
  // Lam-alef is one presentation-form codepoint and two real letters. Getting
  // this wrong leaves a word that looks right and still will not match.
  const got = normalizeArabicText("ﻻ");
  check("the lam-alef ligature decomposes into لا", got === "لا", show(got));
}

{
  // Forms-A, the other block. A lecture title can land here.
  const got = normalizeArabicText("ﷲ"); // ﷲ
  check("Presentation Forms-A is covered too", got !== "ﷲ" && got.includes("ل"), show(got));
}

{
  // Every shape of the same letter must reach the same letter, or a word
  // matches in one position and not another.
  const shapes = ["ﺍ", "ﺎ"]; // alef isolated, alef final
  const got = shapes.map((s) => normalizeArabicText(s));
  check("all shapes of one letter collapse to that letter", got.every((g) => g === "ا"), got.map(show).join(" | "));
}

/* ── What must NOT change ────────────────────────────────────────────────── */

{
  // The case that rules out a blanket NFKC. This student's own lecture is
  // about arterial blood gases; PaCO₂ appears on nearly every page of it.
  const science = "PaCO₂ 35–45 mmHg, V̇/Q̇, 25°C, m³";
  check(
    "subscripts, superscripts and units survive untouched",
    normalizeArabicText(science) === science,
    `got ${JSON.stringify(normalizeArabicText(science))}`
  );
}

{
  // Same string, both scripts. The Arabic half must be repaired without the
  // Latin half being touched — this is the case a range-limited replace can
  // get wrong in either direction.
  const mixed = "ﺱﻠﺢ PaCO₂ ﺍﻟﺪﻡ";
  const got = normalizeArabicText(mixed);
  check("mixed Arabic and science notation: Arabic repaired", !/[ﭐ-﷿ﹰ-ﻼ]/.test(got), show(got));
  check("mixed Arabic and science notation: ₂ preserved", got.includes("₂"), show(got));
}

{
  // A BOM sits inside the Forms-B block but is not a letter. Rewriting it
  // would corrupt the start of a file rather than fix anything.
  const got = normalizeArabicText("﻿hello");
  check("the byte-order mark is left alone", got === "﻿hello", show(got));
}

{
  // Text already in the letters people type must come back byte for byte;
  // a lecture read twice must not drift.
  const typed = "الضغط الجزئي للأكسجين الطبيعي بين 80 و 100 ملم زئبق.";
  check("already-correct Arabic is returned unchanged", normalizeArabicText(typed) === typed);
}

{
  const english = "Gas Exchange and Respiratory Function";
  check("text with no Arabic at all is returned unchanged", normalizeArabicText(english) === english);
  check("empty input is safe", normalizeArabicText("") === "");
}

{
  // Applied twice — once at extraction, once at search — must equal once.
  const once = normalizeArabicText("ﺍﻝﺽﻍﻁ ﺍﻝﺝﺯﺉﻱ");
  check("normalising twice equals normalising once", normalizeArabicText(once) === once);
}

{
  // The regex is module-level and global; a stateful `lastIndex` would make
  // the second call on the same string behave differently from the first.
  const s = "ﺍﻝﺽﻍﻁ ﺍﻝﺝﺯﺉﻱ ﻝﻝﺃﻙﺱﺝﻱﻥ ﺍﻝﻁﺏﻱﻉﻱ";
  const a = normalizeArabicText(s);
  const b = normalizeArabicText(s);
  check("repeated calls on the same input agree", a === b, `${show(a)}\n        ${show(b)}`);
}

/* ── The seam: extraction actually applies it ────────────────────────────── */

{
  /* A verify that only tested the function would pass with the function wired
     to nothing. This drives the real join, the way the processor does. */
  const piece = (str: string, x: number, width: number): TextPiece =>
    ({ str, transform: [12, 0, 0, 12, x, 100], width, height: 12, hasEOL: false });

  const joined = joinTextPieces([
    piece("ﺍﻝﺸﺺﻛ", 40, 30),
    piece("ﺍﻝﺠﺓﺔ", 78, 30),
  ]);
  check(
    "joinTextPieces returns letters, not presentation forms",
    !/[ﭐ-﷿ﹰ-ﻼ]/.test(joined),
    show(joined)
  );
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
