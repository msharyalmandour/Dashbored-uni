/**
 * What the student marked, resolved to what they marked it ON.
 *
 * The model already sees the lecture: `organize.ts` sends the PDF whole, so
 * printed text, diagrams and any ink baked into the file all reach it. What
 * never reached it is the ink the student draws IN this app — pen strokes and
 * highlighter, stored in SlideAnnotation and invisible to everything but the
 * canvas that drew them.
 *
 * That ink is the most valuable signal in the whole product. It is the student
 * saying *this is what matters*, *this is coming in the exam*, *I do not follow
 * this* — judgements no amount of reading the lecture can recover.
 *
 * WHY NOT JUST HAND OVER THE ROWS. A stroke is a list of points. "The student
 * drew from (0.12, 0.31) to (0.55, 0.33)" tells a model almost nothing it can
 * act on, because it cannot reliably tell what sits at those coordinates on a
 * page it is reading as an image. So the geometry is resolved here, against the
 * text positions the extractor already produces, into the thing that is
 * actually useful:
 *
 *     the student highlighted "PaCO2 > 45 mmHg"
 *
 * which is a fact the model can reason about, quote back, and build a question
 * out of. Where nothing is underneath — a stroke on a diagram, a circle on an
 * X-ray — it falls back to naming the region, which is the honest answer rather
 * than an invented one.
 *
 * WHAT THIS IS NOT. A mark is never evidence that the marked text is true, or
 * important in the lecturer's opinion, or correct. It is evidence of one thing:
 * the student attended to it. Keeping those apart is the caller's job and the
 * reason `buildAnnotationNote` labels every line the way it does.
 */

import type { Stroke } from "@/lib/ink";

/** A box in the annotation coordinate space: 0..1, origin top-left. */
export type Box = { x0: number; y0: number; x1: number; y1: number };

/** Pen and highlighter say different things. An eraser says nothing at all. */
export type MarkTool = "pen" | "highlighter";

export type Mark = {
  /** 1-based, and the same number the UI shows, the PDF uses and the row stores. */
  page: number;
  tool: MarkTool;
  box: Box;
  /** How many points the stroke had — a proxy for a scribble vs a straight line. */
  points: number;
};

/**
 * One run of text with its place on the page, already in annotation space.
 *
 * pdf.js reports text in PDF units with the origin at the BOTTOM-left and y
 * increasing upwards; ink is normalised 0..1 with the origin at the TOP-left.
 * Converting between them is the one place this file can be silently,
 * plausibly wrong — a highlight would land on the line it mirrors about the
 * page's middle, which looks like a subtle mis-assignment rather than a bug.
 * `textBoxFrom` is the only place the flip happens, and it is tested directly.
 */
export type TextBox = { text: string } & Box;

/** A pdf.js text item, narrowed to the fields the geometry needs. */
export type TextItemLike = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

/**
 * How far outside its box a mark still counts as covering text.
 *
 * Nobody highlights precisely. A stroke drawn just above a line, or a pen
 * underline drawn just below it, is plainly about that line, and a zero
 * tolerance would drop exactly the marks a student makes most. Expressed as a
 * fraction of the page, so it does not depend on page size.
 */
export const COVER_TOLERANCE = 0.012;

/** Strokes shorter than this are taps and slips, not marks. */
export const MIN_MARK_SPAN = 0.004;

/** Beyond this many marks on one page, the rest are counted rather than listed. */
export const MAX_MARKS_PER_PAGE = 12;

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * The bounding box of one stroke, or null if it is not a usable mark.
 *
 * Returns null — never throws — for an eraser, for anything malformed, and for
 * a stroke too small to have been meant. A single bad row in a JSON blob must
 * not take a lecture's whole reading down with it.
 */
export function boxOfStroke(stroke: unknown): { box: Box; tool: MarkTool; points: number } | null {
  if (!stroke || typeof stroke !== "object") return null;
  const s = stroke as Partial<Stroke>;
  // An eraser removes ink. It is not the student pointing at anything.
  if (s.mode !== "pen" && s.mode !== "highlighter") return null;
  if (!Array.isArray(s.points) || s.points.length === 0) return null;

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  let seen = 0;
  for (const p of s.points) {
    if (!p || typeof p !== "object") continue;
    const { x, y } = p as { x?: unknown; y?: unknown };
    if (!finite(x) || !finite(y)) continue;
    // Points are normalised; anything outside the page is corrupt, not clever.
    if (x < -0.5 || x > 1.5 || y < -0.5 || y > 1.5) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    seen++;
  }
  if (seen === 0) return null;
  if (Math.max(x1 - x0, y1 - y0) < MIN_MARK_SPAN) return null;

  return { box: { x0, y0, x1, y1 }, tool: s.mode, points: seen };
}

/** Every usable mark on one page. Malformed strokes are skipped, silently and safely. */
export function marksFromStrokes(page: number, strokes: unknown): Mark[] {
  if (!Array.isArray(strokes)) return [];
  const marks: Mark[] = [];
  for (const stroke of strokes) {
    const got = boxOfStroke(stroke);
    if (got) marks.push({ page, tool: got.tool, box: got.box, points: got.points });
  }
  return marks;
}

/**
 * A pdf.js text item, converted into annotation space.
 *
 * This is the flip: PDF y counts up from the bottom, ink y counts down from the
 * top. `transform[5]` is the baseline, so the glyph box runs from the baseline
 * up by `height` — which, once flipped, becomes the TOP edge.
 */
