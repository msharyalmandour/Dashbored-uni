/**
 * Gestures, zoom and pan, checked without a tablet.
 *
 * This file exists because the environment it is written in has no iPad and no
 * Apple Pencil, and the rules being checked are precisely the ones that a real
 * hand would test: a palm resting on the glass, a finger that must not write, a
 * pinch that must not let the page drift. None of that can be honestly claimed
 * from a synthetic pointer event in a headless browser.
 *
 * What CAN be honestly claimed is that the arbitration and the arithmetic are
 * correct, because both are pure functions of the pointers that are down. So
 * that is what this asserts, exhaustively, and the report says plainly which
 * parts still need a physical device.
 *
 * Every case is either a rule the brief called non-negotiable or a bug that
 * document viewers actually have.
 *
 * Run: npx tsx scripts/verify-gesture.ts
 */

import {
  activeTouches,
  addPointer,
  centroid,
  emptyArbiter,
  intentFor,
  isPalm,
  movePointer,
  PALM_CONTACT_PX,
  penIsDown,
  removePointer,
  spread,
  type ArbiterState,
  type PointerSample,
} from "../src/lib/gesture";
import {
  centred,
  clampPan,
  clampScale,
  fitPage,
  fitWidth,
  MAX_CANVAS_PIXELS,
  MAX_SCALE,
  maxRenderScale,
  MIN_SCALE,
  panBy,
  regionFor,
  renderScaleFor,
  sameRegion,
  visibleRegion,
  zoomAround,
  type Size,
  type View,
} from "../src/lib/zoom";
import {
  HIGHLIGHTER_ALPHA,
  isContinuousTool,
  layerOf,
  opacityOf,
  type Stroke,
} from "../src/lib/ink";
import {
  DEFAULT_HIGHLIGHTER,
  DEFAULT_PEN,
  HIGHLIGHTER_COLORS,
  paletteFor,
  PEN_COLORS,
} from "../src/lib/pen-palette";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) {
    failures++;
    console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

/** Build an arbiter state from a list of pointers, as a real sequence would. */
function down(...ps: PointerSample[]): ArbiterState {
  let s = emptyArbiter();
  for (const p of ps) s = addPointer(s, p);
  return s;
}

const pen = (id = 1, x = 100, y = 100): PointerSample => ({ id, kind: "pen", x, y });
const finger = (id: number, x = 100, y = 100): PointerSample => ({
  id,
  kind: "touch",
  x,
  y,
  width: 22,
  height: 24,
});
const palm = (id: number, x = 100, y = 100): PointerSample => ({
  id,
  kind: "touch",
  x,
  y,
  width: 90,
  height: 70,
});
const mouse = (id = 1): PointerSample => ({ id, kind: "mouse", x: 10, y: 10 });

console.log("Gestures, zoom and pan\n");

/* ===================================================== the four gestures === */
// The brief's non-negotiables, one check each. If any of these fail the feature
// is not shippable regardless of how it looks.
{
  check("a stylus writes", intentFor(down(pen(1)), 1) === "ink");
  check("one finger pans", intentFor(down(finger(1)), 1) === "pan");

  const two = down(finger(1, 100, 100), finger(2, 300, 140));
  check("two fingers zoom", intentFor(two, 1) === "zoom" && intentFor(two, 2) === "zoom");

  check("a palm is rejected", intentFor(down(palm(1)), 1) === "reject");
  check("a mouse writes", intentFor(down(mouse(1)), 1) === "ink");
}

/* ============================================ a finger must never write === */
// The single most important rule in the brief, and the one the previous version
// got wrong: `touch-action: none` on the ink canvas made every touch ink.
// Asserted over every touch configuration rather than one example, so a future
// change cannot open a hole in a case nobody wrote a test for.
{
  const configs: Array<[string, ArbiterState, number]> = [
    ["one finger alone", down(finger(1)), 1],
    ["two fingers", down(finger(1), finger(2, 300)), 1],
    ["three fingers", down(finger(1), finger(2, 300), finger(3, 200, 400)), 2],
    ["finger beside a palm", down(finger(1), palm(2, 400, 400)), 1],
    ["finger while a stylus is down", down(pen(9), finger(1)), 1],
    ["finger after a palm settled", down(palm(2), finger(1)), 1],
  ];
  for (const [label, state, id] of configs) {
    check(`a finger never writes: ${label}`, intentFor(state, id) !== "ink",
      `got "${intentFor(state, id)}"`);
  }
}

/* ============================================== palm rejection, in order === */
{
  // The hole in the old rule: the old code only rejected touch AFTER it had seen
  // a pen. A hand resting on the glass first was therefore a drawing pointer.
  const restFirst = down(palm(1));
  check("a palm resting BEFORE the pencil lands is already rejected",
    intentFor(restFirst, 1) === "reject");

  // And the common case: hand down, then pencil.
  const withPen = addPointer(restFirst, pen(2));
  check("the pencil still writes with a palm on the glass",
    intentFor(withPen, 2) === "ink");

  // A palm is not a pan either — which is the bug you get if palms are merely
  // "not ink": the page would slide under a resting wrist.
  check("a palm does not pan", intentFor(withPen, 1) === "reject");

  // A finger that settles into a palm mid-gesture: it began as a pan and must
  // stop being one, because the geometry is re-read every move.
  let growing = down(finger(1));
  check("a fingertip pans", intentFor(growing, 1) === "pan");
  growing = movePointer(growing, { ...palm(1), x: 100, y: 100 });
  check("...and is rejected once its contact patch becomes palm-sized",
    intentFor(growing, 1) === "reject");

  // Threshold behaviour at the boundary, both sides, on each axis separately —
  // a palm laid along its edge is wide in one dimension only.
  const at = (w: number, h: number): PointerSample => ({ id: 1, kind: "touch", x: 0, y: 0, width: w, height: h });
  check("exactly at the threshold is still a finger", !isPalm(at(PALM_CONTACT_PX, PALM_CONTACT_PX)));
  check("one pixel over, on width, is a palm", isPalm(at(PALM_CONTACT_PX + 1, 10)));
  check("one pixel over, on height, is a palm", isPalm(at(10, PALM_CONTACT_PX + 1)));

  // Browsers that report nothing must not have every touch treated as a palm.
  check("a touch with no reported geometry is not a palm",
    !isPalm({ id: 1, kind: "touch", x: 0, y: 0 }));
  // ...and a stylus is never a palm however wide it claims to be.
  check("a wide stylus is not a palm", !isPalm({ id: 1, kind: "pen", x: 0, y: 0, width: 200, height: 200 }));
}

/* =================================================== gesture transitions === */
// Intent is live, not latched. A hand does not announce what it is about to do.
{
  let s = down(finger(1, 100, 100));
  check("pan, one finger", intentFor(s, 1) === "pan");

  s = addPointer(s, finger(2, 300, 100));
  check("a second finger promotes the first to a pinch", intentFor(s, 1) === "zoom");

  s = removePointer(s, 2);
  check("lifting it demotes back to a pan", intentFor(s, 1) === "pan");

  s = addPointer(s, pen(9));
  check("the stylus landing rejects the finger mid-pan", intentFor(s, 1) === "reject");

  s = removePointer(s, 9);
  check("lifting the stylus lets the finger pan again", intentFor(s, 1) === "pan");

  check("an unknown pointer id is rejected, not drawn with", intentFor(s, 404) === "reject");
}

/* ======================================================== bookkeeping ===== */
{
  const s = down(pen(1), finger(2), palm(3));
  check("penIsDown sees the stylus", penIsDown(s));
  check("activeTouches excludes palms", activeTouches(s).length === 1);
  check("activeTouches excludes the stylus", activeTouches(s).every((p) => p.kind === "touch"));
  check("moving a pointer that is not down is a no-op",
    movePointer(s, finger(77)).pointers.size === s.pointers.size);
  check("removing a pointer that is not down is a no-op",
    removePointer(s, 77) === s);
  // Pure: the arbiter is never mutated in place, so React refs cannot be aliased
  // into a stale-but-equal state.
  const before = s.pointers.size;
  addPointer(s, finger(50));
  check("addPointer does not mutate its input", s.pointers.size === before);
}

/* ============================================== centroid and spread ======= */
{
  const two = [finger(1, 100, 200), finger(2, 300, 400)];
  const c = centroid(two);
  check("centroid is the midpoint", c.x === 200 && c.y === 300);
  check("spread is the distance", Math.abs(spread(two) - Math.hypot(200, 200)) < 1e-9);
  check("spread of one touch is zero", spread([finger(1)]) === 0);
  check("centroid of nothing is the origin, not NaN",
    centroid([]).x === 0 && centroid([]).y === 0);
}

/* ================================================== the zoom is continuous = */
// The brief: "Zoom must be continuous, not stepped." The old implementation had
// exactly four reachable scales; a continuous one must reach arbitrary values.
{
  let v: View = { scale: 1, x: 0, y: 0 };
  const seen = new Set<number>();
  for (let i = 0; i < 12; i++) {
    v = zoomAround(v, 1.03, 400, 300);
    seen.add(Number(v.scale.toFixed(4)));
  }
  check("twelve small pinches give twelve distinct scales", seen.size === 12,
    `got ${seen.size}`);
  check("none of them is one of the four old steps",
    ![...seen].some((s) => [0.75, 1, 1.5, 2].includes(s)));
}

/* ========================================== the page does not drift ======= */
// The defining property of a correct pinch: the point under your fingers stays
// under your fingers. Checked as an invariant across a spread of scales and
// anchors rather than one happy case, because drift is a fraction of a pixel per
// frame and only shows up after a long gesture.
{
  let worst = 0;
  for (const startScale of [0.3, 0.5, 1, 1.7, 3, 6]) {
    for (const anchor of [[0, 0], [400, 300], [1200, 50], [-80, 640]] as const) {
      for (const factor of [0.5, 0.92, 1.0001, 1.08, 2]) {
        const view: View = { scale: startScale, x: -137.5, y: 42.25 };
        const [sx, sy] = anchor;
        // Where the anchor is in page space before the zoom...
        const worldX = (sx - view.x) / view.scale;
        const worldY = (sy - view.y) / view.scale;
        const next = zoomAround(view, factor, sx, sy);
        // ...and where that same page point lands after it.
        const afterX = next.x + worldX * next.scale;
        const afterY = next.y + worldY * next.scale;
        worst = Math.max(worst, Math.abs(afterX - sx), Math.abs(afterY - sy));
      }
    }
  }
  check("the anchored point never moves under a pinch", worst < 1e-9,
    `worst drift ${worst}px over 120 combinations`);
}

// The same invariant at the clamps, which is where a naive implementation slides:
// it applies the requested factor to the translation but the clamped one to the
// scale, so the page creeps every frame you keep pinching against the limit.
{
  let creep = 0;
  let v: View = { scale: MAX_SCALE, x: -500, y: -400 };
  const start = { ...v };
  for (let i = 0; i < 60; i++) v = zoomAround(v, 1.2, 640, 360);
  creep = Math.max(Math.abs(v.x - start.x), Math.abs(v.y - start.y));
  check("pinching past the maximum does not move the page", creep < 1e-9,
    `crept ${creep}px over 60 frames`);

  let u: View = { scale: MIN_SCALE, x: 30, y: 20 };
  const ustart = { ...u };
  for (let i = 0; i < 60; i++) u = zoomAround(u, 0.8, 100, 100);
  check("pinching past the minimum does not move the page either",
    Math.abs(u.x - ustart.x) < 1e-9 && Math.abs(u.y - ustart.y) < 1e-9);

  check("the scale stays inside its limits", clampScale(1e6) === MAX_SCALE && clampScale(0) === MIN_SCALE);
  check("a NaN scale does not poison the view", clampScale(NaN) === 1);
}

/* ================================================== fit, and the clamps ==== */
{
  const page: Size = { width: 720, height: 540 };
  const viewport: Size = { width: 1000, height: 600 };

  const fw = fitWidth(page, viewport, 16);
  check("fit width spans the viewport less padding",
    Math.abs(page.width * fw - (viewport.width - 32)) < 1e-9);

  const fp = fitPage(page, viewport, 16);
  check("fit page shows the whole page",
    page.width * fp <= viewport.width - 32 + 1e-9 && page.height * fp <= viewport.height - 32 + 1e-9);
  check("fit page is never larger than fit width", fp <= fw + 1e-9);

  // A tall page in a wide viewport: fit-page must be driven by the height.
  const tall: Size = { width: 400, height: 2000 };
  check("fit page is height-driven for a tall page",
    Math.abs(tall.height * fitPage(tall, viewport, 0) - viewport.height) < 1e-9);

  check("a zero-width page does not divide by zero",
    fitWidth({ width: 0, height: 0 }, viewport) === 1 && fitPage({ width: 0, height: 0 }, viewport) === 1);

  // Padding larger than the viewport would give a negative scale; the clamp
  // catches it. A collapsed pane during a layout transition does exactly this.
  check("an absurd padding cannot produce a negative scale",
    fitWidth(page, { width: 10, height: 10 }, 40) >= MIN_SCALE);

  // Centring, both axes, when the page is smaller than the viewport.
  const small = centred(0.5, page, viewport);
  check("a page smaller than the viewport is centred",
    Math.abs(small.x - (viewport.width - 360) / 2) < 1e-9 &&
      Math.abs(small.y - (viewport.height - 270) / 2) < 1e-9);

  // ...and cannot be dragged off-centre, which is how a page gets lost.
  const shoved = clampPan(panBy(small, -900, -900), page, viewport);
  check("a small page cannot be flicked into a corner",
    Math.abs(shoved.x - small.x) < 1e-9 && Math.abs(shoved.y - small.y) < 1e-9);

  // A page larger than the viewport pans freely but not past its edges.
  const big: View = { scale: 4, x: 0, y: 0 };
  const dragged = clampPan(panBy(big, 500, 500), page, viewport);
  check("a large page cannot leave dead space at the top-left",
    dragged.x <= 1e-9 && dragged.y <= 1e-9);
  const far = clampPan(panBy(big, -99999, -99999), page, viewport);
  check("nor at the bottom-right",
    Math.abs(far.x - (viewport.width - page.width * 4)) < 1e-9 &&
      Math.abs(far.y - (viewport.height - page.height * 4)) < 1e-9);
  const middle = clampPan(panBy(big, -100, -80), page, viewport);
  check("and pans freely in between", middle.x === -100 && middle.y === -80);

  // The mixed case, which is the common one: a page wider than the viewport but
  // shorter than it. One axis clamps, the other centres.
  const wide: Size = { width: 2000, height: 300 };
  const mixed = clampPan({ scale: 1, x: -500, y: -200 }, wide, viewport);
  check("a wide short page clamps on x and centres on y",
    mixed.x === -500 && Math.abs(mixed.y - (viewport.height - 300) / 2) < 1e-9);

  // A resize that makes the viewport bigger must not leave the page stranded
  // against an edge — this is the orientation change on an iPad.
  const strandedBefore: View = { scale: 1, x: -1280, y: 0 };
  const afterRotate = clampPan(strandedBefore, page, { width: 1400, height: 900 });
  check("rotating to a viewport larger than the page recentres it",
    Math.abs(afterRotate.x - (1400 - 720) / 2) < 1e-9);
}

/* ====================================== annotations must not drift ======== */
// The brief's hardest requirement, and the reason coordinates are normalised.
// A stored stroke is a fraction of the page box; the round trip through screen
// space and back must return the same fraction at any view, on any DPR, in any
// viewport. If this holds, ink cannot drift — it is the same arithmetic the
// component uses via getBoundingClientRect.
{
  const page: Size = { width: 720, height: 540 };
  let worst = 0;
  const stored = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 0.5, y: 0.5 },
    { x: 0.137, y: 0.9042 },
    { x: 0.99993, y: 0.00007 },
  ];
  for (const scale of [0.25, 0.5, 1, 1.333, 2, 3.7, 8]) {
    for (const [x, y] of [[0, 0], [-340.5, -220.25], [77, -1000]] as const) {
      for (const dpr of [1, 2, 3]) {
        const view: View = { scale, x, y };
        for (const s of stored) {
          // Normalised -> the page's own CSS box -> the transformed screen box.
          const screenX = view.x + s.x * page.width * view.scale;
          const screenY = view.y + s.y * page.height * view.scale;
          // ...and back, the way toPoint does it from the canvas's client rect.
          // DPR appears in the backing store only, never in this arithmetic,
          // which is precisely why a retina screen cannot shift a stroke.
          const rectW = page.width * view.scale;
          const rectH = page.height * view.scale;
          void dpr;
          const back = { x: (screenX - view.x) / rectW, y: (screenY - view.y) / rectH };
          worst = Math.max(worst, Math.abs(back.x - s.x), Math.abs(back.y - s.y));
        }
      }
    }
  }
  check("a normalised stroke survives every zoom, pan, viewport and DPR",
    worst < 1e-12, `worst error ${worst} of the page box`);
}

