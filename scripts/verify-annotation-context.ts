/**
 * What the student marked, and whether it survives the trip to the model.
 *
 * Every failure this guards against is silent by nature. A highlight resolved
 * to the wrong line still produces a confident, fluent, wrong answer — and the
 * student, who marked that line precisely because they were unsure about it,
 * is the person least able to catch it.
 *
 * The coordinate flip is the sharpest edge here: pdf.js counts y up from the
 * bottom, ink counts y down from the top, and getting it backwards mirrors
 * every mark about the middle of the page. A mark on the first bullet lands on
 * the last one. Nothing crashes, nothing looks wrong, and every answer is
 * about the wrong sentence.
 *
 * Run: npx tsx scripts/verify-annotation-context.ts
 */

import { readFileSync } from "node:fs";
import {
  boxOfStroke,
  buildAnnotationNote,
  COVER_TOLERANCE,
  describeRegion,
  marksFromStrokes,
  MAX_MARKS_PER_PAGE,
  resolveMarks,
  textBoxFrom,
  textUnder,
  type TextBox,
} from "../src/lib/annotation-context";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) {
    failures++;
    console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

/** A stroke in normalised page space. */
const stroke = (mode: string, pts: [number, number][], extra: Record<string, unknown> = {}) => ({
  mode, color: "#f0a", width: 3, points: pts.map(([x, y]) => ({ x, y })), ...extra,
});

/** A text box straight in annotation space, for the overlap tests. */
const tb = (text: string, x0: number, y0: number, x1: number, y1: number): TextBox =>
  ({ text, x0, y0, x1, y1 });

console.log("Annotation context\n");

/* ---- 1. no annotations ------------------------------------------------- */
{
  check("no strokes yields no marks", marksFromStrokes(1, []).length === 0);
  check("no marks yields an empty note, not a paragraph about emptiness",
    buildAnnotationNote([]) === "");
  check("null strokes do not throw", marksFromStrokes(1, null).length === 0);
  check("a non-array blob does not throw", marksFromStrokes(1, { nope: true } as unknown).length === 0);
}

/* ---- 2 & 3. one pen stroke / one highlight ----------------------------- */
{
  const pen = marksFromStrokes(2, [stroke("pen", [[0.1, 0.5], [0.4, 0.52]])]);
  check("a pen stroke becomes one mark", pen.length === 1 && pen[0].tool === "pen", JSON.stringify(pen));
  check("and keeps the page it was drawn on", pen[0]?.page === 2);

  const hi = marksFromStrokes(2, [stroke("highlighter", [[0.1, 0.5], [0.6, 0.5]])]);
  check("a highlighter stroke is kept apart from a pen one", hi[0]?.tool === "highlighter");
}

/* ---- the eraser is not a mark ------------------------------------------ */
{
  const marks = marksFromStrokes(1, [stroke("eraser", [[0.1, 0.1], [0.9, 0.9]])]);
  check("an eraser is not the student pointing at anything", marks.length === 0);
}

/* ---- the coordinate flip, directly ------------------------------------- */
{
  /* A 612x792 page. A line near the TOP of the page has a HIGH pdf y. If the
     flip is wrong it comes back near the bottom in annotation space. */
  const nearTop = textBoxFrom({ str: "Objectives", transform: [12, 0, 0, 12, 72, 720], width: 80, height: 12 }, 612, 792);
  check("text high on the PDF page lands near the TOP in ink space",
    !!nearTop && nearTop.y0 < 0.12, JSON.stringify(nearTop));

  const nearBottom = textBoxFrom({ str: "footer", transform: [10, 0, 0, 10, 72, 40], width: 40, height: 10 }, 612, 792);
  check("text low on the PDF page lands near the BOTTOM in ink space",
    !!nearBottom && nearBottom.y1 > 0.93, JSON.stringify(nearBottom));

  check("x is not flipped", !!nearTop && Math.abs(nearTop.x0 - 72 / 612) < 1e-9);
  check("a zero-size page does not divide by zero",
    textBoxFrom({ str: "x", transform: [1, 0, 0, 1, 0, 0], width: 1, height: 1 }, 0, 0) === null);
  check("an empty run is not a text box",
    textBoxFrom({ str: "   ", transform: [1, 0, 0, 1, 0, 0], width: 1, height: 1 }, 612, 792) === null);
}

/* ---- 6. annotation over text ------------------------------------------- */
{
  const boxes = [
    tb("Describe the mechanics of ventilation", 0.10, 0.28, 0.80, 0.31),
    tb("Explain factors that affect diffusion", 0.10, 0.36, 0.78, 0.39),
  ];
  const over = textUnder({ x0: 0.12, y0: 0.285, x1: 0.55, y1: 0.305 }, boxes);
  check("a mark over a line resolves to that line's words",
    over.length === 1 && over[0].startsWith("Describe"), JSON.stringify(over));
  check("and not to the line below it", !over.some((t) => t.startsWith("Explain")), JSON.stringify(over));
}

/* ---- a mark drawn slightly off still counts ---------------------------- */
{
  const boxes = [tb("PaCO2 > 45 mmHg", 0.20, 0.50, 0.45, 0.53)];
  const justAbove = textUnder({ x0: 0.21, y0: 0.492, x1: 0.44, y1: 0.497 }, boxes);
  check("an underline drawn just off the line still finds it", justAbove.length === 1, JSON.stringify(justAbove));
  const farAway = textUnder({ x0: 0.21, y0: 0.10, x1: 0.44, y1: 0.12 }, boxes);
  check("but a mark elsewhere on the page does not", farAway.length === 0, JSON.stringify(farAway));
}

/* ---- 7. annotation over a diagram -------------------------------------- */
{
  const marks = marksFromStrokes(4, [stroke("pen", [[0.62, 0.12], [0.90, 0.30]])]);
  const resolved = resolveMarks(marks, []);   // an image slide: no text at all
  check("a mark on a diagram covers no text", resolved[0].covers.length === 0);
  check("and is described by where it is instead",
    resolved[0].where === "the top-right of the page", resolved[0].where);
  const note = buildAnnotationNote(resolved);
  check("and the note says so honestly", note.includes("nothing written there"), note);
}

/* ---- 8. Arabic ---------------------------------------------------------- */
{
  const boxes = [tb("مطاوعة الرئة ومقاومة المجرى الهوائي", 0.15, 0.40, 0.75, 0.44)];
  const marks = marksFromStrokes(3, [stroke("highlighter", [[0.18, 0.41], [0.70, 0.42]])]);
  const resolved = resolveMarks(marks, boxes);
  check("an Arabic line is resolved exactly as an English one",
    resolved[0].covers.length === 1 && resolved[0].covers[0].includes("مطاوعة"), JSON.stringify(resolved[0].covers));
  check("and reaches the note intact", buildAnnotationNote(resolved).includes("مطاوعة"));
}

/* ---- 9. dense numeric / ABG slide -------------------------------------- */
{
  const boxes = [
    tb("pH 7.35 - 7.45", 0.10, 0.20, 0.35, 0.23),
    tb("PaCO2 35 - 45 mmHg", 0.10, 0.26, 0.40, 0.29),
    tb("HCO3 22 - 26 mEq/L", 0.10, 0.32, 0.40, 0.35),
  ];
  const marks = marksFromStrokes(7, [stroke("highlighter", [[0.11, 0.27], [0.39, 0.275]])]);
  const resolved = resolveMarks(marks, boxes);
  check("one row of a reference table is picked out, not the whole table",
    resolved[0].covers.length === 1 && resolved[0].covers[0].includes("PaCO2"), JSON.stringify(resolved[0].covers));
}

/* ---- 4. several marks on one slide ------------------------------------- */
{
  const boxes = [
    tb("first bullet", 0.10, 0.20, 0.50, 0.23),
    tb("second bullet", 0.10, 0.30, 0.50, 0.33),
    tb("third bullet", 0.10, 0.40, 0.50, 0.43),
  ];
  const marks = marksFromStrokes(2, [
    stroke("highlighter", [[0.11, 0.21], [0.49, 0.22]]),
    stroke("pen", [[0.11, 0.41], [0.49, 0.42]]),
  ]);
  const resolved = resolveMarks(marks, boxes);
  check("two marks on one page stay two marks", resolved.length === 2);
  check("each resolves to its own line",
    resolved[0].covers[0] === "first bullet" && resolved[1].covers[0] === "third bullet",
    JSON.stringify(resolved.map((r) => r.covers)));
  const note = buildAnnotationNote(resolved);
  check("the note keeps the tools apart",
    note.includes("highlighted") && note.includes("drew over"), note);
}

/* ---- overlapping marks -------------------------------------------------- */
{
  const boxes = [tb("one line", 0.10, 0.20, 0.50, 0.23)];
  const marks = marksFromStrokes(1, [
    stroke("highlighter", [[0.11, 0.21], [0.30, 0.22]]),
    stroke("highlighter", [[0.25, 0.21], [0.49, 0.22]]),
  ]);
  const resolved = resolveMarks(marks, boxes);
  check("two overlapping marks are not merged into one", resolved.length === 2);
}

/* ---- 5. marks across several slides ------------------------------------ */
{
  const all = [
    ...marksFromStrokes(2, [stroke("pen", [[0.1, 0.2], [0.4, 0.21]])]),
    ...marksFromStrokes(9, [stroke("highlighter", [[0.1, 0.5], [0.4, 0.51]])]),
    ...marksFromStrokes(2, [stroke("pen", [[0.1, 0.7], [0.4, 0.71]])]),
  ];
  const note = buildAnnotationNote(resolveMarks(all, []));
  check("pages are grouped and ordered", note.indexOf("Page 2:") < note.indexOf("Page 9:"), note);
  check("page 2's two marks stay on page 2",
    (note.split("Page 9:")[0].match(/^ {2}- /gm) ?? []).length === 2, note);
}

/* ---- many marks on one page are capped, and say so --------------------- */
{
  const many = Array.from({ length: MAX_MARKS_PER_PAGE + 5 }, (_, i) =>
    stroke("pen", [[0.1, 0.05 + i * 0.05], [0.4, 0.06 + i * 0.05]]));
  const note = buildAnnotationNote(resolveMarks(marksFromStrokes(1, many), []));
  check("a page covered in ink is capped rather than dumped",
    (note.match(/^ {2}- (drew|highlighted)/gm) ?? []).length === MAX_MARKS_PER_PAGE, note.slice(0, 200));
  check("and the remainder is counted, not dropped silently",
    note.includes("and 5 more marks"), note.slice(-120));
}

/* ---- 10. zoom ----------------------------------------------------------- */
{
  /* Ink is stored normalised against the page box, so zoom never enters the
     stored value. The guard that matters is the one against a value that HAS
     escaped the page — which is corruption, not zoom. */
  const inside = boxOfStroke(stroke("pen", [[0.2, 0.3], [0.6, 0.35]]));
  check("a normal stroke is accepted", !!inside);
  const wild = boxOfStroke(stroke("pen", [[9, 9], [12, 12]]));
  check("a stroke far outside the page is refused, not clamped into the middle", wild === null);
  const mixed = boxOfStroke(stroke("pen", [[0.2, 0.3], [99, 99], [0.6, 0.35]]));
  check("one corrupt point does not poison a good stroke's box",
    !!mixed && mixed.box.x1 <= 1.5, JSON.stringify(mixed?.box));
}

/* ---- 12. malformed ------------------------------------------------------ */
{
  const junk: unknown[] = [
    null, undefined, 42, "stroke", {}, { mode: "pen" }, { mode: "pen", points: [] },
    { mode: "pen", points: [{ x: "a", y: "b" }] },
    { mode: "pen", points: [{ x: NaN, y: 0.5 }] },
    { mode: "unknown-tool", points: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }] },
    stroke("pen", [[0.5, 0.5]]),                       // a single tap
    stroke("pen", [[0.5, 0.5], [0.5005, 0.5005]]),     // a slip
  ];
  const marks = marksFromStrokes(1, junk);
  check("every malformed stroke is skipped rather than thrown on", marks.length === 0,
    JSON.stringify(marks));

  const mixed = marksFromStrokes(1, [...junk, stroke("highlighter", [[0.1, 0.2], [0.8, 0.22]])]);
  check("one good stroke among the junk still survives", mixed.length === 1, JSON.stringify(mixed));
}

