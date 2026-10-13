/**
 * THE HEADINGS MUST CLEAR THEIR OWN INK.
 *
 * Measured in Chromium on real strings in both languages, twice — once when a
 * display face was bound to `--font-display`, and again on 2026-10-13 when it
 * was removed and headings went back to IBM Plex:
 *
 *   Readex Pro       ink 1.25x the font-size
 *   IBM Plex Sans    ink 1.30x the font-size
 *
 * Which is the opposite of the obvious guess: returning to ONE family made the
 * headings need MORE room, not less, and left the Latin display sitting at
 * exactly 0px of clearance until the floors below were raised.
 *
 * Rendered, a wrapped heading had its two lines meeting in the middle and the
 * hairline under a section sat on the descenders of the title above it. The
 * page did not look broken; it looked badly kerned, which is the kind of thing
 * that gets filed as "the design feels cheap" and never as a bug.
 *
 * The ink box is 1.25x the font-size for this face, so a unitless line-height
 * below that cannot contain its own text at any size. This holds the floor in
 * the stylesheet, because the failure is invisible to tsc, to eslint, to the
 * build, and to every other check in this directory — and because the number
 * it protects is the one a designer is most tempted to tighten by eye.
 *
 * If the display face is ever changed, re-measure and move INK_RATIO. Do not
 * move it to make a check pass.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Ink height ÷ font-size for IBM Plex Sans, measured in Chromium. */
const INK_RATIO = 1.3;
/** Latin needs the ink to fit, with a little room rather than none. */
const MIN_LATIN = 1.34;
/** Arabic needs that plus room for hamza and the vowel marks above it. */
const MIN_ARABIC = 1.44;

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(error as Error).message.split("\n")[0]}`);
  }
}

console.log("Headings, and the space they need");
console.log("");

/** The line-height declared in the rule for `selector`, as a number. */
function lineHeightOf(selector: string): number {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(rule, `no rule for "${selector}" — the stylesheet moved under this check`);
  const declared = /line-height:\s*([0-9.]+)\s*;/.exec(rule[1]);
  assert.ok(declared, `"${selector}" declares no unitless line-height`);
  return Number.parseFloat(declared[1]);
}

check("THERE IS ONE ARABIC FAMILY, NOT TWO", () => {
  /* Section 8 of the project rules asks for a single Arabic font — the
     register that separates a heading from body copy is weight and size, not
     a second typeface. A display family was added here once and removed; this
     is what stops it coming back without the decision being made again. */
  const display = /--font-display:\s*([^;]+);/.exec(css);
  const body = /--font-sans:\s*([^;]+);/.exec(css);
  assert.ok(display, "--font-display is not declared at all");
  assert.ok(body, "--font-sans is not declared at all");
  assert.equal(
    display[1].trim(),
    body[1].trim(),
    "the headings are set in a different family from the body"
  );
});

check("INK RATIO IS THE FLOOR, AND BOTH MINIMUMS CLEAR IT", () => {
  assert.ok(
    MIN_LATIN >= INK_RATIO,
    `the Latin floor ${MIN_LATIN} is below the measured ink ratio ${INK_RATIO}`
  );
  assert.ok(
    MIN_ARABIC >= MIN_LATIN,
    "Arabic cannot need less room than Latin in the same face"
  );
});

for (const selector of [".t-display", ".t-title"]) {
  check(`${selector} clears its ink in Latin`, () => {
    const lh = lineHeightOf(selector);
    assert.ok(
      lh >= MIN_LATIN,
      `line-height ${lh} is under ${MIN_LATIN}; the ink is ${INK_RATIO}x the font-size, so it overflows`
    );
  });
}

for (const selector of [":lang(ar) .t-display", ":lang(ar) .t-title"]) {
  check(`${selector} clears its ink in Arabic`, () => {
    const lh = lineHeightOf(selector);
    assert.ok(
      lh >= MIN_ARABIC,
      `line-height ${lh} is under ${MIN_ARABIC}; Arabic marks ride above the ink box`
    );
  });
}

check("the Arabic override is never tighter than the rule it overrides", () => {
  for (const base of [".t-display", ".t-title"]) {
    assert.ok(
      lineHeightOf(`:lang(ar) ${base}`) >= lineHeightOf(base),
      `:lang(ar) ${base} is tighter than ${base}, which inverts the script's needs`
    );
  }
});

console.log("");
console.log(
  failures === 0
    ? "Every heading has room for its own descenders."
    : `${failures} check(s) failed.`
);
process.exit(failures === 0 ? 0 : 1);
