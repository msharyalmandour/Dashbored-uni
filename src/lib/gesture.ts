/**
 * What a pointer on the document means.
 *
 * The lecture viewer has one surface and four different things a hand can do to
 * it: write, pan, pinch, and rest. Before this there was exactly one rule —
 * `touch-action: none` on the ink canvas — which resolved the whole question by
 * force: every touch was ink, nothing else was possible, and pinch-to-zoom was
 * not a missing feature but an architectural impossibility. The browser never
 * saw the gesture.
 *
 * So the decision moves here, where it is a pure function of which pointers are
 * currently down, and can therefore be tested without a tablet. The rules are
 * deterministic and in this order:
 *
 *   1. A stylus always writes. It never pans, never zooms, never scrolls.
 *   2. While a stylus is down, every touch is rejected. This is the common case
 *      for palm rejection and the one that matters most: your hand is resting
 *      on the glass precisely because you are writing.
 *   3. A touch with a palm-sized contact patch is rejected whether or not a
 *      stylus is down. This closes the hole the old rule had — if you rest your
 *      hand *before* lowering the pencil, the old code had seen no pen yet and
 *      happily drew with your palm.
 *   4. One remaining touch pans. Two or more pinch and pan together.
 *   5. A mouse writes, because on a laptop that is the only pointer there is.
 *
 * A finger never writes. That is deliberate and not configurable in this phase:
 * a product where a resting knuckle can leave a mark on a lecture is worse than
 * one that asks for a stylus.
 */

export type PointerKind = "pen" | "touch" | "mouse";

export type PointerSample = {
  id: number;
  kind: PointerKind;
  /** Client coordinates. */
  x: number;
  y: number;
  /**
   * The contact patch in CSS pixels, where the platform reports one.
   *
   * Browsers report 1×1 when they have nothing better, which is why the palm
   * test only ever fires on a positively large value rather than on an absent
   * one. A fingertip lands around 10–30px; a palm or a forearm is far wider.
   */
  width?: number;
  height?: number;
};

export type Intent = "ink" | "pan" | "zoom" | "reject";

export type ArbiterState = {
  pointers: Map<number, PointerSample>;
};

/**
 * Above this, a contact is not a fingertip.
 *
 * Chosen wide on purpose. A false palm rejection means a pan that does not
 * happen, which the student notices and repeats; a false *acceptance* means ink
 * on their lecturer's slide, which they have to find and undo. The costs are
 * not symmetric, but neither is the evidence: this threshold is the one number
 * here that genuinely needs a real hand on real glass to tune, and it is called
 * out as such in the test plan.
 */
export const PALM_CONTACT_PX = 45;

export function emptyArbiter(): ArbiterState {
  return { pointers: new Map() };
}

export function isPalm(p: PointerSample): boolean {
  if (p.kind !== "touch") return false;
  const w = p.width ?? 0;
  const h = p.height ?? 0;
  return w > PALM_CONTACT_PX || h > PALM_CONTACT_PX;
}

export function addPointer(state: ArbiterState, p: PointerSample): ArbiterState {
  const pointers = new Map(state.pointers);
  pointers.set(p.id, p);
  return { pointers };
}

export function movePointer(state: ArbiterState, p: PointerSample): ArbiterState {
  if (!state.pointers.has(p.id)) return state;
  const pointers = new Map(state.pointers);
  // The contact patch grows as a palm settles, so a pointer that began as a
  // fingertip can become a palm mid-gesture. Keep the latest geometry.
  pointers.set(p.id, p);
  return { pointers };
}

export function removePointer(state: ArbiterState, id: number): ArbiterState {
  if (!state.pointers.has(id)) return state;
  const pointers = new Map(state.pointers);
  pointers.delete(id);
  return { pointers };
}

/** Every touch currently down that is not a palm. */
export function activeTouches(state: ArbiterState): PointerSample[] {
  return [...state.pointers.values()].filter((p) => p.kind === "touch" && !isPalm(p));
}

export function penIsDown(state: ArbiterState): boolean {
  return [...state.pointers.values()].some((p) => p.kind === "pen");
}

/**
 * What the pointer with this id currently means.
 *
 * Live rather than latched: a finger that is panning becomes half of a pinch
 * the moment a second finger lands, and is rejected the moment a stylus does.
 * Both are what a hand actually expects.
 */
export function intentFor(state: ArbiterState, id: number): Intent {
  const p = state.pointers.get(id);
  if (!p) return "reject";

  if (p.kind === "pen") return "ink";
  if (p.kind === "mouse") return "ink";

  if (isPalm(p)) return "reject";
  if (penIsDown(state)) return "reject";

  return activeTouches(state).length >= 2 ? "zoom" : "pan";
}

/** The midpoint of the touches driving a pinch. */
export function centroid(points: PointerSample[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

/** Distance between the two touches driving a pinch, in CSS pixels. */
export function spread(points: PointerSample[]): number {
  if (points.length < 2) return 0;
  const [a, b] = points;
  return Math.hypot(a.x - b.x, a.y - b.y);
}
