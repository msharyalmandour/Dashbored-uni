/**
 * The six scenes, measured against the photograph they are actually painted
 * over.
 *
 * The scrim is the one layer in the environment that is load-bearing. It is
 * what guarantees that white text sitting directly on the picture — a
 * greeting, a page title, the question on the Home screen — is readable, and
 * the failure mode when it is wrong is specific and nasty: it looks fine on
 * the laptop it was tuned on, and it is unreadable on an iPad in daylight,
 * because the part of the photograph the text landed on happened to be bark
 * rather than shadow.
 *
 * Six scenes multiply that risk by six. Each one declares its own scrim, its
 * own grade and its own key light, and a key light is a layer that makes the
 * picture *brighter*. So this does not eyeball them. It decodes the real
 * photograph, takes the brightest pixel in every row, composites that row's
 * grade, its key light at full strength, and its scrim on top, and asserts the
 * result still clears 4.5:1 against the text that sits on it.
 *
 * Every simplification in here is deliberately in the pessimistic direction:
 *
 *   - The brightest pixel of a row stands for the whole row. Text can land on
 *     it, so it has to survive it.
 *   - The key light is applied at its peak alpha everywhere, although it is a
 *     radial gradient that reaches that alpha in one place.
 *   - The depth wash and the vignette are skipped entirely. Both only darken,
 *     so leaving them out can only make the answer worse than the truth.
 *   - Where a gradient stop has to be interpolated, the stop that darkens
 *     *less* is taken.
 *
 * So a pass here means the real screen passes with room to spare. A failure is
 * real.
 *
 * Run: npx tsx scripts/verify-scene.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { SCENES, SCENE_IMAGE, sceneFor, type Scene } from "../src/lib/scene";

let failures = 0;
function check(label: string, ok: boolean, detail: string) {
  if (!ok) {
    failures++;
    console.error(`  FAIL  ${label}\n        ${detail}`);
  }
}

/* ---------------------------------------------------------------- colour --- */

/** sRGB 0-255 → WCAG 2.1 relative luminance. */
function luminance(rgb: [number, number, number]): number {
  const ch = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a: number, b: number): number {
  const [hi, lo] = [a, b].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * `oklch(6% 0.012 48 / 82%)` → sRGB 0-255 plus alpha.
 *
 * OKLCH → OKLab → LMS → linear sRGB → sRGB, per the CSS Color 4 definition.
 * Out-of-gamut channels are clamped, which is what a browser does too.
 */
function parseOklch(text: string): { rgb: [number, number, number]; a: number } {
  const m = text.match(
    /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)(%?)\s*)?\)/
  );
  if (!m) throw new Error(`not an oklch() colour: ${text}`);

  // Lightness and alpha each carry their own unit. Reading one from the
  // presence of a percent sign anywhere in the string is the bug that makes a
  // scrim written as oklch(0.06 ... / 82%) come out a hundred times too dark
  // and pass a contrast check it should fail.
  const L = m[2] === "%" ? Number(m[1]) / 100 : Number(m[1]);
  const C = Number(m[3]);
  const H = (Number(m[4]) * Math.PI) / 180;
  const a = m[5] === undefined ? 1 : m[6] === "%" ? Number(m[5]) / 100 : Number(m[5]);

  const oa = C * Math.cos(H);
  const ob = C * Math.sin(H);

  const l_ = L + 0.3963377774 * oa + 0.2158037573 * ob;
  const m_ = L - 0.1055613458 * oa - 0.0638541728 * ob;
  const s_ = L - 0.0894841775 * oa - 1.291485548 * ob;

  const l = l_ ** 3;
  const mm = m_ ** 3;
  const s = s_ ** 3;

  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];

  const rgb = lin.map((v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, c)) * 255);
  }) as [number, number, number];

  return { rgb, a };
}

/** Source-over, in gamma-encoded sRGB, which is what the compositor does. */
function over(
  src: { rgb: [number, number, number]; a: number },
  dst: [number, number, number]
): [number, number, number] {
  return [0, 1, 2].map((i) => src.rgb[i] * src.a + dst[i] * (1 - src.a)) as [
    number,
    number,
    number,
  ];
}

