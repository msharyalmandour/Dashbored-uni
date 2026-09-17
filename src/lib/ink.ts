/**
 * The ink engine.
 *
 * Handwriting is the one place in this app where the difference between "works"
 * and "feels right" is entirely in the details, and all of those details are
 * arithmetic. So they live here, as pure functions, rather than being tangled
 * into a React component where they can only be checked by drawing on a screen
 * and squinting.
 *
 * What was wrong with the first version, all of it visible only on a real
 * tablet with a real stylus:
 *
 *   - Every stroke was one uniform width. `PointerEvent.pressure` was never
 *     read, so a stylus produced the same dead line as a mouse. Pressure is the
 *     single thing that makes digital ink look like ink.
 *   - Points were dropped. A stylus reports at 120Hz+ but the browser delivers
 *     one `pointermove` per animation frame with the rest bundled inside
 *     `getCoalescedEvents()`. Reading only the top-level event throws away most
 *     of a fast stroke, which is why quick handwriting came out as polygons.
 *   - The canvas was sized in CSS pixels. On any retina screen — every iPad —
 *     the slide was rasterised at half resolution and every stroke was soft.
 *   - A palm was a pointer like any other.
 *   - The eraser ran at `globalAlpha = 0.85` against `destination-out`, so it
 *     removed 85% of the ink and left a ghost. Erasing twice left a fainter
 *     ghost. Nothing ever fully went away.
 *
 * Coordinates are normalised 0..1 against the page box, so annotations survive
 * a window resize, a different device, and a re-render at another zoom level.
 */

export type InkPoint = {
  x: number;
  y: number;
  /** 0..1. Optional: strokes saved before pressure existed simply don't have it. */
  p?: number;
};

export type InkMode = "pen" | "highlighter" | "eraser";

export type Stroke = {
  mode: InkMode;
  color: string;
  /** The nib width in CSS pixels, before pressure. */
  width: number;
  points: InkPoint[];
};

/** What a stroke saved before pressure was recorded is treated as. */
export const NEUTRAL_PRESSURE = 0.5;

/**
 * How much pressure is allowed to change the nib.
 *
 * A light touch lands at 45% of the nominal width and a hard press at 135%. The
 * floor is not zero on purpose: a stroke that tapers to nothing reads as a
 * rendering failure rather than as a light touch, and the tail of a fast stroke
 * frequently reports near-zero pressure on hardware that is simply slow to
 * catch up with the pen.
 */
const MIN_PRESSURE_SCALE = 0.45;
const MAX_PRESSURE_SCALE = 1.35;

/**
 * The nib width for one point.
 *
 * A mouse has no pressure. Chrome reports exactly 0.5 while a button is held and
 * 0 otherwise, and treating that as a real reading gives every mouse stroke a
 * permanent mid-weight — which is fine — but treating the 0 as "barely touching"
 * would make the first point of every mouse stroke a dot. So an input with no
 * pressure capability gets the nominal width and no modulation at all.
 */
export function widthFor(
  baseWidth: number,
  pressure: number | undefined,
  hasPressure: boolean
): number {
  if (!hasPressure) return baseWidth;
  const p = clamp(pressure ?? NEUTRAL_PRESSURE, 0, 1);
  return baseWidth * (MIN_PRESSURE_SCALE + p * (MAX_PRESSURE_SCALE - MIN_PRESSURE_SCALE));
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * True when this device actually measures pressure.
 *
 * `pointerType === "pen"` is necessary but not sufficient: some styluses report
 * a constant 0.5 for every sample, and modulating width by a constant is just a
 * slower way of drawing a uniform line. The caller collects a few samples and
 * asks; a stroke whose pressure never moves is treated as pressureless.
 */
export function detectsPressure(pointerType: string, samples: number[]): boolean {
  if (pointerType !== "pen") return false;
  if (samples.length < 3) return true; // assume yes until proven otherwise
  const lo = Math.min(...samples);
  const hi = Math.max(...samples);
  return hi - lo > 0.01;
}

/**
 * Whether to ignore this pointer as a resting palm.
 *
 * The rule is the one every tablet uses: once a real stylus has touched the
 * surface, fingers stop drawing. It is deliberately sticky for the life of the
 * component rather than per-stroke — a hand rests on the screen *before* the
 * nib lands, so a per-stroke rule rejects nothing.
 *
 * Touch still draws for people who have no stylus, which is most of them on a
 * phone, and a mouse is never rejected.
 */
export function shouldRejectPointer(pointerType: string, hasSeenPen: boolean): boolean {
  return hasSeenPen && pointerType === "touch";
}

/**
 * One drawable piece of a stroke: a segment with its own width, because the
 * width changes along the stroke and a single path can only have one.
 */
export type InkSegment = {
  from: InkPoint;
  to: InkPoint;
  width: number;
};

/**
 * A stroke, in device pixels, ready to draw.
 *
 * `scale` is the canvas's device-pixel size, so the same normalised stroke draws
 * correctly at any resolution. `dpr` scales the nib itself: a 3px pen must be 6
 * device pixels on a 2x screen or it comes out half as thick as it looks.
 */
export function strokeSegments(
  stroke: Stroke,
  width: number,
  height: number,
  dpr: number,
  hasPressure: boolean
): InkSegment[] {
  const pts = stroke.points;
  if (pts.length < 2) return [];

  // A highlighter is a flat marker, not a nib. Modulating it looks like a
  // mistake rather than like pressure.
  const flat = stroke.mode !== "pen";

  const out: InkSegment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const p = ((a.p ?? NEUTRAL_PRESSURE) + (b.p ?? NEUTRAL_PRESSURE)) / 2;
    const w = flat
      ? stroke.width * dpr
      : widthFor(stroke.width, p, hasPressure) * dpr;
    out.push({
      from: { x: a.x * width, y: a.y * height },
      to: { x: b.x * width, y: b.y * height },
      width: w,
    });
  }
  return out;
}

