/**
 * Document zoom and pan, as arithmetic.
 *
 * The viewer used to offer four scales — 0.75, 1, 1.5, 2 — reached by pressing
 * a button repeatedly. That is a setting, not zoom. A student reading a dense
 * slide wants to push into one corner of a diagram and back out, continuously,
 * with two fingers, and wants the page to stay where they put it.
 *
 * All of it is here rather than in the component because every one of these is
 * a place a document viewer goes subtly wrong — the page drifts under a pinch,
 * the scroll jumps when the render settles, zooming out leaves the page stuck
 * against an edge — and every one of those bugs is a line of arithmetic that
 * can be checked without a browser.
 *
 * The view is a scale plus a translation, applied to the page as a whole:
 *
 *     screen = translate + world × scale
 *
 * Annotations are stored normalised 0..1 against the page box and are therefore
 * untouched by any of this: they are children of the same transformed element,
 * so they move with the page for free. That is the property that makes zoom
 * safe, and scripts/verify-gesture.ts asserts it directly.
 */

export type View = {
  scale: number;
  /** Translation of the page's top-left corner, in viewport pixels. */
  x: number;
  y: number;
};

export type Size = { width: number; height: number };

/**
 * Below a quarter the page is a thumbnail and above eight it is one glyph.
 * Both ends exist to stop a two-finger flick leaving the student somewhere they
 * have to find their way back from.
 */
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 8;

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** The scale at which the page spans the viewport's width, less padding. */
export function fitWidth(page: Size, viewport: Size, pad = 0): number {
  if (page.width <= 0) return 1;
  return clampScale((viewport.width - pad * 2) / page.width);
}

/** The scale at which the whole page is visible. */
export function fitPage(page: Size, viewport: Size, pad = 0): number {
  if (page.width <= 0 || page.height <= 0) return 1;
  return clampScale(
    Math.min((viewport.width - pad * 2) / page.width, (viewport.height - pad * 2) / page.height)
  );
}

/**
 * Zoom by a factor while holding one point on the screen still.
 *
 * The fixed point is the pinch centroid, or the mouse pointer for a wheel zoom,
 * or the tap for a double-tap. Holding it still is the whole feel of a document
 * viewer: the thing under your fingers is the thing that stays put.
 */
export function zoomAround(view: View, factor: number, screenX: number, screenY: number): View {
  const scale = clampScale(view.scale * factor);
  // The factor may have been clipped by the clamp, so derive the real one back
  // out rather than trusting the argument — otherwise the page slides at the
  // limits, which is exactly where a student is pinching hardest.
  const applied = scale / view.scale;
  return {
    scale,
    x: screenX - (screenX - view.x) * applied,
    y: screenY - (screenY - view.y) * applied,
  };
}

export function panBy(view: View, dx: number, dy: number): View {
  return { scale: view.scale, x: view.x + dx, y: view.y + dy };
}

/**
 * Keep the page somewhere a student can find it.
 *
 * Two behaviours, and the switch between them is the page's size against the
 * viewport rather than the scale, because that is what actually determines
 * whether there is anything to pan to:
 *
 *   - Smaller than the viewport on an axis: centred on that axis, and it cannot
 *     be dragged off-centre. A page you can flick into a corner and lose is a
 *     page you have to hunt for.
 *   - Larger: free to move, but never so far that an edge comes inside the
 *     viewport and leaves dead space beside the document.
 */
export function clampPan(view: View, page: Size, viewport: Size): View {
  const w = page.width * view.scale;
  const h = page.height * view.scale;

  let { x, y } = view;

  if (w <= viewport.width) x = (viewport.width - w) / 2;
  else x = Math.min(0, Math.max(viewport.width - w, x));

  if (h <= viewport.height) y = (viewport.height - h) / 2;
  else y = Math.min(0, Math.max(viewport.height - h, y));

  return { scale: view.scale, x, y };
}

/** Put the page at a scale, centred — used by fit-width, fit-page and reset. */
export function centred(scale: number, page: Size, viewport: Size): View {
  return clampPan({ scale, x: 0, y: 0 }, page, viewport);
}

/**
 * Which scales a render is actually worth doing at.
 *
 * Re-rasterising on every settled pinch would mean a new full-page render for
 * 1.03×, then 1.06×, then 1.04× as a student fidgets. Snapping the *render*
 * scale to a coarse ladder — while the *view* scale stays continuous — means
 * the page is always at least as sharp as it needs to be and re-renders a
 * handful of times instead of continuously. The bitmap is never upscaled by
 * more than one rung, so it never looks soft.
 */
