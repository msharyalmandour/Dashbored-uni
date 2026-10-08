/**
 * A lecture's summary, and the diagram drawn from it.
 *
 * The owner asked for "ملخص ومع صور بياني". The reason this file exists is the
 * split described in src/lib/summary.ts: the model gives the sequence and the
 * code gives the geometry, so what is tested here is the half that can be
 * tested — where the boxes land, and what is refused before anything is drawn.
 *
 * The fixture is his own lecture: Mechanical Ventilator, 51 pages, in his
 * account.
 */
import assert from "node:assert/strict";
import {
  problemsWith,
  isSound,
  describeProblem,
  layout,
  MAX_STEP_LABEL,
  MAX_CHAIN,
  MAX_POINTS,
  type Summary,
} from "../src/lib/summary";

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log("A lecture's summary and its diagram");
console.log("");

/** Mechanical Ventilation, as a summary of it would actually read. */
const MV: Summary = {
  idea: "الجهاز يتنفس عن المريض أو يساعده لما رئته ما تقدر تكفي نفسها. الفكرة إنه يدفع الهواء بضغط بدل ما الصدر يسحبه.",
  chain: [
    { label: "فشل تنفسي" },
    { label: "نقص أكسجين" },
    { label: "تنفس صناعي" },
    { label: "فصل تدريجي" },
  ],
  points: [
    { heading: "ليش الجهاز", body: "يزيد التهوية ويقلل جهد التنفس" },
    { heading: "سالب وموجب", body: "السالب يسحب، الموجب يدفع — والمستخدم اليوم الموجب" },
    { heading: "المود", body: "يحدد مين يبدأ النفس ومين يتحكم فيه" },
  ],
};

check("a real summary reads as sound", () => {
  assert.deepEqual(problemsWith(MV), []);
});

/* ── What is refused before anything is drawn ─────────────────────────────── */

check("a chain of one step is refused rather than drawn", () => {
  /* THE RULE WORTH STATING. A diagram of a single box teaches nothing and
     occupies the space of something that would. */
  const one: Summary = { ...MV, chain: [{ label: "فشل تنفسي" }] };
  const problems = problemsWith(one);
  assert.ok(problems.some((p) => p.kind === "CHAIN_TOO_SHORT"));
  assert.match(describeProblem(problems[0]), /not a sequence/);
});

check("NO chain at all is allowed, and gets no diagram", () => {
  /* A lecture that is a list of drug classes is not a sequence, and inventing
     an arrow between two of them is a claim the lecture never made. */
  const listy: Summary = { ...MV, chain: [] };
  assert.ok(isSound(listy), "an empty chain must be a valid summary");
  const d = layout(listy.chain, 800);
  assert.equal(d.boxes.length, 0);
  assert.equal(d.width, 0);
  assert.equal(d.height, 0);
});

check("a step too long to fit its box is refused", () => {
  const wordy: Summary = {
    ...MV,
    chain: [{ label: "x".repeat(MAX_STEP_LABEL + 1) }, { label: "ok" }],
  };
  const problems = problemsWith(wordy);
  assert.ok(problems.some((p) => p.kind === "STEP_TOO_LONG"));
  assert.match(describeProblem(problems.find((p) => p.kind === "STEP_TOO_LONG")!), /fit its box/);
});

check("a repeated step is caught, because the drawing would imply a cycle", () => {
  const looped: Summary = {
    ...MV,
    chain: [{ label: "A" }, { label: "B" }, { label: "a" }],
  };
  assert.ok(problemsWith(looped).some((p) => p.kind === "STEP_REPEATED"));
});

check("a chain longer than a student reads is refused", () => {
  const long: Summary = {
    ...MV,
    chain: Array.from({ length: MAX_CHAIN + 1 }, (_, i) => ({ label: `s${i}` })),
  };
  assert.ok(problemsWith(long).some((p) => p.kind === "CHAIN_TOO_LONG"));
});

check("an idea that is the lecture again is refused", () => {
  assert.ok(problemsWith({ ...MV, idea: "x".repeat(401) }).some((p) => p.kind === "IDEA_TOO_LONG"));
  assert.ok(problemsWith({ ...MV, idea: "   " }).some((p) => p.kind === "NO_IDEA"));
});

check("a point with a heading and no body is refused", () => {
  const half: Summary = { ...MV, points: [{ heading: "ليش الجهاز", body: "  " }] };
  assert.ok(problemsWith(half).some((p) => p.kind === "EMPTY_POINT"));
});