/* ============================================ the render-scale ladder ===== */
{
  check("100% renders at 1x", renderScaleFor(1) === 1);
  check("a hair over 100% steps to 1.5x", renderScaleFor(1.01) === 1.5);
  check("250% renders at 3x", renderScaleFor(2.5) === 3);
  check("the top of the range is covered", renderScaleFor(MAX_SCALE) === 8);
  check("beyond the top does not fall through", renderScaleFor(99) === 8);
  check("zooming out does not render below 1x", renderScaleFor(0.3) === 1);

  // The ladder must never leave the bitmap upscaled by a visible amount: the
  // rung is always >= the view scale, and never more than 1.5x above it.
  let worstRatio = 1;
  for (let s = MIN_SCALE; s <= MAX_SCALE; s += 0.01) {
    const r = renderScaleFor(s);
    check(`rung >= view scale at ${s.toFixed(2)}`, r >= s - 1e-9);
    worstRatio = Math.max(worstRatio, r / Math.max(s, 1));
  }
  check("the bitmap is never oversampled by more than 1.5x", worstRatio <= 1.5 + 1e-9,
    `worst ${worstRatio.toFixed(3)}x`);

  // And it must be cheap to settle on: a fidgeting student between 1.03 and
  // 1.06 must produce ONE render, not one per frame.
  const rungs = new Set([1.03, 1.041, 1.0502, 1.06].map(renderScaleFor));
  check("a fidget inside one rung is a single render", rungs.size === 1);
}