/* ------------------------------------------------------------------- css --- */

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/**
 * The value of one custom property inside one selector block.
 *
 * Deliberately not a CSS parser: the file is ours, the shape is known, and a
 * dependency that parses CSS to read six variables would be a worse trade than
 * a brace-counting scan that fails loudly.
 */
function propertyIn(selector: string, property: string): string {
  const at = CSS.indexOf(selector);
  if (at < 0) throw new Error(`selector not found: ${selector}`);
  let depth = 0;
  let i = CSS.indexOf("{", at);
  const start = i;
  for (; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    else if (CSS[i] === "}" && --depth === 0) break;
  }
  const block = CSS.slice(start, i);
  const m = block.match(new RegExp(`${property}\\s*:([^;]+);`));
  if (!m) throw new Error(`${property} not found in ${selector}`);
  return m[1].trim();
}

function selectorFor(scene: Scene): string {
  // The forest is the default, so it lives in :root rather than in a block of
  // its own — a route with no scene still has to get a complete environment.
  return scene === "forest" ? ":root {" : `[data-scene="${scene}"]`;
}

/** A `rgb(r g b / a%)` stop, as the same shape parseOklch returns. */
function parseRgb(s: string): { rgb: [number, number, number]; a: number } {
  const m = s.match(/rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)%\s*)?\)/);
  if (!m) throw new Error(`not an rgb() stop: ${s}`);
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : Number(m[4]) / 100 };
}

/**
 * Stops of a vertical linear-gradient, as { at: 0-1, colour }.
 *
 * Both notations, because the scenes are no longer all written in one. The six
 * photographed scenes are oklch — they were tuned against a photograph's
 * measured luminance and the perceptual space is what made that tuning
 * transferable. `command` is sRGB hex and rgb(), because it is not grading a
 * photograph: it is the brief's palette, stated in the brief's own values, and
 * re-deriving #050505 into oklch would only add a place for it to drift.
 */
function verticalStops(value: string): { at: number; c: { rgb: [number, number, number]; a: number } }[] {
  const found = value.match(/(?:oklch|rgb)\([^)]*\)\s*[\d.]+%/g);
  if (!found) throw new Error(`no positioned stops in: ${value.slice(0, 60)}`);
  return found.map((s) => {
    const pos = s.match(/([\d.]+)%$/);
    return { at: Number(pos![1]) / 100, c: s.startsWith("rgb") ? parseRgb(s) : parseOklch(s) };
  });
}

/** The stop that protects LEAST at this height — the pessimistic read. */
function weakestAt(stops: { at: number; c: { rgb: [number, number, number]; a: number } }[], y: number) {
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (y >= stops[i].at && y <= stops[i + 1].at) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  return lo.c.a <= hi.c.a ? lo.c : hi.c;
}

/** The single strongest alpha anywhere in a layer — used for the key light. */
function peakAlpha(value: string): { rgb: [number, number, number]; a: number } | null {
  const found = value.match(/oklch\([^)]*\/[^)]*\)/g);
  if (!found) return null;
  let worst: { rgb: [number, number, number]; a: number } | null = null;
  for (const f of found) {
    const c = parseOklch(f);
    if (!worst || c.a > worst.a) worst = c;
  }
  return worst;
}

/* ------------------------------------------------------------- the photo --- */

/**
 * The brightest pixel in each of 40 horizontal bands of the real photograph.
 *
 * Bands rather than rows because the scrim is a six-stop ramp and forty
 * samples resolve it far past the point where another sample changes an
 * answer; brightest rather than mean because text lands on pixels, not on
 * averages.
 */