export function renderScaleFor(viewScale: number): number {
  const rungs = [1, 1.5, 2, 3, 4, 6, 8];
  for (const rung of rungs) if (viewScale <= rung) return rung;
  return rungs[rungs.length - 1];
}

/**
 * The most device pixels one canvas may hold.
 *
 * Measured, and the reason this cap exists at all: at 8x zoom the ladder asks
 * for a render scale of 8, and on an iPad at devicePixelRatio 3 that is a
 * backing store of 24x the page's natural size — for a 720x540 slide,
 * 17280x12960, which is 224 million pixels and 896MB, times three layers.
 *
 * iOS Safari does not report that as an error. It returns a canvas whose
 * backing store it has silently refused to allocate, and the page goes blank.
 * On the device this whole feature exists for, at the zoom level a student uses
 * to read a small label on a diagram.
 *
 * 2^24 pixels is the limit iOS Safari has historically enforced per canvas.
 * Three layers at that size is 201MB, which is survivable; a fourth would not
 * be, and that is worth remembering before a text layer is added.
 */
export const MAX_CANVAS_PIXELS = 16_777_216;

/**
 * The largest render scale a page can actually be rasterised at.
 *
 * `renderScaleFor` says what the view would like; this says what the device will
 * tolerate. The component takes the smaller of the two, which means very high
 * zoom on a high-DPR screen is SOFT rather than blank — the bitmap is upscaled
 * by the shortfall. That is a real limitation and not a hidden one: the honest
 * fix is to rasterise only the visible region rather than the whole page, which
 * is a tiling renderer and does not belong in this phase.
 *
 * Worked example, a 720x540 page: at dpr 3 the cap allows a render scale of
 * about 2.2, so a student at 8x sees a bitmap upscaled 3.6x. Legible, soft, and
 * present.
 */
export function maxRenderScale(page: Size, dpr: number, budget = MAX_CANVAS_PIXELS): number {
  const area = page.width * page.height;
  if (area <= 0 || dpr <= 0) return 1;
  const maxBacking = Math.sqrt(budget / area);
  /* Allowed to fall below 1, and that is the point.
     A first version floored this at 1 on the reasoning that a page too large to
     rasterise 1:1 is a separate problem. It is not a separate problem, it is the
     common one: a photograph of a whiteboard off a phone is 4032x3024, which is
     12.2 million pixels before the device pixel ratio, and 48.8 million after —
     three times over budget at a render scale of 1. Floored at 1, that canvas is
     the blank one this cap exists to prevent.
     Below 1 the bitmap is smaller than the box it is drawn into, so the image is
     slightly soft. A phone photo has far more resolution than the screen showing
     it, so in practice nothing visible is lost — and soft beats blank in every
     case, at every size. */
  return Math.max(0.05, maxBacking / dpr);
}

/**
 * A rectangle of the page, in the page's own CSS pixels.
 *
 * `backing` is how many device pixels one page pixel becomes inside it, so a
 * region plus its backing fully describes a raster: where it sits on the page,
 * and how sharp it is.
 */
export type Region = { x: number; y: number; width: number; height: number; backing: number };

/**
 * The part of the page currently on screen, plus a margin.
 *
 * Expressed in page pixels, because that is the coordinate system the raster and
 * the annotations already share. The margin is what stops a small pan revealing
 * unrendered paper before the re-render lands; it is a fraction of the viewport,
 * not of the page, because what a hand can move in one gesture is a property of
 * the screen rather than of the document.
 */
/**
 * How far the page may move before the raster has to be redone, as a fraction of
 * the screen.
 *
 * A fraction of the SCREEN rather than a fixed number of page pixels, and that
 * distinction is measurable. A fixed 32-page-pixel grid is nothing at 1x and
 * enormous at 8x, where the visible strip of page is only 152 pixels wide — it
 * inflated the region by 42%, and because the canvas budget is fixed, 42% more
 * area is 16% less sharpness. Tied to the screen, the cost stays at a few
 * percent at every zoom level, and the promise stays the same: move less than a
 * twentieth of the screen and the render you already have is reused.
 */
export const REGION_GRID_FRACTION = 0.05;