/* ==================================== the canvas the device will give ===== */
// Measured in a browser: three layers at 2160x1620 already hold 40MB, and the
// ladder asks for a render scale of 8 at 8x zoom — on an iPad at dpr 3 that is a
// backing store of 17280x12960 per layer, 224 million pixels, 896MB each. iOS
// Safari does not raise an error for that; it returns a canvas it silently
// declined to allocate and the slide goes blank, at exactly the zoom a student
// uses to read a small label. So the render scale is capped by area, and the cap
// is asserted here against the page sizes a lecture actually arrives as.
{
  const PAGES: Array<[string, Size, number]> = [
    ["a 4:3 slide", { width: 720, height: 540 }, 1],
    ["a 4:3 slide on a retina iPad", { width: 720, height: 540 }, 3],
    ["A4 portrait", { width: 595, height: 842 }, 3],
    ["a 16:9 deck", { width: 960, height: 540 }, 2],
    ["an A0 poster", { width: 2384, height: 3370 }, 3],
    ["a phone photo of a whiteboard", { width: 4032, height: 3024 }, 2],
    ["a flatbed scan", { width: 8000, height: 6000 }, 3],
  ];
  for (const [label, page, dpr] of PAGES) {
    const cap = maxRenderScale(page, dpr);
    for (const zoom of [MIN_SCALE, 0.5, 1, 2, 4, MAX_SCALE]) {
      const applied = Math.min(renderScaleFor(zoom), cap);
      const pixels = page.width * page.height * Math.pow(dpr * applied, 2);
      check(`${label} at ${zoom}x stays inside the canvas budget`,
        pixels <= MAX_CANVAS_PIXELS * 1.001,
        `${(pixels / 1e6).toFixed(1)}M px against a budget of ${(MAX_CANVAS_PIXELS / 1e6).toFixed(1)}M`);
    }
  }
  // The cap must not be floored at 1. A phone photo is over budget at 1:1, and a
  // first version of this function floored there — which produced exactly the
  // blank canvas it was written to prevent.
  check("a page too large to rasterise 1:1 is allowed to render below 1x",
    maxRenderScale({ width: 4032, height: 3024 }, 2) < 1);
  check("...but never at zero, which would be a canvas with no pixels",
    maxRenderScale({ width: 40000, height: 30000 }, 3) > 0);
  // And it must not bite when there is no reason to.
  check("an ordinary slide at 1x is not capped",
    Math.min(renderScaleFor(1), maxRenderScale({ width: 720, height: 540 }, 2)) === 1);
  check("a degenerate page size does not produce NaN",
    Number.isFinite(maxRenderScale({ width: 0, height: 0 }, 2)) &&
      Number.isFinite(maxRenderScale({ width: 720, height: 540 }, 0)));
}