/* ---- 11. a deleted annotation ------------------------------------------ */
{
  /* Deleting is erasing: the row is rewritten with the strokes that remain, so
     "deleted" arrives here as an absence. The check is that an emptied page
     contributes nothing rather than a stale mark. */
  const note = buildAnnotationNote(resolveMarks(marksFromStrokes(5, []), []));
  check("a page whose ink was erased contributes nothing", note === "");
}

/* ---- the framing, which is the whole point ----------------------------- */
{
  const boxes = [tb("PaCO2 > 45 mmHg", 0.20, 0.50, 0.45, 0.53)];
  const resolved = resolveMarks(marksFromStrokes(7, [stroke("highlighter", [[0.21, 0.51], [0.44, 0.52]])]), boxes);
  const note = buildAnnotationNote(resolved);
  check("the note quotes what was marked", note.includes("PaCO2 > 45 mmHg"), note);
  check("and says it is the student's attention", /student's attention/i.test(note), note);
  check("and refuses to make it a fact", /never that it is correct/i.test(note), note);
}

/* ---- runs are stitched, not blindly spaced ----------------------------- */
{
  /* Straight off the student's own lecture: a PDF splits "Part (6)/Chapter
     [23, 26, 27]" into separate runs, and joining them with a space quotes
     their highlight back at them mangled. Found by running this against the
     real file, not by reading the code. */
  const runs = [
    tb("Part (", 0.30, 0.40, 0.37, 0.43),
    tb("6", 0.370, 0.40, 0.385, 0.43),
    tb(")/Chapter [", 0.385, 0.40, 0.49, 0.43),
    tb("23", 0.490, 0.40, 0.515, 0.43),
    tb(", ", 0.515, 0.40, 0.525, 0.43),
    tb("26", 0.525, 0.40, 0.550, 0.43),
    tb("]", 0.550, 0.40, 0.560, 0.43),
  ];
  const got = textUnder({ x0: 0.29, y0: 0.405, x1: 0.57, y1: 0.425 }, runs);
  check("split runs are stitched without invented spaces",
    got.length === 1 && got[0] === "Part (6)/Chapter [23, 26]", JSON.stringify(got));
}

{
  /* The other half of the same rule: runs with a REAL gap between them must
     keep their space, or "Student Learning Objectives" welds shut. Only the
     no-gap case was covered at first, and a mutation that never inserts a
     space passed — caught by mutation testing, not by reading. */
  const spaced = [
    tb("Student", 0.10, 0.20, 0.20, 0.23),
    tb("Learning", 0.215, 0.20, 0.32, 0.23),   // a real gap before this
    tb("Objectives", 0.335, 0.20, 0.46, 0.23),
  ];
  const got = textUnder({ x0: 0.09, y0: 0.205, x1: 0.47, y1: 0.225 }, spaced);
  check("a real gap between runs stays a space",
    got.length === 1 && got[0] === "Student Learning Objectives", JSON.stringify(got));
}

{
  // A mark spanning two lines comes back as two quotable pieces.
  const two = [
    tb("first line of the bullet", 0.10, 0.20, 0.60, 0.23),
    tb("second line of it", 0.10, 0.25, 0.45, 0.28),
  ];
  const got = textUnder({ x0: 0.09, y0: 0.19, x1: 0.62, y1: 0.29 }, two);
  check("a mark over two lines keeps them apart", got.length === 2, JSON.stringify(got));
}

/* ---- regions ------------------------------------------------------------ */
{
  check("centre is named plainly", describeRegion({ x0: 0.45, y0: 0.45, x1: 0.55, y1: 0.55 }) === "the centre of the page");
  check("a corner is named by both axes", describeRegion({ x0: 0.02, y0: 0.02, x1: 0.1, y1: 0.1 }) === "the top-left of the page");
  check("tolerance is small but not zero", COVER_TOLERANCE > 0 && COVER_TOLERANCE < 0.05);
}

/* ---- 13. another student's, or another lecture's ----------------------- */
{
  /* Ownership cannot be proved by calling the function — a passing call proves
     only that the fixture was mine. It is proved by reading the query: the
     chain from annotation to student has no shortcut, and SlideAnnotation
     carries no userId of its own, so every read must name it in full. The same
     technique scripts/verify-deletion.ts uses, for the same reason. */
  const src = readFileSync("src/lib/annotation-reader.ts", "utf8");

  const where = src.slice(src.indexOf("const rows = await prisma.slideAnnotation.findMany"));
  const clause = where.slice(0, where.indexOf("select:"));

  check("the annotation query is scoped to one lecture",
    /lectureId,/.test(clause), clause.slice(0, 300));
  check("and to the student who owns that lecture's course",
    /lecture:\s*\{\s*subject:\s*\{\s*userId\s*\}/.test(clause), clause.slice(0, 300));
  check("and never reads annotations by slide id alone",
    !/findMany\(\{\s*where:\s*\{\s*slideId/.test(src));
  check("the reader takes the user it is scoped to as an argument",
    /readAnnotationNote\(\s*\n?\s*userId: string/.test(src) || /userId: string,/.test(src));
  check("and nothing here reads a slide without an ownership clause",
    (src.match(/prisma\./g) ?? []).length === (src.match(/subject: \{ userId \}/g) ?? []).length,
    `prisma calls=${(src.match(/prisma\./g) ?? []).length} scoped=${(src.match(/subject: \{ userId \}/g) ?? []).length}`);
}

if (failures) {
  console.error(`\n${failures} failing check(s).`);
  process.exit(1);
}
console.log(
  "  A mark resolves to the lecture's own words underneath it, on the page it\n" +
    "  was drawn on, with the PDF's bottom-up y correctly flipped. Erasers, taps\n" +
    "  and malformed rows are skipped without taking the lecture down. Arabic and\n" +
    "  a reference table work exactly as English prose does. And every line says\n" +
    "  it is the student's attention — never that what they marked is true."
);
