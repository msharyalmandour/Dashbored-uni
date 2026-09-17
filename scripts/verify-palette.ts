/**
 * The week grid's colours, checked rather than admired.
 *
 * This exists because of a bug that a code review could not have caught. The
 * grid was recoloured from indigo to the app's warm palette, and the labels
 * were left as they were. Warm hues are far lighter than the indigos they
 * replaced, so four of the six block types ended up carrying near-white text at
 * between 2.8:1 and 4.1:1 — text you can see in a screenshot and cannot read on
 * a laptop in a lecture hall. Every colour in the diff looked deliberate,
 * because every colour in the diff *was* deliberate. Only measuring found it.
 *
 * So the palette is now a thing with rules, and the rules are enforced here:
 *
 *   1. Every label clears 4.5:1 against BOTH ends of its own gradient. Both,
 *      because a two-hour block is tall enough that its second line sits over
 *      the dark end, and a 150° gradient puts a corner of every block there.
 *   2. The accent leads the luminance ladder. Classes are most of most weeks;
 *      if a lab or an activity is brighter than a class, the eye goes to the
 *      exception instead of the week. This is the rule that stops the palette
 *      drifting back into "every kind is a bit brighter than the last".
 *   3. Nothing in the grid is blue. The theme is black and orange; a blue block
 *      is the old theme growing back.
 *
 * Run: npx tsx scripts/verify-palette.ts
 */

import {
  SPAN_STYLE,
  POINT_STYLE,
  CALENDAR_TYPE_COLOR,
  CALENDAR_CHIP,
  CALENDAR_CELL,
} from "../src/lib/week-palette";

let failures = 0;
function check(label: string, ok: boolean, detail: string) {
  if (!ok) {
    failures++;
    console.error(`  FAIL  ${label}\n        ${detail}`);
  }
}