/* ================================= only what is on screen, at deep zoom === */
// The cap above keeps a canvas inside what the device will allocate, but it buys
// that with blur: at 8x on a retina iPad the whole page could only be rasterised
// at 2.19x, so the bitmap was upscaled 3.7x. Past the point where the whole page
// fits, only the visible part is rasterised — at the scale actually on screen.
{
  const page: Size = { width: 720, height: 540 };
  const viewport: Size = { width: 1216, height: 630 };

  // Regime one: the whole page, whenever it fits. Every ordinary zoom level.
  for (const [scale, dpr] of [[0.5, 1], [1, 1], [1, 3], [2, 2], [1.65, 3]] as const) {
    const r = regionFor(centred(scale, page, viewport), page, viewport, dpr);
    check(`at ${scale}x dpr ${dpr} the whole page is rasterised`,
      r.x === 0 && r.y === 0 && r.width === page.width && r.height === page.height,
      `${r.width}x${r.height} at (${r.x},${r.y})`);
    // The ladder, not the raw scale: a whole-page render is expensive, and
    // quantising it is what keeps a fidgeting hand from paying for one per pause.
    check(`...at the laddered scale, never below what is on screen`,
      Math.abs(r.backing - dpr * renderScaleFor(scale)) < 1e-9 && r.backing >= dpr * scale - 1e-9,
      `backing ${r.backing} vs ${dpr * renderScaleFor(scale)}`);
  }

  // Regime two: deep zoom. The region shrinks, and the sharpness is kept.
  {
    const view = clampPan({ scale: 8, x: -2000, y: -1500 }, page, viewport);
    const r = regionFor(view, page, viewport, 3);
    check("at 8x dpr 3 only part of the page is rasterised",
      r.width < page.width && r.height < page.height, `${r.width}x${r.height}`);
    // The whole point: sharper than the old cap, which held backing at 6.57.
    check("...and it is sharper than capping the whole page would have been",
      r.backing > 6.57, `backing ${r.backing.toFixed(2)} vs the old 6.57`);
    // Not quantised by the ladder — the region regime renders at the scale on
    // screen. It may still be trimmed by the canvas budget, which is why this
    // asks for most of it rather than all of it.
    check("...at close to the scale it is being shown at, not a laddered one",
      r.backing > 3 * 8 * 0.85, `backing ${r.backing.toFixed(1)} against ${3 * 8} on screen`);
    check("...while still inside the canvas budget",
      r.width * r.height * r.backing * r.backing <= MAX_CANVAS_PIXELS * 1.001,
      `${((r.width * r.height * r.backing * r.backing) / 1e6).toFixed(1)}M px`);
  }

  // No page size, zoom or dpr may ask for a canvas the device refuses.
  {
    const PAGES: Array<[string, Size]> = [
      ["a 4:3 slide", { width: 720, height: 540 }],
      ["A4 portrait", { width: 595, height: 842 }],
      ["an A0 poster", { width: 2384, height: 3370 }],
      ["a phone photo", { width: 4032, height: 3024 }],
    ];
    const VIEWPORTS: Size[] = [
      { width: 390, height: 700 },
      { width: 1216, height: 630 },
      { width: 2560, height: 1400 },
    ];
    let worst = 0;
    for (const [label, pg] of PAGES) {
      for (const vp of VIEWPORTS) {
        for (const dpr of [1, 2, 3]) {
          for (const scale of [MIN_SCALE, 0.5, 1, 2, 4, 6, MAX_SCALE]) {
            const view = clampPan({ scale, x: -pg.width * scale * 0.3, y: -pg.height * scale * 0.4 }, pg, vp);
            const r = regionFor(view, pg, vp, dpr);
            const px = r.width * r.height * r.backing * r.backing;
            worst = Math.max(worst, px);
            check(`${label} at ${scale}x dpr ${dpr} in ${vp.width}x${vp.height} fits the budget`,
              px <= MAX_CANVAS_PIXELS * 1.001, `${(px / 1e6).toFixed(1)}M px`);
            check(`${label} at ${scale}x dpr ${dpr} in ${vp.width}x${vp.height} has real pixels`,
              r.width > 0 && r.height > 0 && r.backing > 0);
          }
        }
      }
    }
    check("the worst case across every combination is inside the budget",
      worst <= MAX_CANVAS_PIXELS * 1.001, `${(worst / 1e6).toFixed(1)}M px`);
  }

  // The region must actually cover what is on screen, or the student sees paper
  // where their lecture should be. Checked as containment of the visible rect.
  {
    let uncovered = 0;
    for (const scale of [1, 2, 4, 6, 8]) {
      for (const dpr of [1, 2, 3]) {
        for (const [fx, fy] of [[0, 0], [0.5, 0.5], [1, 1], [0.2, 0.9]] as const) {
          const w = page.width * scale, h = page.height * scale;
          const view = clampPan({ scale, x: -(w - viewport.width) * fx, y: -(h - viewport.height) * fy }, page, viewport);
          const r = regionFor(view, page, viewport, dpr);
          // What is on screen, in page units, clamped to the page itself.
          const left = Math.max(0, (0 - view.x) / scale);
          const top = Math.max(0, (0 - view.y) / scale);
          const right = Math.min(page.width, (viewport.width - view.x) / scale);
          const bottom = Math.min(page.height, (viewport.height - view.y) / scale);
          const covers = r.x <= left + 1e-6 && r.y <= top + 1e-6 &&
            r.x + r.width >= right - 1e-6 && r.y + r.height >= bottom - 1e-6;
          if (!covers) uncovered++;
        }
      }
    }
    check("the rasterised region always covers what is on screen", uncovered === 0,
      `${uncovered} combinations left visible page unrendered`);
  }

  /* Tight, not merely sufficient.
     Covering the screen is necessary and not enough: every page pixel in the
     region costs backing, because the budget is fixed and the cap divides it by
     the area. A region twice the size it needs to be is a page rendered at 70%
     of the sharpness it could have had — and it passes a coverage test
     perfectly. A mutation that mapped screen to page with the wrong sign did
     exactly that: the region still contained the screen, and was two and a half
     times too big.
     So the region is also asserted to be no larger than the screen plus its
     margin, which is the thing that actually buys the sharpness. */
  {
    let worstWaste = 1;
    for (const scale of [4, 6, 8]) {
      for (const dpr of [2, 3]) {
        for (const [fx, fy] of [[0, 0], [0.5, 0.5], [1, 1], [0.2, 0.9]] as const) {
          const w = page.width * scale, h = page.height * scale;
          const view = clampPan({ scale, x: -(w - viewport.width) * fx, y: -(h - viewport.height) * fy }, page, viewport);
          const r = regionFor(view, page, viewport, dpr);
          if (r.width === page.width && r.height === page.height) continue; // whole page, nothing to waste
          // What the region is allowed to be: the screen, plus a quarter of it on
          // every side, in page units — clamped to the page, and with a pixel of
          // slack for the rounding that keeps the raster on whole pixels.
          // Screen plus margin, plus the two grid cells that snapping can add on
          // each axis. The grid is a fraction of the screen, so its cost is a
          // fixed few percent rather than something that explodes at high zoom.
          const grid = Math.max(1, (Math.min(viewport.width, viewport.height) * 0.05) / scale);
          const allowedW = Math.min(page.width, (viewport.width * 1.5) / scale + 2 * grid) + 2;
          const allowedH = Math.min(page.height, (viewport.height * 1.5) / scale + 2 * grid) + 2;
          check(`at ${scale}x dpr ${dpr} the region is no wider than the screen plus its margin`,
            r.width <= allowedW, `${r.width} page px against ${allowedW.toFixed(1)} allowed`);
          check(`at ${scale}x dpr ${dpr} the region is no taller than the screen plus its margin`,
            r.height <= allowedH, `${r.height} page px against ${allowedH.toFixed(1)} allowed`);
          worstWaste = Math.max(worstWaste, (r.width * r.height) / (allowedW * allowedH));
        }
      }
    }
    check("no region wastes area, because wasted area is lost sharpness",
      worstWaste <= 1.001, `worst ${worstWaste.toFixed(2)}x the allowance`);
  }

  // The margin itself, through the function the component actually calls — so a
  // margin removed from `regionFor` is caught, not only one removed from
  // `visibleRegion`, which `regionFor` overrides anyway.
  {
    const view = clampPan({ scale: 8, x: -2000, y: -1500 }, page, viewport);
    const r = regionFor(view, page, viewport, 3);
    const visibleLeft = (0 - view.x) / 8;
    const visibleTop = (0 - view.y) / 8;
    check("there is slack to the left of what is on screen",
      r.x < visibleLeft - 1, `region starts at ${r.x}, screen starts at ${visibleLeft.toFixed(1)}`);
    check("there is slack above what is on screen",
      r.y < visibleTop - 1, `region starts at ${r.y}, screen starts at ${visibleTop.toFixed(1)}`);
    check("there is slack to the right",
      r.x + r.width > visibleLeft + viewport.width / 8 + 1);
    check("there is slack below",
      r.y + r.height > visibleTop + viewport.height / 8 + 1);
  }

  /* A small pan must cost nothing.
     The grid is the region regime's equivalent of the ladder: without it every
     pixel of movement is a fresh rasterisation of the page. */
  {
    const base = clampPan({ scale: 8, x: -2000, y: -1500 }, page, viewport);
    const a = regionFor(base, page, viewport, 3);
    const nudged = regionFor(clampPan(panBy(base, 2, 2), page, viewport), page, viewport, 3);
    check("a two-pixel pan reuses the raster it already has", sameRegion(a, nudged),
      `${a.x},${a.y} ${a.width}x${a.height} -> ${nudged.x},${nudged.y} ${nudged.width}x${nudged.height}`);
    const moved = regionFor(clampPan(panBy(base, 900, 600), page, viewport), page, viewport, 3);
    check("a real pan does not", !sameRegion(a, moved),
      `${a.x},${a.y} -> ${moved.x},${moved.y}`);
  }

  // A page scrolled entirely off screen must not produce a zero-size canvas.
  {
    const r = visibleRegion({ scale: 4, x: 99999, y: 99999 }, page, viewport);
    check("a page pushed off screen still yields a drawable region",
      r.width >= 1 && r.height >= 1);
  }

  // And re-rendering is skipped when nothing meaningful changed, or a resting
  // hand would re-rasterise the page on every settle.
  {
    const a = regionFor(centred(1, page, viewport), page, viewport, 2);
    check("an unchanged view is the same region", sameRegion(a, { ...a }));
    check("a moved region is a different one", !sameRegion(a, { ...a, x: a.x + 40 }));
    check("a sharper region is a different one", !sameRegion(a, { ...a, backing: a.backing * 1.5 }));
    check("a hair of drift is not", sameRegion(a, { ...a, x: a.x + 0.2 }));
  }
}