export function visibleRegion(
  view: View,
  page: Size,
  viewport: Size,
  margin = 0.25,
  gridFraction = REGION_GRID_FRACTION
): Region {
  const scale = view.scale || 1;
  // Screen -> page: the inverse of `screen = translate + world * scale`.
  const left = (0 - view.x) / scale;
  const top = (0 - view.y) / scale;
  const right = (viewport.width - view.x) / scale;
  const bottom = (viewport.height - view.y) / scale;

  const padX = (viewport.width * margin) / scale;
  const padY = (viewport.height * margin) / scale;

  /* Snapped to a grid, so that moving a little changes nothing.
     Without it the region shifts by a pixel every time a finger does, and each
     shift is a fresh rasterisation of the page. Snapped, a pan inside one grid
     cell reuses the raster it already has, and only a real move costs a render. */
  const grid = Math.max(1, (Math.min(viewport.width, viewport.height) * gridFraction) / scale);
  const snapDown = (v: number) => Math.floor(v / grid) * grid;
  const snapUp = (v: number) => Math.ceil(v / grid) * grid;

  const x0 = Math.max(0, snapDown(left - padX));
  const y0 = Math.max(0, snapDown(top - padY));
  const x1 = Math.min(page.width, snapUp(right + padX));
  const y1 = Math.min(page.height, snapUp(bottom + padY));

  return {
    x: x0,
    y: y0,
    // A zero-size region would be a canvas with no pixels; one page pixel is the
    // floor, and it only arises when the page is scrolled entirely off screen.
    width: Math.max(1, x1 - x0),
    height: Math.max(1, y1 - y0),
    backing: 1,
  };
}

/**
 * What to rasterise, and how sharply.
 *
 * Two regimes, and the switch between them is the whole point:
 *
 *   - While the whole page fits inside one canvas at the scale being asked for,
 *     the whole page IS the region. This is every ordinary zoom level, it has no
 *     seams and no unrendered edges, and it is the behaviour that was measured
 *     pixel-identical to the source.
 *   - Past that, rasterising the whole page would ask the device for a canvas it
 *     refuses — and capping the scale instead, which is what this did first,
 *     buys safety with blur: at 8x on a retina iPad the page was upscaled 3.7x.
 *     So only the visible part is rasterised, at the scale actually on screen.
 *
 * The second regime is exactly where it is safe: the page is far larger than the
 * viewport, so panning is the only way to move, and a pan settles into a fresh
 * region. Zooming out returns to the first regime, where nothing can be missing.
 */
export function regionFor(
  view: View,
  page: Size,
  viewport: Size,
  dpr: number,
  budget = MAX_CANVAS_PIXELS,
  margin = 0.25
): Region {
  const scale = Math.max(view.scale, 0.01);

  /* Whole-page regime: the ladder decides, as it always did.
     Quantising the render scale here is what stops a student who fidgets between
     1.03x and 1.06x paying for a full-page rasterisation at every pause. It only
     applies while the whole page is being rendered, because that is the case
     where a render is expensive and the extra sharpness would be invisible. */
  const laddered = dpr * renderScaleFor(scale);
  if (page.width * page.height * laddered * laddered <= budget) {
    return { x: 0, y: 0, width: page.width, height: page.height, backing: laddered };
  }

  /* Region regime: the scale actually on screen, because that is the whole
     reason for rendering a region — sharpness at a zoom level where the ladder
     would otherwise have been capped into blur. The grid snapping in
     `visibleRegion` plays the part the ladder plays above: it is what keeps a
     small movement from costing a render. */
  const wanted = dpr * scale;

  const region = visibleRegion(view, page, viewport, margin);
  // The region is viewport-sized, so it is normally well inside the budget — but
  // a very large pane at dpr 3 can still exceed it, and a canvas the device
  // refuses is the one outcome that must never happen.
  const cap = Math.sqrt(budget / (region.width * region.height));
  return { ...region, backing: Math.min(wanted, cap) };
}

/** Whether two regions describe the same raster, so a re-render can be skipped. */
export function sameRegion(a: Region, b: Region, tolerance = 0.5): boolean {
  return (
    Math.abs(a.x - b.x) < tolerance &&
    Math.abs(a.y - b.y) < tolerance &&
    Math.abs(a.width - b.width) < tolerance &&
    Math.abs(a.height - b.height) < tolerance &&
    Math.abs(a.backing - b.backing) / Math.max(a.backing, b.backing) < 0.02
  );
}