/**
 * Chaikin-style smoothing over the tail of a stroke.
 *
 * Raw pointer samples are noisy at low speed — a stylus resting almost still
 * jitters by a pixel or two, and at 120Hz that jitter becomes a visible fuzz
 * along the line. Averaging each point with its neighbours removes it without
 * the lag of a proper filter.
 *
 * Only the last few points are smoothed, and only while drawing: the committed
 * part of the stroke must never move under the nib, because a line that
 * reshapes itself behind your hand is far more unsettling than a slightly rough
 * one.
 */
export function smoothTail(points: InkPoint[], window = 3): InkPoint[] {
  if (points.length <= window) return points;
  const head = points.slice(0, points.length - window);
  const tail = points.slice(points.length - window);
  const smoothed: InkPoint[] = [];
  for (let i = 0; i < tail.length; i++) {
    const prev = i === 0 ? head[head.length - 1] ?? tail[i] : tail[i - 1];
    const cur = tail[i];
    const next = tail[i + 1] ?? cur;
    smoothed.push({
      x: (prev.x + cur.x * 2 + next.x) / 4,
      y: (prev.y + cur.y * 2 + next.y) / 4,
      p: cur.p,
    });
  }
  return [...head, ...smoothed];
}

/**
 * Drop samples that land on top of each other.
 *
 * `getCoalescedEvents()` returns everything the digitiser saw, which at a slow
 * hand speed includes many samples inside one pixel. Keeping them costs storage
 * and redraw time and changes nothing on screen. The threshold is in normalised
 * units, so it is roughly a third of a pixel on a 900px-wide page.
 */
export function dedupe(points: InkPoint[], minDistance = 0.0004): InkPoint[] {
  if (points.length === 0) return points;
  const out: InkPoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const last = out[out.length - 1];
    const dx = points[i].x - last.x;
    const dy = points[i].y - last.y;
    if (dx * dx + dy * dy >= minDistance * minDistance) out.push(points[i]);
  }
  // A stroke that never moved is a dot, and a dot needs its one point kept.
  if (out.length === 1 && points.length > 1) out.push(points[points.length - 1]);
  return out;
}

/**
 * How the eraser is applied.
 *
 * `destination-out` at full alpha, always. The old code ran it at 0.85, which
 * removed most of the ink and left a ghost — and because the ghost was itself
 * ink, erasing it again left a fainter ghost, forever. An eraser either erases
 * or it is a light grey pen.
 *
 * The nib is much wider than the pen's because an eraser you have to be
 * accurate with is worse than no eraser.
 */
export const ERASER_WIDTH_MULTIPLIER = 6;

/** Highlighters sit under the text they mark rather than covering it. */
export const HIGHLIGHTER_ALPHA = 0.38;
export const HIGHLIGHTER_WIDTH_MULTIPLIER = 4;

/**
 * Whether a redo stack should survive this action.
 *
 * Standard and worth stating once: drawing after undoing discards the redo
 * stack, because the thing it would redo is no longer the future of this
 * document. Undo and redo themselves preserve it.
 */
export function redoSurvives(action: "draw" | "undo" | "redo" | "clear"): boolean {
  return action === "undo" || action === "redo";
}