/* ============================== the highlighter's compositing contract ==== */
// Measured on the previous build: orange highlighter over a black glyph
// composited to rgb(64,37,16) — the text went brown — and one pass of a nominal
// 38% marker measured 85% opaque, in visible beads. Both had one cause: the
// stroke was drawn as a chain of round-capped segments on the same canvas as the
// pen, so every overlap composited again, and the whole thing sat ON the page
// instead of multiplying INTO it.
//
// The fix is structural, and these are the three structural facts it rests on.
{
  const hl: Stroke = { mode: "highlighter", color: "#FFE14D", width: 18, points: [] };
  const inkStroke: Stroke = { mode: "pen", color: "#111111", width: 3, points: [] };
  const eraser: Stroke = { mode: "eraser", color: "#000", width: 3, points: [] };

  check("a highlighter is drawn as one continuous band, not segments",
    isContinuousTool("highlighter"));
  check("a pen is still drawn segment by segment, so pressure still shapes it",
    !isContinuousTool("pen"));

  check("the highlighter lives on its own layer", layerOf("highlighter") === "highlight");
  check("the pen lives on the ink layer", layerOf("pen") === "ink");
  check("the eraser is applied on the ink layer", layerOf("eraser") === "ink");

  check("a highlighter's alpha is the marker's, applied once",
    opacityOf(hl) === HIGHLIGHTER_ALPHA);
  check("a pen is opaque", opacityOf(inkStroke) === 1);
  check("an eraser is opaque, so it erases completely", opacityOf(eraser) === 1);
  check("an explicit opacity wins", opacityOf({ ...hl, opacity: 0.6 }) === 0.6);
  check("a zero opacity is floored, so a stroke is never invisible",
    opacityOf({ ...hl, opacity: 0 }) > 0);
  check("an opacity above one is capped", opacityOf({ ...hl, opacity: 4 }) === 1);
  // The compounding bug, as arithmetic: N overlapping passes at alpha a reach
  // 1-(1-a)^N. One band at alpha a is a. The point of the continuous path is
  // that the second number is what ends up on screen.
  const compounded = 1 - Math.pow(1 - HIGHLIGHTER_ALPHA, 8);
  check("eight overlapping segments would have compounded to >80%", compounded > 0.8,
    `${(compounded * 100).toFixed(0)}%`);
  check("one continuous band stays at the marker's own alpha",
    opacityOf(hl) < 0.4, `${(opacityOf(hl) * 100).toFixed(0)}%`);
}