async function photoBands(path: string, bands = 40): Promise<number[]> {
  const { data, info } = await sharp(join(process.cwd(), "public", path.replace(/^\//, "")))
    .resize({ width: 240 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out: number[] = [];
  for (let b = 0; b < bands; b++) {
    const y0 = Math.floor((b / bands) * info.height);
    const y1 = Math.max(y0 + 1, Math.floor(((b + 1) / bands) * info.height));
    let brightest = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        const l = luminance([data[i], data[i + 1], data[i + 2]]);
        if (l > brightest) brightest = l;
      }
    }
    out.push(brightest);
  }
  return out;
}

/**
 * The per-band "photograph" for a scene that has no photograph.
 *
 * `command` is black canvas plus orange light trails, so the thing text can
 * end up sitting on is the page colour with a trail composited over it. That
 * is still a contrast question and it is still answerable, so this computes it
 * rather than letting the scene skip the check — a scene excused from the
 * assertion is a scene that ships unreadable text with a green test.
 *
 * Worst case per band, deliberately: every trail is treated as if its peak
 * alpha lands in every band it could reach. The real gradients are ellipses
 * that fall off, so this over-estimates brightness, which is the direction an
 * assertion should err in.
 */
function trailBands(trails: string, ground: [number, number, number], bands = 40): number[] {
  /* Each layer is `radial-gradient(<size> at <x>% <y>%, rgb(r g b / a%), ...)`.
     Only the centre's y and the peak alpha matter for a vertical band model. */
  const layers = [...trails.matchAll(/at\s+[\d.]+%\s+(-?[\d.]+)%[^)]*?,\s*rgb\(([^)]*?)\/\s*([\d.]+)%\s*\)/g)];
  if (layers.length === 0) {
    throw new Error("trailBands: parsed no layers out of --env-trails; the format changed");
  }

  const out: number[] = [];
  for (let b = 0; b < bands; b++) {
    const y = ((b + 0.5) / bands) * 100;
    let [r, g, bl] = ground;
    for (const [, cy, rgb, alpha] of layers) {
      /* Reach is generous on purpose: an ellipse at 40% height with its centre
         at 6% still puts light well down the page. Anything within 60 points
         of the centre counts at full strength. */
      if (Math.abs(Number(cy) - y) > 60) continue;
      const [lr, lg, lb] = rgb.trim().split(/\s+/).map(Number);
      const a = Number(alpha) / 100;
      r = lr * a + r * (1 - a);
      g = lg * a + g * (1 - a);
      bl = lb * a + bl * (1 - a);
    }
    out.push(luminance([r, g, bl]));
  }
  return out;
}

/** sRGB for a luminance, as a neutral — enough to composite against. */
function greyFor(l: number): [number, number, number] {
  const c = l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  const v = Math.round(Math.min(1, Math.max(0, c)) * 255);
  return [v, v, v];
}

/* ------------------------------------------------------------------ runs --- */

/** `.on-env` — the near-white every piece of text on the picture is set in. */
const ON_ENV = parseOklch("oklch(98% 0.004 55)").rgb;
const ON_ENV_L = luminance(ON_ENV);
const FLOOR = 4.5;

async function main() {
  console.log("Scenes\n");

  /* 1. Every route the app has resolves, and the deeper one wins. */
  const cases: [string, Scene][] = [
    ["/", "command"],
    ["/today", "forest"],
    ["/review", "forest"],
    ["/tasks", "forest"],
    ["/inbox", "forest"],
    ["/videos", "forest"],
    ["/knowledge-gaps", "forest"],
    ["/analytics", "forest"],
    ["/time", "dawn"],
    ["/calendar", "dawn"],
    ["/academics", "hall"],
    ["/subjects/cm5x9k2p0000abcd", "hall"],
    ["/lectures/cm5x9k2p0000abcd", "hall"],
    ["/lectures/cm5x9k2p0000abcd/slides", "night"],
    ["/lectures/cm5x9k2p0000abcd/slides/cm5zzz1110000wxyz", "night"],
    ["/clinical", "ward"],
    ["/flashcards", "desk"],
    ["/problems", "desk"],
    ["/mistakes", "desk"],
    ["/focus", "desk"],
    ["/nothing-like-this", "forest"],
  ];
  for (const [path, want] of cases) {
    const got = sceneFor(path);
    check(`route ${path}`, got === want, `expected ${want}, got ${got}`);
  }

  // The one that a plain prefix table gets wrong: an id sits between
  // /lectures and /slides, so the deeper rule is only reachable if ids are
  // stripped first.
  check(
    "a slide route outranks its lecture",
    sceneFor("/lectures/abc123/slides/def456") === "night" &&
      sceneFor("/lectures/abc123") === "hall",
    "the id between the two segments hid the deeper rule"
  );

  /* 2. Every scene declares a complete environment. */
  for (const scene of SCENES) {
    const sel = selectorFor(scene);
    for (const prop of ["--env-scrim", "--env-key", "--env-vignette", "--env-tint"]) {
      let ok = true;
      try {
        propertyIn(sel, prop);
      } catch {
        ok = scene === "forest" && prop === "--env-vignette" ? false : false;
      }
      check(`${scene} declares ${prop}`, ok, `missing from ${sel}`);
    }
  }

  /* 3. The contrast floor, over the real photograph. */
  const bandsByScene = new Map<string, number[]>();
  const bandsByImage = new Map<string, number[]>();
  for (const scene of SCENES) {
    const img = SCENE_IMAGE[scene];
    if (img === null) {
      /* No photograph: the ground is --background and the trails are what can
         brighten it. Both are read out of the stylesheet, so the assertion
         tracks the declared values rather than a copy of them. */
      const trails = propertyIn(selectorFor(scene), "--env-trails");
      bandsByScene.set(scene, trailBands(trails, [5, 5, 5]));
      continue;
    }
    if (!bandsByImage.has(img)) bandsByImage.set(img, await photoBands(img));
    bandsByScene.set(scene, bandsByImage.get(img)!);
  }

  for (const scene of SCENES) {
    const sel = selectorFor(scene);
    const scrim = verticalStops(propertyIn(sel, "--env-scrim"));
    const key = peakAlpha(propertyIn(sel, "--env-key"));
    let grade: ReturnType<typeof verticalStops> | null = null;
    try {
      const raw = propertyIn(sel, "--env-grade");
      if (raw.includes("oklch")) grade = verticalStops(raw.replace(/oklch\(([^)]*)\)(?!\s*[\d.]+%)/g, "oklch($1) 0%"));
    } catch {
      grade = null;
    }

    const bands = bandsByScene.get(scene)!;
    let worst = Infinity;
    let worstAt = 0;

    bands.forEach((bandLuminance, i) => {
      const y = (i + 0.5) / bands.length;
      let px = greyFor(bandLuminance);

      // Grade, then scrim, then the key light — the order the backdrop paints
      // them in, and the key is last on purpose. Under the scrim a light
      // source is crushed by the very layer that protects the text, so the
      // scene ends up with no light in it; above the scrim it is visible, and
      // it is also the one layer that can undo the protection. Which is
      // exactly why it is measured here, at its peak alpha, rather than
      // trusted.
      if (grade) px = over(weakestAt(grade, y), px);
      px = over(weakestAt(scrim, y), px);
      if (key) px = over(key, px);

      const ratio = contrast(ON_ENV_L, luminance(px));
      if (ratio < worst) {
        worst = ratio;
        worstAt = y;
      }
    });

    check(
      `${scene}: text on the picture clears ${FLOOR}:1`,
      worst >= FLOOR,
      `worst band ${worst.toFixed(2)}:1 at ${Math.round(worstAt * 100)}% down the screen`
    );
    console.log(
      `  ${worst >= FLOOR ? "ok  " : "FAIL"}  ${scene.padEnd(7)} worst ${worst.toFixed(2)}:1 ` +
        `(at ${Math.round(worstAt * 100)}% down)`
    );
  }

  console.log("");
  if (failures) {
    console.error(`${failures} failure${failures === 1 ? "" : "s"}.`);
    process.exit(1);
  }
  console.log("All scene checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
