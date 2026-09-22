/**
 * The ink engine, checked without a tablet.
 *
 * Handwriting is the hardest thing in this app to verify by looking, because
 * every fault in it is a small one that only shows up under a real stylus: a
 * line that is very slightly uniform, a stroke that drops one sample in eight, a
 * palm that draws. All of those are arithmetic, and arithmetic can be asserted.
 *
 * Every case below is a bug the first version actually had.
 *
 * Run: npx tsx scripts/verify-ink.ts
 */

import {
  dedupe,
  detectsPressure,
  ERASER_WIDTH_MULTIPLIER,
  HIGHLIGHTER_ALPHA,
  NEUTRAL_PRESSURE,
  redoSurvives,
  shouldRejectPointer,
  smoothTail,
  strokeSegments,
  widthFor,
  type InkPoint,
  type Stroke,
} from "../src/lib/ink";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) {
    failures++;
    console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

console.log("Ink engine\n");

// --- pressure ---------------------------------------------------------------
// The original bug: every stroke was one width because pressure was never read.
{
  const light = widthFor(4, 0.1, true);
  const heavy = widthFor(4, 0.95, true);
  check("a hard press is wider than a light one", heavy > light, `${heavy} vs ${light}`);
  check("pressure actually changes the nib", heavy / light > 1.5, `ratio ${(heavy / light).toFixed(2)}`);

  // But a light touch must never vanish: a stroke that tapers to zero reads as
  // a rendering failure, and fast strokes report near-zero pressure at the tail.
  check("a near-zero reading still draws", widthFor(4, 0, true) > 0.5, `${widthFor(4, 0, true)}`);

  // A mouse has no pressure sensor. Chrome reports a constant 0.5 while held
  // and 0 otherwise; modulating by that would make every mouse stroke start
  // with a dot.
  check("no sensor means no modulation", widthFor(4, 0, false) === 4);
  check("no sensor ignores the reading entirely", widthFor(4, 1, false) === 4);
}

// A stylus that reports the same number for every sample is not measuring
// anything, and modulating by a constant is a slow way to draw a flat line.
{
  check("a varying pen is trusted", detectsPressure("pen", [0.2, 0.5, 0.9]));
  check("a flat pen is not", !detectsPressure("pen", [0.5, 0.5, 0.5, 0.5]));
  check("a mouse is never trusted", !detectsPressure("mouse", [0.1, 0.9]));
  check("a finger is never trusted", !detectsPressure("touch", [0.1, 0.9]));
}

// --- palm rejection ---------------------------------------------------------
// The original bug: pointerType was never looked at, so a resting hand drew.
{
  check("a palm is ignored once a stylus is in use", shouldRejectPointer("touch", true));
  check("a finger still draws when there is no stylus", !shouldRejectPointer("touch", false));
  check("the stylus itself is never rejected", !shouldRejectPointer("pen", true));
  check("a mouse is never rejected", !shouldRejectPointer("mouse", true));
}

// --- resolution -------------------------------------------------------------
// The original bug: the canvas was sized in CSS pixels, so on any retina screen
// the slide AND the ink rendered at half resolution.
{
  const stroke: Stroke = {
    mode: "pen",
    color: "#000",
    width: 4,
    points: [
      { x: 0, y: 0, p: 0.5 },
      { x: 1, y: 1, p: 0.5 },
    ],
  };
  const at1x = strokeSegments(stroke, 900, 600, 1, true);
  const at2x = strokeSegments(stroke, 1800, 1200, 2, true);
  check("geometry scales with the canvas", at2x[0].to.x === at1x[0].to.x * 2);
  check("the nib scales with the canvas too", at2x[0].width === at1x[0].width * 2,
    `1x ${at1x[0].width}, 2x ${at2x[0].width} — a nib that does not scale is half as thick on a tablet`);
}

// --- backwards compatibility ------------------------------------------------
// Annotations saved before pressure existed have points with no `p`. They must
// still render, and render at a sensible weight.
{
  const old: Stroke = {
    mode: "pen",
    color: "#000",
    width: 4,
    points: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }] as InkPoint[],
  };
  const segs = strokeSegments(old, 100, 100, 1, true);
  check("a stroke with no pressure data still draws", segs.length === 1);
  check(
    "and draws at the neutral weight",
    Math.abs(segs[0].width - widthFor(4, NEUTRAL_PRESSURE, true)) < 1e-9,
    `${segs[0].width}`
  );
}

