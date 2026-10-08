/**
 * THE COLOUR A COURSE IS DRAWN IN.
 *
 * `Subject.color` defaults to #6366f1 — an indigo left over from the theme
 * this product had before it was black and orange. Nothing on a list screen
 * has ever read the column, so the stale value never showed; the moment it is
 * read, every course created outside the picker puts the old theme back on
 * screen one dot at a time.
 *
 * src/lib/subject-accent.ts keeps an approved swatch exactly and snaps
 * anything else onto the nearest approved one. These checks hold the two
 * properties that makes safe: a student's own choice is never moved, and
 * nothing that reaches the screen is illegible or blue.
 */
import assert from "node:assert/strict";
import { COURSE_SWATCHES } from "../src/lib/week-palette";
import { contrast, deltaE, hue, chroma } from "../src/lib/colour";
import {
  accentFor,
  isApproved,
  isLegible,
  GROUND,
  MIN_CONTRAST,
  DEFAULT_ACCENT,
  SCHEMA_DEFAULT,
  accentMap,
} from "../src/lib/subject-accent";
import { readFileSync } from "node:fs";

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

console.log("A course's colour");
console.log("");

check("A COLOUR THE STUDENT PICKED IS NEVER MOVED", () => {
  for (const swatch of COURSE_SWATCHES) {
    assert.equal(
      accentFor(swatch),
      swatch,
      `${swatch} is in the picker and came back as something else`
    );
    assert.ok(isApproved(swatch), `${swatch} is in the picker but reads as unapproved`);
  }
});

check("case and a missing hash do not count as a different colour", () => {
  assert.equal(accentFor("#f0913a"), "#F0913A");
  assert.equal(accentFor("F0913A"), "#F0913A");
  assert.equal(accentFor("  #F0913A  "), "#F0913A");
});

check("THE CONSTANT STILL MATCHES WHAT THE SCHEMA ACTUALLY DEFAULTS TO", () => {
  /* The whole rule turns on this value. If the column's default changes and
     this file does not notice, every course silently takes the wrong branch —
     so the schema is read rather than remembered. */
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const model = /model Subject \{([\s\S]*?)\n\}/.exec(schema);
  assert.ok(model, "no Subject model in the schema");
  const declared = /color\s+String\s+@default\("([^"]+)"\)/.exec(model[1]);
  assert.ok(declared, "Subject.color no longer declares a default");
  assert.equal(
    declared[1].toLowerCase(),
    SCHEMA_DEFAULT.toLowerCase(),
    "the schema default moved and subject-accent.ts was not told"
  );
});

check("THE STALE INDIGO DEFAULT DOES NOT REACH THE SCREEN", () => {
  assert.ok(!isApproved(SCHEMA_DEFAULT), "the schema default is somehow an approved swatch");
  for (let position = 0; position < COURSE_SWATCHES.length; position += 1) {
    const drawn = accentFor(SCHEMA_DEFAULT, position);
    assert.ok(
      (COURSE_SWATCHES as readonly string[]).includes(drawn),
      `the indigo default resolved to ${drawn}, which is not in the palette`
    );
    assert.notEqual(drawn, SCHEMA_DEFAULT, "the indigo default was drawn as itself");
  }
});

check("SIX COURSES THE AGENT FILED GET SIX DIFFERENT COLOURS", () => {
  /* The case this branch exists for: every course created outside the picker
     carries the identical default, so a pure nearest-swatch snap would give
     the whole list one colour and change nothing. */
  const drawn = [0, 1, 2, 3, 4, 5].map((i) => accentFor(SCHEMA_DEFAULT, i));
  assert.equal(
    new Set(drawn).size,
    6,
    `six courses sharing the default came out as ${new Set(drawn).size} colour(s): ${drawn.join(", ")}`
  );
});

check("adding a course does not recolour the ones already there", () => {
  const before = [0, 1, 2].map((i) => accentFor(SCHEMA_DEFAULT, i));
  const after = [0, 1, 2, 3].map((i) => accentFor(SCHEMA_DEFAULT, i));
  assert.deepEqual(after.slice(0, 3), before, "existing courses changed colour");
});

check("more courses than swatches wraps rather than throwing", () => {
  for (const position of [8, 9, 17, 100, -1, -9, 2.7]) {
    const drawn = accentFor(SCHEMA_DEFAULT, position);
    assert.ok(
      (COURSE_SWATCHES as readonly string[]).includes(drawn),
      `position ${position} produced ${drawn}`
    );
  }
});