/** sRGB → relative luminance, per WCAG 2.1. */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The hex stops out of `linear-gradient(150deg,#AAA,#BBB)`. */
function stops(fill: string): string[] {
  const found = fill.match(/#[0-9A-Fa-f]{6}/g);
  if (!found || found.length < 2) throw new Error(`no gradient stops in ${fill}`);
  return found;
}

function hueOf(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  const deg =
    max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (deg * 60 + 360) % 360;
}

function saturation(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

console.log("Week palette\n");

// 1. Labels are readable over the whole block, not just its lightest corner.
for (const [kind, style] of Object.entries(SPAN_STYLE)) {
  for (const stop of stops(style.fill)) {
    const r = contrast(stop, style.text);
    check(
      `${kind} label on ${stop}`,
      r >= 4.5,
      `${style.text} on ${stop} is ${r.toFixed(2)}:1, needs 4.5:1`
    );
  }
}

// 2. The accent leads. Everything else sits at or below a class block, so the
//    ordinary week is what the eye lands on first.
const ladder = Object.entries(SPAN_STYLE).map(([kind, s]) => ({
  kind,
  lum: luminance(stops(s.fill)[0]),
}));
const classLum = ladder.find((x) => x.kind === "CLASS")!.lum;
for (const { kind, lum } of ladder) {
  check(
    `${kind} sits at or below CLASS`,
    lum <= classLum + 1e-9,
    `${kind} is ${lum.toFixed(3)} against CLASS at ${classLum.toFixed(3)} — it would out-shout the accent`
  );
}

// 3. No blue grows back. Near-greys are exempt: they have no hue to speak of.
const all = [
  ...Object.entries(SPAN_STYLE).flatMap(([kind, s]) =>
    [...stops(s.fill), s.glow, s.text].map((hex) => [`SPAN_STYLE.${kind}`, hex] as const)
  ),
  ...Object.entries(POINT_STYLE).map(([kind, hex]) => [`POINT_STYLE.${kind}`, hex] as const),
];
for (const [where, hex] of all) {
  const hue = hueOf(hex);
  const blue = saturation(hex) > 0.15 && hue >= 190 && hue <= 300;
  check(`${where} is not blue`, !blue, `${hex} is at hue ${hue.toFixed(0)}°`);
}

// 4. Two kinds that look the same are one kind with extra steps.
const seen = new Map<string, string>();
for (const [kind, s] of Object.entries(SPAN_STYLE)) {
  const head = stops(s.fill)[0].toUpperCase();
  check(
    `${kind} has its own colour`,
    !seen.has(head),
    `${kind} and ${seen.get(head)} both start at ${head}`
  );
  seen.set(head, kind);
}

// 5. The month view and the week grid are the same week. Every colour the month
//    view and its legend show has to come out of the grid's own palette — this
//    is the check that would have caught the legend still showing last week's
//    orange for a class after the grid had moved on.
const grid = new Set<string>([
  ...Object.values(SPAN_STYLE).flatMap((s) => stops(s.fill).map((h) => h.toUpperCase())),
  ...Object.values(POINT_STYLE).map((h) => h.toUpperCase()),
]);
for (const [type, hex] of Object.entries(CALENDAR_TYPE_COLOR)) {
  check(
    `calendar ${type} comes from the grid`,
    grid.has(hex.toUpperCase()),
    `${hex} is not a colour the week grid uses — the legend and the grid have drifted apart`
  );
}

// A legend with two identical swatches is a legend that explains nothing.
const swatches = new Map<string, string>();
for (const [type, hex] of Object.entries(CALENDAR_TYPE_COLOR)) {
  const key = hex.toUpperCase();
  check(
    `calendar ${type} is distinguishable`,
    !swatches.has(key),
    `${type} and ${swatches.get(key)} are both ${hex} in the legend`
  );
  swatches.set(key, type);
}

// 7. Month-view chips. Two things have to hold, and the old chip broke both:
//    the ground has to be opaque (it is composited from the cell's own fill, so
//    it cannot be a tint over a photograph), and the label has to be readable on
//    that ground rather than merely the same colour as it.
function composite(fg: string, bg: string, alpha: number): string {
  const f = [0, 2, 4].map((i) => parseInt(fg.replace("#", "").slice(i, i + 2), 16));
  const b = [0, 2, 4].map((i) => parseInt(bg.replace("#", "").slice(i, i + 2), 16));
  return (
    "#" +
    f
      .map((c, i) => Math.round(alpha * c + (1 - alpha) * b[i]).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

for (const [type, chip] of Object.entries(CALENDAR_CHIP)) {
  const r = contrast(chip.bg, chip.ink);
  check(
    `calendar ${type} chip label`,
    r >= 4.5,
    `${chip.ink} on ${chip.bg} is ${r.toFixed(2)}:1, needs 4.5:1`
  );

  // The ground must be this category's own colour sitting on the cell — not a
  // free-hand hex that happens to look about right.
  const source = CALENDAR_TYPE_COLOR[type as keyof typeof CALENDAR_TYPE_COLOR];
  const expected = composite(source, CALENDAR_CELL, 0.32);
  check(
    `calendar ${type} chip ground is derived`,
    chip.bg.toUpperCase() === expected,
    `${chip.bg} is not ${source} at 32% over ${CALENDAR_CELL} (that would be ${expected})`
  );

  // A chip you can barely tell from the cell it sits in is not a chip.
  const lift = contrast(chip.bg, CALENDAR_CELL);
  check(
    `calendar ${type} chip is visible against the cell`,
    lift >= 1.25,
    `${chip.bg} against ${CALENDAR_CELL} is only ${lift.toFixed(2)}:1`
  );
}

const total = Object.keys(SPAN_STYLE).length;
if (failures) {
  console.error(`\n${failures} failing check(s) across ${total} session kinds.`);
  process.exit(1);
}
console.log(
  `  ${total} session kinds: every label clears 4.5:1 at both ends of its gradient,\n` +
    `  the accent leads the ladder, and nothing in the grid is blue.\n` +
    `  The month view's ${Object.keys(CALENDAR_TYPE_COLOR).length} categories draw from that same set, and each of its\n` +
    `  chips is opaque and carries a label at 4.5:1 or better.`
);