// --- highlighter ------------------------------------------------------------
{
  const hl: Stroke = {
    mode: "highlighter",
    color: "#ff0",
    width: 12,
    points: [{ x: 0, y: 0, p: 0.1 }, { x: 1, y: 0, p: 0.9 }],
  };
  const segs = strokeSegments(hl, 100, 100, 1, true);
  check("a highlighter is a flat marker, not a nib", segs[0].width === 12,
    `got ${segs[0].width} — pressure must not modulate a highlighter`);
  check("and sits under the text", HIGHLIGHTER_ALPHA > 0 && HIGHLIGHTER_ALPHA < 0.6);

  // The flat-nib branch needs its own device-pixel check: it does not go
  // through widthFor, so scaling the pen correctly says nothing about it. A
  // mutation that dropped `* dpr` here passed every other assertion in this
  // file, which is the whole reason this one exists.
  const hl2x = strokeSegments(hl, 200, 200, 2, true);
  check("a highlighter scales with device pixels too", hl2x[0].width === 24,
    `got ${hl2x[0].width} at dpr 2 — expected 24`);

  // Same for the eraser, which is the other flat nib.
  const er: Stroke = {
    mode: "eraser",
    color: "#000",
    width: 18,
    points: [{ x: 0, y: 0, p: 0.2 }, { x: 1, y: 0, p: 0.9 }],
  };
  check("an eraser is flat too", strokeSegments(er, 100, 100, 1, true)[0].width === 18);
  check("and scales with device pixels", strokeSegments(er, 200, 200, 2, true)[0].width === 36);
}

// --- the eraser -------------------------------------------------------------
// The original bug: destination-out at alpha 0.85 removed 85% of the ink and
// left a ghost, and the ghost could be ghosted again, forever.
{
  check("the eraser nib is much wider than the pen", ERASER_WIDTH_MULTIPLIER >= 4);
}

// --- sampling ---------------------------------------------------------------
{
  // Coalesced events include many samples inside one pixel at a slow hand speed.
  const noisy: InkPoint[] = [
    { x: 0.5, y: 0.5 },
    { x: 0.50001, y: 0.50001 },
    { x: 0.50002, y: 0.5 },
    { x: 0.7, y: 0.7 },
  ];
  const kept = dedupe(noisy);
  check("samples inside one pixel collapse", kept.length === 2, `kept ${kept.length}`);
  check("the real movement survives", kept[kept.length - 1].x === 0.7);

  // A tap is a dot, and a dot must keep its point.
  const tap = dedupe([{ x: 0.5, y: 0.5 }]);
  check("a single tap is preserved", tap.length === 1);
}

{
  // Smoothing removes digitiser jitter, but must never move ink that has
  // already been laid down — a line that reshapes behind your hand is far worse
  // than a slightly rough one.
  const pts: InkPoint[] = Array.from({ length: 10 }, (_, i) => ({ x: i / 10, y: 0 }));
  const smoothed = smoothTail(pts, 3);
  check("smoothing keeps the point count", smoothed.length === pts.length);
  const committed = pts.length - 3;
  let moved = false;
  for (let i = 0; i < committed; i++) {
    if (smoothed[i].x !== pts[i].x || smoothed[i].y !== pts[i].y) moved = true;
  }
  check("committed ink never moves", !moved, "only the live tail may be adjusted");
  check(
    "pressure survives smoothing",
    smoothTail([{ x: 0, y: 0, p: 0.2 }, { x: 1, y: 1, p: 0.8 }, { x: 2, y: 2, p: 0.4 }, { x: 3, y: 3, p: 0.9 }], 3)
      .every((p) => p.p !== undefined)
  );
}

// --- undo / redo ------------------------------------------------------------
{
  check("undo keeps the redo stack", redoSurvives("undo"));
  check("redo keeps the redo stack", redoSurvives("redo"));
  check("drawing discards it", !redoSurvives("draw"));
}

if (failures) {
  console.error(`\n${failures} failing check(s).`);
  process.exit(1);
}
console.log(
  "  Pressure modulates the nib and a light touch still draws; a flat stylus is\n" +
    "  treated as pressureless; a palm is ignored once a stylus is in use; geometry\n" +
    "  and nib both scale with device pixels; strokes saved before pressure existed\n" +
    "  still render; committed ink never moves under the hand."
);
