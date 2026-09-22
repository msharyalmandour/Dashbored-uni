/**
 * Whether the system knows it failed to read something.
 *
 * Every case below is real. The garbled string is the text a student
 * photographed off their own screen and sent in; the empty-pages case is a
 * 47-page lecture whose extraction came back with three pages of text and was
 * recorded as COMPLETED. Both were green ticks at the time.
 *
 * This is the test that has to keep working, because the failure it guards
 * against is invisible by construction: nothing looks more finished than a
 * document that finished processing.
 *
 * Run: npx tsx scripts/verify-read-quality.ts
 */

import {
  assessRead,
  countWords,
  fragmentRatio,
  isUsableText,
  letterRatio,
  MAX_FRAGMENT_RATIO,
  MIN_LETTER_RATIO,
  needsTelling,
} from "../src/lib/read-quality";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) {
    failures++;
    console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

const page = (pageNumber: number, text: string) => ({ pageNumber, text });

console.log("Read quality\n");

{
  const q = assessRead({ text: "", pages: [], pageCount: 0 });
  check("nothing read is 'empty', not 'good'", q.verdict === "empty", q.verdict);
  check("nothing read is not usable", !isUsableText(q));
  check("nothing read is worth telling the student", needsTelling(q));
}
{
  const q = assessRead({ text: null });
  check("null text does not crash and is 'empty'", q.verdict === "empty", q.verdict);
}

{
  /* The real thing, off the student's screen. Joined-per-glyph-run text. */
  const mangled =
    "1.TheM echan ics o fVen tila tion S tuden t Lea m ing O b ject ives " +
    "Descr be them echan cs o fven tia ton in term so fa im ovem ent in to " +
    "and ou to f the ungs, ung com p lance ,and a iw ay res istance";
  const q = assessRead({ text: mangled });
  check("the mangling a student actually saw is caught", q.verdict === "garbled",
    `${q.verdict} reasons=${q.reasons.join(",")}`);
  check("and is named as broken words", q.reasons.includes("broken-words"), q.reasons.join(","));
  check("and is refused as a basis for filing", !isUsableText(q));
}

{
  /* The same sentence, read correctly. */
  const clean =
    "Describe the mechanics of ventilation in terms of air movement into and " +
    "out of the lungs, lung compliance, and airway resistance. Explain factors " +
    "that affect the diffusion of gases across the alveolar capillary membrane.";
  const q = assessRead({ text: clean });
  check("correctly read prose is 'good'", q.verdict === "good", `${q.verdict} ${q.reasons.join(",")}`);
  check("and says nothing to the student", !needsTelling(q));
}

{
  // Arabic must pass exactly as English does — \p{L} is not Latin-only.
  const arabic =
    "تصف ميكانيكا التنفس من حيث حركة الهواء إلى داخل الرئتين وخارجهما، " +
    "ومطاوعة الرئة، ومقاومة المجرى الهوائي، مع شرح العوامل المؤثرة في انتشار الغازات.";
  const q = assessRead({ text: arabic });
  check("Arabic prose is read as well as English", q.verdict === "good",
    `${q.verdict} letters=${letterRatio(arabic).toFixed(2)}`);
}

{
  // A CID font with no cmap comes back like this.
  const mojibake = "��� ??? �� ?? ��� ?? ��";
  const q = assessRead({ text: mojibake });
  check("mojibake is garbled, not good", q.verdict === "garbled", q.verdict);
  check("and the decoder's own surrender is named",
    q.reasons.includes("replacement-chars") || q.reasons.includes("no-letters"), q.reasons.join(","));
}

{
  /* The 47-page lecture with text on three pages. Total word count alone
     would call this fine; only the per-page view shows the hole. */
  const pages = [
    page(1, "Gas Exchange and Respiratory Function Acute Respiratory Failure and ARDS Part six"),
    page(2, "Student Learning Objectives describe the mechanics of ventilation and airway resistance"),
    page(3, "Explain factors that affect the diffusion of gases across the alveolar membrane"),
    ...Array.from({ length: 44 }, (_, i) => page(i + 4, "")),
  ];
  const q = assessRead({ text: pages.map((p) => p.text).join("\n"), pages, pageCount: 47 });
  check("a deck read on 3 of 47 pages is not 'good'", q.verdict !== "good", q.verdict);
  check("and the hole is named", q.reasons.includes("empty-pages"), q.reasons.join(","));
  check("and the student is told", needsTelling(q));
  check("but it is still usable — three real pages beat nothing", isUsableText(q));
}

{
  // A deck genuinely read end to end must NOT be flagged.
  const pages = Array.from({ length: 20 }, (_, i) =>
    page(i + 1, "This slide carries several real sentences about respiratory physiology and gas exchange."));
  const q = assessRead({ text: pages.map((p) => p.text).join("\n"), pages, pageCount: 20 });
  check("a fully read deck stays 'good'", q.verdict === "good", `${q.verdict} ${q.reasons.join(",")}`);
}

{
  // Numbering is not damage.
  const numbered = "1. Define planning 2. Discuss its importance 3. State the types of plans " +
    "4. List characteristics of an effective plan 5. Discuss sources and tools";
  const q = assessRead({ text: numbered });
  check("a numbered list is not mistaken for mangling", q.verdict === "good",
    `${q.verdict} fragments=${fragmentRatio(numbered).toFixed(2)}`);
}

{
  /* A reference-range slide — the densest numbers get in a critical-care deck.
     Counting numerals as word fragments would read this as mangled text, and
     an ABG table is exactly the slide a nursing student most needs kept. */
  const abg =
    "pH 7.35 7.45 PaCO2 35 45 mmHg HCO3 22 26 mEq/L PaO2 80 100 mmHg " +
    "SaO2 95 100 percent base excess -2 +2 anion gap 8 16";
  const q = assessRead({ text: abg });
  check("a table of values is not mistaken for mangled text", q.verdict !== "garbled",
    `${q.verdict} fragments=${fragmentRatio(abg).toFixed(2)} letters=${letterRatio(abg).toFixed(2)}`);
}

{
  const q = assessRead({ text: "Lecture 4" });
  check("a title and nothing else is 'thin'", q.verdict === "thin", q.verdict);
  check("and is still usable", isUsableText(q));
}

{
  check("word counting ignores runs of whitespace", countWords("  a   b \n c  ") === 3);
  check("letter ratio of pure punctuation is zero", letterRatio("...,,,;;;") === 0);
  check("fragment ratio needs enough words to judge", fragmentRatio("a b c") === 0);
  check("the thresholds sit where prose is not damage",
    MIN_LETTER_RATIO > 0.3 && MIN_LETTER_RATIO < 0.8 && MAX_FRAGMENT_RATIO > 0.2 && MAX_FRAGMENT_RATIO < 0.7);
}

if (failures) {
  console.error(`\n${failures} failing check(s).`);
  process.exit(1);
}
console.log(
  "  A document that could not be read says so. Mangled text, mojibake and a\n" +
    "  deck read on three of forty-seven pages are each caught and named — and\n" +
    "  ordinary prose, Arabic included, and a numbered list are not mistaken for\n" +
    "  any of them. Nothing here asks a model whether it understood."
);
