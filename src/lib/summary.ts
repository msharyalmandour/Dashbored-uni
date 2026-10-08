/**
 * A lecture's summary: the idea, the chain, and what you must know.
 *
 * ── THE SPLIT THAT MATTERS ──────────────────────────────────────────────────
 *
 * The owner asked for "ملخص ومع صور بياني" — a summary with a diagram. The
 * temptation is to have the model draw it, and that is the wrong half to hand
 * over: a model asked for SVG produces paths that overlap their own labels,
 * fall outside the viewBox, or carry text in a colour the dark theme eats, and
 * none of that is visible in a diff.
 *
 * So the work is divided at the one line where each side is reliable:
 *
 *   THE MODEL gives the SEQUENCE — short labels, in order. It is reading a
 *     lecture, which is the thing it is good at.
 *   THIS FILE gives the GEOMETRY — where each box sits, how wide, where the
 *     arrow goes. It is arithmetic, which is the thing code is good at.
 *
 * A diagram is then a function of the data, so it cannot be subtly wrong: if
 * the steps are right the picture is right, and if the steps are wrong the
 * student reads wrong words rather than looking at a broken drawing.
 *
 * ── WHY A CHAIN AND NOT A CHART ─────────────────────────────────────────────
 *
 * A bar or line chart needs numbers, and a nursing lecture has almost none —
 * what it has is causation: low oxygen leads to breathlessness leads to
 * ventilation. Measured against his own material: of 33 documents, the ones
 * carrying percentages carry them as GRADE WEIGHTS in a syllabus, not as data
 * to plot. So the honest diagram for this subject is a sequence, which is also
 * exactly what his own study apps draw (`chain` in both of them).
 */

/* ────────────────────────────────────────────────────────────────────────────
   The shape
   ──────────────────────────────────────────────────────────────────────────── */

/** One link in the chain. Short on purpose — it has to fit in a box. */
export interface Step {
  /** The state or event, in the lecture's own words. */
  label: string;
}

/** One thing the student must know, as a heading and a line. */
export interface Point {
  heading: string;
  body: string;
}

export interface Summary {
  /** The whole lecture in a few lines. */
  idea: string;
  /** Cause to effect, in order. Empty when the lecture is not a sequence. */
  chain: Step[];
  points: Point[];
}

/** The longest a step label may be and still read inside its box. */
export const MAX_STEP_LABEL = 40;
/** Below two, a chain is a statement; above seven it stops being readable. */
export const MIN_CHAIN = 2;
export const MAX_CHAIN = 7;
export const MAX_POINTS = 7;

export type SummaryProblem =
  | { kind: "NO_IDEA" }
  | { kind: "IDEA_TOO_LONG"; chars: number }
  | { kind: "NO_POINTS" }
  | { kind: "TOO_MANY_POINTS"; count: number }
  | { kind: "EMPTY_POINT"; index: number }
  | { kind: "CHAIN_TOO_SHORT"; count: number }
  | { kind: "CHAIN_TOO_LONG"; count: number }
  | { kind: "STEP_TOO_LONG"; index: number; chars: number }
  | { kind: "EMPTY_STEP"; index: number }
  | { kind: "STEP_REPEATED"; label: string };

/** The idea is a summary, not an essay. Three lines, generously measured. */
const MAX_IDEA = 400;

/**
 * Everything wrong with a proposed summary, or an empty list.
 *
 * A one-step chain is refused rather than drawn, and that is the rule worth
 * stating: a diagram of a single box teaches nothing and takes the space of
 * something that would. A lecture that is not a sequence passes an EMPTY chain
 * and gets no diagram, which is a correct outcome — "this lecture is a list of
 * drug classes" is a real answer, and inventing an arrow between two of them
 * would be a claim the lecture never made.
 */
export function problemsWith(summary: Summary): SummaryProblem[] {
  const problems: SummaryProblem[] = [];

  const idea = summary.idea.trim();
  if (idea === "") problems.push({ kind: "NO_IDEA" });
  else if (idea.length > MAX_IDEA) problems.push({ kind: "IDEA_TOO_LONG", chars: idea.length });

  if (summary.points.length === 0) problems.push({ kind: "NO_POINTS" });
  if (summary.points.length > MAX_POINTS) {
    problems.push({ kind: "TOO_MANY_POINTS", count: summary.points.length });
  }
  summary.points.forEach((p, i) => {
    if (p.heading.trim() === "" || p.body.trim() === "") {
      problems.push({ kind: "EMPTY_POINT", index: i });
    }
  });

  // An absent chain is allowed. A broken one is not.
  if (summary.chain.length > 0) {
    if (summary.chain.length < MIN_CHAIN) {
      problems.push({ kind: "CHAIN_TOO_SHORT", count: summary.chain.length });
    }
    if (summary.chain.length > MAX_CHAIN) {
      problems.push({ kind: "CHAIN_TOO_LONG", count: summary.chain.length });
    }
    summary.chain.forEach((s, i) => {
      const label = s.label.trim();
      if (label === "") problems.push({ kind: "EMPTY_STEP", index: i });
      else if (label.length > MAX_STEP_LABEL) {
        problems.push({ kind: "STEP_TOO_LONG", index: i, chars: label.length });
      }
    });

    /* The same label twice means the model looped rather than read. Caught
       here because the drawing would render it as a cycle that is not one. */
    const seen = new Set<string>();
    for (const s of summary.chain) {
      const key = s.label.trim().toLowerCase();
      if (key !== "" && seen.has(key)) problems.push({ kind: "STEP_REPEATED", label: s.label });
      seen.add(key);
    }
  }

  return problems;
}

