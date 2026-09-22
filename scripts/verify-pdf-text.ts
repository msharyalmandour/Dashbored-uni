/**
 * The seam between two glyph runs, checked without a lecture to attach.
 *
 * A PDF holds no sentences — only instructions to put glyph runs at
 * coordinates — and an exporter may split a word wherever it likes.
 * PowerPoint splits on every kerning pair, so "Mechanics" arrives as
 * ["M", "echan", "ics"]. The old extractor joined every run with a space and
 * produced text a student recognised instantly as wrong:
 *
 *   1.TheM echan ics o fVen tila tion
 *
 * This is the kind of fault that cannot be caught by attaching a lecture and
 * looking at it, because the damage is in a field nobody opens until the
 * search comes back empty or the agent summarises a lecture it misread.
 *
 * Run: npx tsx scripts/verify-pdf-text.ts
 */

import { joinTextPieces, SPACE_GAP_RATIO, type TextPiece } from "../src/lib/pdf-text";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) {
    failures++;
    console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

/** One run: text, where it starts, how wide it is. 12pt line by default. */
const piece = (str: string, x: number, width: number, y = 100, height = 12, hasEOL = false): TextPiece =>
  ({ str, transform: [height, 0, 0, height, x, y], width, height, hasEOL });

console.log("PDF text extraction\n");

{
  /* The exact shape of the reported bug: one phrase, split mid-word by the
     exporter, every run butting directly against the last. */
  const split = [
    piece("1.The", 40, 30),   // ends at 70
    piece("M", 78, 10),       // gap 8 — a real space in the PDF
    piece("echan", 88, 32),   // gap 0 — a kerning split, mid-word
    piece("ics", 120, 16),    // gap 0 — still mid-word
    piece(" of", 136, 16),    // carries its own leading space
    piece(" Ven", 152, 24),
    piece("tila", 176, 20),   // gap 0 — mid-word again
    piece("tion", 196, 22),
  ];
  const joined = joinTextPieces(split);
  check("a word split across runs is not pulled apart",
    joined === "1.The Mechanics of Ventilation", JSON.stringify(joined));
  check("the old mangling cannot come back", !/M echan|o fVen|tila tion/.test(joined), joined);
}

{
  // A real space in the PDF is a real gap on the page, and must survive.
  const spaced = [piece("Student", 40, 45), piece("Learning", 89, 50), piece("Objectives", 143, 60)];
  check("a genuine gap between words becomes a space",
    joinTextPieces(spaced) === "Student Learning Objectives", JSON.stringify(joinTextPieces(spaced)));
}

{
  // Spaces the PDF already carries are not doubled.
  const carried = [piece("Compliance ", 40, 60), piece("is ", 100, 12), piece("a ", 112, 8)];
  check("a run that already ends in a space gains no second one",
    joinTextPieces(carried).replace(/\s+$/, "") === "Compliance is a", JSON.stringify(joinTextPieces(carried)));
}

{
  const lines = [piece("first line", 40, 60, 100, 12, true), piece("second line", 40, 65, 80)];
  const out = joinTextPieces(lines);
  check("a line break is a line break, not a space", out === "first line\nsecond line", JSON.stringify(out));
}

{
  // Two columns, or a footnote marker: far apart vertically. Gluing these
  // together invents a word, which is the failure nobody notices.
  const apart = [piece("alveoli", 40, 40, 200), piece("Surfactant", 40, 55, 100)];
  check("runs on different lines are never glued", joinTextPieces(apart) === "alveoli Surfactant",
    JSON.stringify(joinTextPieces(apart)));
}

{
  // A run that moved backwards (right-to-left text, or a re-positioned run)
  // must not be glued onto what preceded it.
  const back = [piece("tion", 188, 22), piece("Ven", 40, 24)];
  check("a run that moves backwards is separated", joinTextPieces(back) === "tion Ven",
    JSON.stringify(joinTextPieces(back)));
}

{
  const empty = [piece("one", 40, 20, 100, 12, true), piece("", 0, 0), piece("two", 40, 20, 85)];
  check("an empty run does not become a stray space", joinTextPieces(empty) === "one\ntwo",
    JSON.stringify(joinTextPieces(empty)));
}

{
  /* The line break carried by an EMPTY run, which is how exporters usually
     emit it — the run before it says nothing about ending the line. Without
     the "already ends in a newline" guard, the next line gets measured against
     the empty run's x=0 and arrives indented by a space. */
  const brokenBy = [
    piece("first", 40, 30),
    piece("", 0, 0, 100, 12, true),
    piece("second", 40, 35, 85),
  ];
  check("a break carried by an empty run does not indent the next line",
    joinTextPieces(brokenBy) === "first\nsecond", JSON.stringify(joinTextPieces(brokenBy)));
}

{
  // Nothing to reason from: a space is the safer guess, because a reader can
  // skip one and cannot recover a word that was silently welded shut.
  const noGeom = [{ str: "abc", transform: [], width: 0, height: 0 },
                  { str: "def", transform: [], width: 0, height: 0 }];
  check("without geometry it errs towards a space", joinTextPieces(noGeom) === "abc def",
    JSON.stringify(joinTextPieces(noGeom)));
}

{
  check("the threshold sits between a kern and a space",
    SPACE_GAP_RATIO > 0.06 && SPACE_GAP_RATIO < 0.24, String(SPACE_GAP_RATIO));
}

{
  check("no pieces is empty text, not a crash", joinTextPieces([]) === "");
}

if (failures) {
  console.error(`\n${failures} failing check(s).`);
  process.exit(1);
}
console.log(
  "  A word the exporter split across runs comes back whole; a space the PDF\n" +
    "  really has survives. Line breaks stay breaks, columns stay apart, and a\n" +
    "  run with no geometry to judge by errs towards a space — a reader can skip\n" +
    "  one, and cannot recover a word that was welded shut."
);