export function textBoxFrom(item: TextItemLike, pageWidth: number, pageHeight: number): TextBox | null {
  if (!item || typeof item.str !== "string" || item.str.trim() === "") return null;
  if (!finite(pageWidth) || !finite(pageHeight) || pageWidth <= 0 || pageHeight <= 0) return null;
  const t = item.transform;
  if (!Array.isArray(t) || !finite(t[4]) || !finite(t[5])) return null;
  const w = finite(item.width) ? item.width : 0;
  const h = finite(item.height) && item.height > 0 ? item.height : 0;

  const x0 = t[4] / pageWidth;
  const x1 = (t[4] + w) / pageWidth;
  const baseline = t[5];
  const y1 = 1 - baseline / pageHeight;            // bottom edge, flipped
  const y0 = 1 - (baseline + h) / pageHeight;      // top edge, flipped

  return { text: item.str, x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1) };
}

function overlaps(a: Box, b: Box, tolerance = COVER_TOLERANCE): boolean {
  return (
    a.x0 - tolerance <= b.x1 &&
    a.x1 + tolerance >= b.x0 &&
    a.y0 - tolerance <= b.y1 &&
    a.y1 + tolerance >= b.y0
  );
}

/**
 * How big a horizontal gap between two runs is a real space.
 *
 * The same problem `src/lib/pdf-text.ts` solves for extraction, in normalised
 * units: a PDF splits text wherever it likes, so joining every run with a space
 * turns "Part (6)/Chapter [23, 26, 27]" into "Part ( 6 )/Chapter [ 23 , 26 , 27".
 * Quoting a student's own highlight back to them mangled is worse here than in
 * a search index, because they will read it.
 */
export const RUN_GAP_SPACE = 0.004;

/** The lecture's own words that sit under a mark, in reading order. */
export function textUnder(box: Box, boxes: TextBox[]): string[] {
  const covered = boxes
    .filter((t) => overlaps(box, t))
    .sort((a, b) => (Math.abs(a.y0 - b.y0) > 0.01 ? a.y0 - b.y0 : a.x0 - b.x0));
  return joinRuns(covered);
}

/**
 * Stitch covered runs back into readable lines.
 *
 * Runs on the same line are joined by geometry — no space where the PDF had
 * none — and a new line starts its own string, so a mark spanning two lines
 * comes back as two quotable pieces rather than one run-on.
 */
export function joinRuns(covered: TextBox[]): string[] {
  const out: string[] = [];
  let line = "";
  let prev: TextBox | null = null;

  for (const t of covered) {
    const text = t.text;
    if (text.trim() === "") continue;
    if (!prev) {
      line = text;
    } else if (Math.abs(t.y0 - prev.y0) > 0.01) {
      // A different line: close the last one and begin again.
      if (line.trim()) out.push(line.trim());
      line = text;
    } else if (/\s$/.test(line) || /^\s/.test(text) || t.x0 - prev.x1 > RUN_GAP_SPACE) {
      line += /\s$/.test(line) || /^\s/.test(text) ? text : ` ${text}`;
    } else {
      line += text;
    }
    prev = t;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

/**
 * Where on the page, in words, for a mark with nothing written under it.
 *
 * A circle round a diagram or an arrow on an X-ray is still the student
 * pointing — and "the upper-left of the page" is something the model can
 * match against an image it is already looking at, where a pair of decimals
 * is not.
 */
export function describeRegion(box: Box): string {
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const row = cy < 0.34 ? "top" : cy > 0.66 ? "bottom" : "middle";
  const col = cx < 0.34 ? "left" : cx > 0.66 ? "right" : "centre";
  if (row === "middle" && col === "centre") return "the centre of the page";
  if (row === "middle") return `the ${col} of the page`;
  if (col === "centre") return `the ${row} of the page`;
  return `the ${row}-${col} of the page`;
}

export type ResolvedMark = Mark & { covers: string[]; where: string };

/** Resolve one page's marks against that page's text. */
export function resolveMarks(marks: Mark[], boxes: TextBox[]): ResolvedMark[] {
  return marks.map((m) => ({ ...m, covers: textUnder(m.box, boxes), where: describeRegion(m.box) }));
}

/**
 * The block handed to the model.
 *
 * Every line says whose judgement it is. The student's marks are reported as
 * the student's attention and nothing more: a highlight over a number is not
 * evidence the number is right, and a model told "PaCO2 > 45 mmHg" without
 * that framing will cheerfully treat a student's marker pen as a citation.
 *
 * Empty in, empty out — a lecture with no marks adds nothing to the prompt
 * rather than a paragraph explaining that there is nothing to say.
 */
export function buildAnnotationNote(resolved: ResolvedMark[]): string {
  if (resolved.length === 0) return "";

  const byPage = new Map<number, ResolvedMark[]>();
  for (const m of resolved) {
    const list = byPage.get(m.page);
    if (list) list.push(m);
    else byPage.set(m.page, [m]);
  }

  const lines: string[] = [
    "WHAT THE STUDENT MARKED ON THIS LECTURE, IN THEIR OWN HAND.",
    "This is the student's attention, not the lecture's content and not a statement of fact:",
    "a mark means they singled something out, never that it is correct or important to anyone else.",
    "",
  ];

  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const marks = byPage.get(page)!;
    lines.push(`Page ${page}:`);
    for (const m of marks.slice(0, MAX_MARKS_PER_PAGE)) {
      const verb = m.tool === "highlighter" ? "highlighted" : "drew over";
      lines.push(
        m.covers.length > 0
          ? `  - ${verb}: "${m.covers.join(" ").slice(0, 240)}"`
          : `  - ${verb} ${m.where} (nothing written there — a diagram, an image, or their own note)`
      );
    }
    const extra = marks.length - MAX_MARKS_PER_PAGE;
    if (extra > 0) lines.push(`  - and ${extra} more mark${extra === 1 ? "" : "s"} on this page`);
  }

  return lines.join("\n");
}