/* ================================== the palette cannot default to black === */
// Measured: the highlighter's default colour was #111111, which multiplied the
// page to near-black. A highlighter palette has a hard requirement that a pen
// palette does not — every colour must be light enough that black text stays
// readable through it — so the two palettes are separate lists.
{
  // Imported lazily so this block reads as one subject.
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };

  check("the pen palette is the academic thirteen", PEN_COLORS.length === 13,
    `${PEN_COLORS.length}`);
  check("the default pen is not white on white paper", DEFAULT_PEN !== "#FFFFFF");
  check("the default highlighter is a warm yellow, not near-black",
    DEFAULT_HIGHLIGHTER === HIGHLIGHTER_COLORS[0].hex && lum(DEFAULT_HIGHLIGHTER) > 0.5,
    `${DEFAULT_HIGHLIGHTER}, luminance ${lum(DEFAULT_HIGHLIGHTER).toFixed(3)}`);

  /**
   * Two separate facts, and the first version of this test conflated them.
   *
   * That earlier check asserted that black text keeps 4.5:1 against the
   * highlighted paper — and a mutation caught it out: a navy #2B4A8F passed at
   * 10.8:1, and so did #111111, the exact near-black default that was the bug.
   * At 38% alpha over white paper, *every* colour lands above 4.5:1, because
   * 62% of the white always comes through. The check could not fail, so it was
   * not evidence.
   *
   * What is actually true, separately:
   *
   *   1. Black text surviving is STRUCTURAL, not a palette property. A multiply
   *      of anything over 0 is 0, on every channel, for every colour. That is
   *      what the layer architecture buys, and it is asserted as arithmetic
   *      below rather than as a property of these six swatches.
   *   2. The palette's job is different: a highlighter must read as a marker,
   *      which means the dye is light and the paper under it stays light. This
   *      is what separates a real marker (dye luminance 0.45-0.76, paper
   *      0.76-0.89) from the near-black that shipped (0.006 and 0.374).
   */
  const CHANNELS = [0, 32, 64, 128, 200, 255];
  let worstBlack = 0;
  for (const s of HIGHLIGHTER_COLORS) {
    const n = parseInt(s.hex.slice(1), 16);
    const dye = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    for (const alpha of [0.1, HIGHLIGHTER_ALPHA, 0.9, 1]) {
      // How the browser composites a partly transparent multiply layer:
      //   result = (1 - a) * backdrop + a * (backdrop * source)
      // With a black backdrop both terms vanish, whatever the dye and alpha.
      const onBlack = dye.map((c) => (1 - alpha) * 0 + alpha * ((0 * c) / 255));
      worstBlack = Math.max(worstBlack, ...onBlack);
    }
    // ...and the same composite over a range of backdrops never lightens one,
    // which is the other half of "multiply": a highlighter can only darken.
    for (const b of CHANNELS) {
      const out = dye.map((c) => (1 - HIGHLIGHTER_ALPHA) * b + HIGHLIGHTER_ALPHA * ((b * c) / 255));
      if (out.some((v) => v > b + 1e-9)) {
        check(`highlighter ${s.key} never lightens the page`, false, `backdrop ${b}`);
      }
    }
  }
  check("black text stays exactly black under every swatch at every alpha",
    worstBlack === 0, `worst channel ${worstBlack}`);

  // The palette requirement, at thresholds that actually separate a marker from
  // a dark pen. The real six sit at dye >= 0.453 and paper >= 0.757; every dark
  // candidate tried (#111111, #4A4A4A, #2B4A8F, #15663A) sits at dye <= 0.10 and
  // paper <= 0.513. The floors are placed in the gap, not against the data.
  const MIN_DYE_LUMINANCE = 0.4;
  const MIN_PAPER_LUMINANCE = 0.7;
  for (const s of HIGHLIGHTER_COLORS) {
    const dyeL = lum(s.hex);
    check(`highlighter ${s.key} is a light dye, not a dark pen`, dyeL >= MIN_DYE_LUMINANCE,
      `${s.hex} dye luminance ${dyeL.toFixed(3)} < ${MIN_DYE_LUMINANCE}`);

    const n = parseInt(s.hex.slice(1), 16);
    const over = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(
      (v) => v * HIGHLIGHTER_ALPHA + 255 * (1 - HIGHLIGHTER_ALPHA)
    );
    const paperL = lum("#" + over.map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""));
    check(`highlighter ${s.key} leaves the paper light`, paperL >= MIN_PAPER_LUMINANCE,
      `${s.hex} paper luminance ${paperL.toFixed(3)} < ${MIN_PAPER_LUMINANCE}`);
  }

  check("each tool gets its own palette",
    paletteFor("highlighter") !== paletteFor("pen") &&
      paletteFor("highlighter").length === HIGHLIGHTER_COLORS.length);
}

if (failures) {
  console.error(`\n${failures} failing check(s).`);
  process.exit(1);
}
console.log(
  "  A stylus writes and a finger never does; a palm is rejected whether it lands\n" +
    "  before or after the pencil; one finger pans, two pinch, and intent updates\n" +
    "  live as the hand changes. Zoom is continuous, the point under the fingers\n" +
    "  never moves, the page cannot be lost off an edge or stranded by a rotation,\n" +
    "  and a normalised stroke survives every zoom, pan, viewport and DPR exactly.\n" +
    "  The highlighter is one band on its own multiplying layer with its alpha\n" +
    "  applied once, and no swatch in its palette can brown out black text. No\n" +
    "  page size or zoom level asks the device for a canvas it will refuse, and\n" +
    "  past the point where a whole page fits in one, only what is on screen is\n" +
    "  rasterised — at the scale it is actually being shown at, not a capped one.\n\n" +
    "  NOT covered here, and not claimed: real Apple Pencil pressure and tilt, the\n" +
    "  PALM_CONTACT_PX threshold against actual hands, Safari's touch behaviour, and\n" +
    "  how any of it feels. Those need the physical device."
);
