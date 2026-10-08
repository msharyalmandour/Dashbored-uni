/**
 * Colour arithmetic, in one place.
 *
 * These four functions lived inside scripts/verify-palette.ts, where they
 * could only ever check a palette that was already hardcoded. The moment app
 * code needed to decide a colour at runtime — which course accent to draw for
 * a course whose stored colour predates the current palette — the choice was
 * to copy them or to move them. Copies of a colour-space conversion drift
 * silently and in a direction nobody can see, so they moved, and the verify
 * script imports them from here.
 *
 * `luminance` and `contrast` are WCAG 2.x: sRGB linearised, weighted, and the
 * ratio taken with the +0.05 flare term. `oklab` is Björn Ottosson's matrix.
 * `deltaE` is plain Euclidean distance in OKLab, which is the point of that
 * space — it is near enough perceptually uniform that a straight line means
 * "how different these look", where the same distance in hue degrees does not
 * (a near-neutral and a saturated orange can share a hue angle and look
 * nothing alike).
 */

/** `#A1B2C3` or `A1B2C3` as three channels in 0..1, linearised. */
function channels(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`not a six-digit hex colour: ${JSON.stringify(hex)}`);
  }
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = Number.parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return [r, g, b];
}

/** Whether a string is a colour these functions can read at all. */
export function isHex(value: string | null | undefined): value is string {
  return typeof value === "string" && /^#?[0-9a-fA-F]{6}$/.test(value.trim());
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. Order of the arguments does not matter. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** OKLab, as [L, a, b]. */
export function oklab(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** How different two colours look. Euclidean distance in OKLab. */
export function deltaE(a: string, b: string): number {
  const A = oklab(a);
  const B = oklab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

/** Chroma — enough to tell a real hue from a near-neutral. */
export function chroma(hex: string): number {
  const [, a, b] = oklab(hex);
  return Math.hypot(a, b);
}

/** Hue angle in degrees, 0..360. Meaningless at very low chroma. */
export function hue(hex: string): number {
  const [, a, b] = oklab(hex);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
}