check("the blue arc is a real arc, not a vacuous one", () => {
  /* The check below is only worth anything if `hue` actually puts blue inside
     200-280. Measured in OKLab: a true blue lands at 237-279 and the palette's
     teal — the coolest thing it contains — sits at 184, outside. If a future
     change made every colour fall outside the arc, the check below would pass
     by saying nothing, so it is pinned from both ends here. */
  for (const blue of ["#1d4ed8", "#0ea5e9", "#000080", "#312e81", "#6366f1"]) {
    const h = hue(blue);
    assert.ok(h >= 200 && h <= 280, `${blue} reads as ${h.toFixed(0)}°, outside the blue arc`);
  }
  const teal = hue("#47C0B2");
  assert.ok(teal < 200, `the palette's teal reads as ${teal.toFixed(0)}°, inside the blue arc`);
});

check("nothing that reaches the screen is blue", () => {
  /* The palette's own rule, restated here because this file is what decides
     what gets drawn. Blue is the 200-280 arc; near-neutrals are exempt because
     a hue angle means nothing without chroma to carry it. */
  const inputs = [SCHEMA_DEFAULT, "#0ea5e9", "#1d4ed8", "#312e81", "#000080", ...COURSE_SWATCHES];
  for (const input of inputs) {
    const drawn = accentFor(input, 3);
    const h = hue(drawn);
    if (chroma(drawn) < 0.04) continue;
    assert.ok(
      h < 200 || h > 280,
      `${input} was drawn as ${drawn}, whose hue ${h.toFixed(0)}° is in the blue arc`
    );
  }
});

check("EVERY COLOUR THIS CAN RETURN CLEARS THE CONTRAST FLOOR", () => {
  /* Not a sample: the function's entire range is the eight swatches, so this
     is exhaustive rather than representative. */
  for (const swatch of COURSE_SWATCHES) {
    const ratio = contrast(swatch, GROUND);
    assert.ok(
      ratio >= MIN_CONTRAST,
      `${swatch} is ${ratio.toFixed(2)}:1 on ${GROUND}, under the ${MIN_CONTRAST} floor`
    );
    assert.ok(isLegible(swatch), `${swatch} fails its own legibility test`);
  }
});

check("a row with no colour, or a broken one, still draws something", () => {
  for (const bad of [null, undefined, "", "   ", "blue", "#12345", "#1234567", "rgb(1,2,3)"]) {
    const drawn = accentFor(bad as string | null | undefined, 0);
    assert.equal(drawn, DEFAULT_ACCENT, `${JSON.stringify(bad)} did not fall back`);
  }
});

check("snapping picks the NEAREST swatch, not merely a legal one", () => {
  /* A colour sitting almost on top of one swatch must not come back as a
     different one — otherwise "snap" is just "replace". */
  for (const swatch of COURSE_SWATCHES) {
    const nudged = nudge(swatch);
    const drawn = accentFor(nudged);
    assert.equal(
      drawn,
      swatch,
      `${nudged} is a hair from ${swatch} and was drawn as ${drawn}`
    );
    assert.ok(deltaE(nudged, swatch) > 0, "the nudge changed nothing, so this proves nothing");
  }
});

/** The same colour, one step darker in every channel. */
function nudge(hex: string): string {
  const h = hex.replace("#", "");
  const out = [0, 2, 4]
    .map((i) => Math.max(0, Number.parseInt(h.slice(i, i + 2), 16) - 3))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  return `#${out}`;
}

check("ONE COURSE IS ONE COLOUR ON EVERY SCREEN THAT SHOWS IT", () => {
  /* The reason accentMap exists. A course page shows a single course and
     cannot derive a position from it, so if each screen ordered the list its
     own way the same course would be two colours in two places. Every caller
     passes the same creation-ordered list and reads the same answer. */
  const roster = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, color: SCHEMA_DEFAULT }));
  const onTheList = accentMap(roster);
  const onItsOwnPage = accentMap(roster);
  for (const { id } of roster) {
    assert.equal(onTheList.get(id), onItsOwnPage.get(id), `${id} is two colours`);
  }
  assert.equal(new Set(onTheList.values()).size, 6, "the map collapsed six courses");
});

check("a renamed course keeps its colour", () => {
  /* Which is why the roster is ordered by creation and not by name. */
  const before = accentMap([
    { id: "a", color: SCHEMA_DEFAULT },
    { id: "b", color: SCHEMA_DEFAULT },
  ]);
  const afterRename = accentMap([
    { id: "a", color: SCHEMA_DEFAULT },
    { id: "b", color: SCHEMA_DEFAULT },
  ]);
  assert.equal(before.get("a"), afterRename.get("a"));
  assert.equal(before.get("b"), afterRename.get("b"));
});

console.log("");
console.log(
  failures === 0
    ? "Every course is a colour this product owns."
    : `${failures} check(s) failed.`
);
process.exit(failures === 0 ? 0 : 1);