export function isSound(summary: Summary): boolean {
  return problemsWith(summary).length === 0;
}

/** Each problem as a line the orb can act on, not a code it cannot. */
export function describeProblem(p: SummaryProblem): string {
  switch (p.kind) {
    case "NO_IDEA":
      return "The summary has no idea line. Say what the whole lecture is about, in two or three sentences.";
    case "IDEA_TOO_LONG":
      return `The idea is ${p.chars} characters. Keep it under ${MAX_IDEA} — it is a summary, not the lecture again.`;
    case "NO_POINTS":
      return "No key points. Give between one and " + MAX_POINTS + " things the student must know.";
    case "TOO_MANY_POINTS":
      return `${p.count} key points is more than a student reads. Keep the ${MAX_POINTS} that matter most.`;
    case "EMPTY_POINT":
      return `Key point ${p.index + 1} is missing its heading or its body. Both are required.`;
    case "CHAIN_TOO_SHORT":
      return "A chain of one step is not a sequence. Either give at least two steps, or leave the chain empty — a lecture that is not a sequence should not be drawn as one.";
    case "CHAIN_TOO_LONG":
      return `${p.count} steps will not be read. Keep the ${MAX_CHAIN} that carry the causation.`;
    case "STEP_TOO_LONG":
      return `Step ${p.index + 1} is ${p.chars} characters and will not fit its box. Keep each step under ${MAX_STEP_LABEL} — a state or an event, not a sentence.`;
    case "EMPTY_STEP":
      return `Step ${p.index + 1} is empty.`;
    case "STEP_REPEATED":
      return `"${p.label}" appears twice in the chain. Read the sequence again rather than looping.`;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   The geometry
   ──────────────────────────────────────────────────────────────────────────── */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface Arrow {
  /** Start and end of the shaft, already clear of both boxes. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Drawing {
  width: number;
  height: number;
  boxes: Box[];
  arrows: Arrow[];
  /** True when the chain was laid out in a column because it did not fit. */
  stacked: boolean;
}

const BOX_H = 56;
const GAP = 44;
const PAD = 8;
/** Roughly the width of one character at the size the label is drawn. */
const CHAR_W = 7.4;
const MIN_BOX_W = 96;
const MAX_BOX_W = 190;

function boxWidth(label: string): number {
  const wanted = label.trim().length * CHAR_W + 24;
  return Math.max(MIN_BOX_W, Math.min(MAX_BOX_W, Math.round(wanted)));
}

/**
 * Where every box and arrow goes, for a given available width.
 *
 * STACKS RATHER THAN CLIPS. A four-step chain at 400px — a phone — does not
 * fit in a row, and the two ways to pretend it does are both failures a diff
 * cannot see: shrink the boxes until the Arabic inside them is unreadable, or
 * let the row run past the edge where the last step is simply not there. So
 * past the available width it becomes a column, which is longer and complete.
 *
 * Returns a drawing of zero boxes for an empty chain rather than throwing: a
 * lecture with no sequence is the ordinary case, not an error, and the caller
 * draws nothing.
 */
export function layout(chain: Step[], availableWidth: number): Drawing {
  if (chain.length === 0) {
    return { width: 0, height: 0, boxes: [], arrows: [], stacked: false };
  }

  const widths = chain.map((s) => boxWidth(s.label));
  const rowWidth = widths.reduce((sum, w) => sum + w, 0) + GAP * (chain.length - 1) + PAD * 2;

  if (rowWidth <= availableWidth) {
    const boxes: Box[] = [];
    let x = PAD;
    for (let i = 0; i < chain.length; i += 1) {
      boxes.push({ x, y: PAD, width: widths[i], height: BOX_H, label: chain[i].label.trim() });
      x += widths[i] + GAP;
    }
    const arrows: Arrow[] = [];
    for (let i = 0; i < boxes.length - 1; i += 1) {
      const from = boxes[i];
      const to = boxes[i + 1];
      arrows.push({
        x1: from.x + from.width,
        y1: PAD + BOX_H / 2,
        x2: to.x,
        y2: PAD + BOX_H / 2,
      });
    }
    return { width: rowWidth, height: BOX_H + PAD * 2, boxes, arrows, stacked: false };
  }

  // A column. Every box the same width, so the arrows are one straight line.
  const colWidth = Math.max(MIN_BOX_W, Math.min(MAX_BOX_W, availableWidth - PAD * 2));
  const boxes: Box[] = [];
  let y = PAD;
  for (let i = 0; i < chain.length; i += 1) {
    boxes.push({ x: PAD, y, width: colWidth, height: BOX_H, label: chain[i].label.trim() });
    y += BOX_H + GAP;
  }
  const arrows: Arrow[] = [];
  for (let i = 0; i < boxes.length - 1; i += 1) {
    const centre = PAD + colWidth / 2;
    arrows.push({
      x1: centre,
      y1: boxes[i].y + BOX_H,
      x2: centre,
      y2: boxes[i + 1].y,
    });
  }
  return {
    width: colWidth + PAD * 2,
    height: y - GAP + PAD,
    boxes,
    arrows,
    stacked: true,
  };
}