check("no points at all is refused", () => {
  assert.ok(problemsWith({ ...MV, points: [] }).some((p) => p.kind === "NO_POINTS"));
  assert.ok(
    problemsWith({
      ...MV,
      points: Array.from({ length: MAX_POINTS + 1 }, () => ({ heading: "h", body: "b" })),
    }).some((p) => p.kind === "TOO_MANY_POINTS")
  );
});

/* ── THE GEOMETRY ─────────────────────────────────────────────────────────── */

check("on a wide screen the chain is a row, in order", () => {
  const d = layout(MV.chain, 1200);
  assert.equal(d.stacked, false);
  assert.equal(d.boxes.length, 4);
  assert.deepEqual(
    d.boxes.map((b) => b.label),
    ["فشل تنفسي", "نقص أكسجين", "تنفس صناعي", "فصل تدريجي"],
    "the order is the causation and must survive layout"
  );
  // Left to right, never overlapping.
  for (let i = 0; i < d.boxes.length - 1; i += 1) {
    assert.ok(
      d.boxes[i].x + d.boxes[i].width <= d.boxes[i + 1].x,
      `box ${i} overlaps box ${i + 1}`
    );
  }
});

check("ON A PHONE IT STACKS RATHER THAN CLIPPING", () => {
  /* The two ways to pretend a four-step chain fits in 400px are both failures
     a diff cannot see: shrink the boxes until the Arabic is unreadable, or let
     the row run off the edge where the last step simply is not there. */
  const d = layout(MV.chain, 400);
  assert.equal(d.stacked, true, "it must become a column");
  assert.equal(d.boxes.length, 4, "no step may be dropped");
  assert.ok(d.width <= 400, `the drawing is ${d.width}px wide in 400px`);
  // Top to bottom, never overlapping.
  for (let i = 0; i < d.boxes.length - 1; i += 1) {
    assert.ok(
      d.boxes[i].y + d.boxes[i].height <= d.boxes[i + 1].y,
      `box ${i} overlaps box ${i + 1} vertically`
    );
  }
});

check("nothing is ever drawn outside the viewBox", () => {
  /* The failure this catches is the classic one for a generated drawing: a
     label or an arrowhead a few pixels past the edge, invisible in review and
     clipped in the browser. */
  for (const width of [320, 400, 768, 1200]) {
    const d = layout(MV.chain, width);
    for (const b of d.boxes) {
      assert.ok(b.x >= 0 && b.y >= 0, `box starts off-canvas at ${width}px`);
      assert.ok(b.x + b.width <= d.width, `box runs past the right edge at ${width}px`);
      assert.ok(b.y + b.height <= d.height, `box runs past the bottom at ${width}px`);
    }
    for (const a of d.arrows) {
      for (const [x, y] of [[a.x1, a.y1], [a.x2, a.y2]]) {
        assert.ok(x >= 0 && x <= d.width, `arrow leaves the canvas sideways at ${width}px`);
        assert.ok(y >= 0 && y <= d.height, `arrow leaves the canvas vertically at ${width}px`);
      }
    }
  }
});

check("there is exactly one arrow between each pair, and it touches neither box", () => {
  for (const width of [400, 1200]) {
    const d = layout(MV.chain, width);
    assert.equal(d.arrows.length, d.boxes.length - 1, `wrong arrow count at ${width}px`);
    for (let i = 0; i < d.arrows.length; i += 1) {
      const a = d.arrows[i];
      const from = d.boxes[i];
      const to = d.boxes[i + 1];
      if (d.stacked) {
        assert.ok(a.y1 >= from.y + from.height, "the arrow starts inside the box above");
        assert.ok(a.y2 <= to.y, "the arrow ends inside the box below");
      } else {
        assert.ok(a.x1 >= from.x + from.width, "the arrow starts inside the box before");
        assert.ok(a.x2 <= to.x, "the arrow ends inside the box after");
      }
    }
  }
});

check("a long label widens its box but never past the maximum", () => {
  const d = layout(
    [{ label: "x".repeat(MAX_STEP_LABEL) }, { label: "y" }],
    4000
  );
  const wide = d.boxes[0];
  const narrow = d.boxes[1];
  assert.ok(wide.width > narrow.width, "a longer label must get a wider box");
  assert.ok(wide.width <= 190, `a box grew to ${wide.width}px`);
});

check("two steps is the smallest chain that draws", () => {
  const d = layout([{ label: "A" }, { label: "B" }], 1200);
  assert.equal(d.boxes.length, 2);
  assert.equal(d.arrows.length, 1);
});

console.log("");
console.log(failures === 0 ? "The model gives the steps; the code draws the picture." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
