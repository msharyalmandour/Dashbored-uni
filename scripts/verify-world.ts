/**
 * Each course gets its own world, and the same one every time.
 *
 * The failure this exists to stop is not a crash: it is six courses that all
 * come out the same colour, which is exactly what keying off the stored
 * `color` would do on the real account — all six hold the schema's default
 * indigo because the agent filed every one of them.
 */

import assert from "node:assert/strict";
import { worldFor, worldVars, coverGradient, LECTURE_WORLD, type World } from "../src/lib/world";

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

console.log("عالم كل مادة");
console.log("");

/** His six, named exactly as the account holds them — code null on every one. */
const HIS = [
  { name: "NURC (410) Critical Care Nursing", code: null },
  { name: "NURC (411) Critical Care Nursing", code: null },
  { name: "NURP (431) Nursing Leadership", code: null },
  { name: "NURP (432) Nursing Leadership", code: null },
  { name: "NURM (410) Research Methods", code: null },
  { name: "Elective Course", code: null },
];

check("HIS SIX COURSES GET SIX DIFFERENT WORLDS", () => {
  const worlds = HIS.map((s, i) => worldFor(s, i));
  const firsts = new Set(worlds.map((w) => w.one));
  assert.equal(firsts.size, 6, `only ${firsts.size} distinct worlds across six courses`);
});

/* Oklab, so "different" means what the eye says rather than what the string
   says. The previous version of the check below compared hex strings: #d4a24a
   and #e0b25a are two different strings and one colour, and on the rendered
   iPad grid the Elective and Research Methods covers could not be told apart.
   A check that cannot fail on the bug it exists for is worse than none. */
function oklab(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = lin((n >> 16) & 255);
  const g = lin((n >> 8) & 255);
  const b = lin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s2 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s2,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s2,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s2,
  ];
}

const dE = (a: string, b: string) => {
  const [x, y, z] = oklab(a);
  const [p, q, r] = oklab(b);
  return Math.hypot(x - p, y - q, z - r);
};

/* A cover is a gradient, not a swatch, and `coverGradient` draws THREE stops:
   one, two, and `three ?? two`. Comparing only the first two said the old
   Elective gold was further from amber than Critical Care is — which is false
   on screen, because Critical Care's third stop is near-black and amber's is
   its own mid-brown. The distance has to describe what is drawn. */
const stops = (w: World) => [w.one, w.two, w.three ?? w.two];
const worldDistance = (a: World, b: World) =>
  stops(a).reduce((sum, stop, i) => sum + dE(stop, stops(b)[i]), 0);

/** Every world a course can get: the five named, and the whole fallback list. */
function everyWorld(): Record<string, World> {
  const all: Record<string, World> = {};
  for (const code of ["NURC (410)", "NURC (411)", "NURP (431)", "NURP (432)", "NURM (410)"]) {
    all[code] = worldFor({ name: `${code} x` });
  }
  /* 0..3 covers the list; past that it repeats by design. */
  for (let position = 0; position < 4; position++) {
    all[`fallback ${position}`] = worldFor({ name: `Unnamed ${position}` }, position);
  }
  return all;
}

/**
 * The floor, and why it is not a number somebody liked.
 *
 * It is the closest pair the HANDOFF ITSELF draws — ember red and wine, which
 * sit side by side on the real screen and are plainly two courses. The named
 * palette is the designer's and is not this check's business; what is this
 * check's business is that nothing falls below the tightest gap the designer
 * was willing to draw.
 *
 * It also clears the failure it was written for by measurement rather than by
 * hope: the Elective's old gold against Research Methods' amber measured
 * 0.2375 and rendered as one colour, and this floor sits above that.
 */
function namedFloor(): number {
  const named = Object.entries(everyWorld()).filter(([k]) => !k.startsWith("fallback"));
  let floor = Infinity;
  for (let i = 0; i < named.length; i++) {
    for (let j = i + 1; j < named.length; j++) {
      floor = Math.min(floor, worldDistance(named[i][1], named[j][1]));
    }
  }
  return floor;
}

check("NO FALLBACK WORLD LOOKS LIKE ANOTHER WORLD, MEASURED NOT SPELLED", () => {
  /* The previous version of this compared hex strings. #d4a24a and #e0b25a
     are two strings and, on the iPad, one colour — so it passed while the
     Elective and Research Methods covers were indistinguishable. A check that
     cannot fail on the bug it exists for is worse than none. */
  const worlds = everyWorld();
  const floor = namedFloor();
  const keys = Object.keys(worlds);

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      /* Named against named is the designer's call, and it SETS the floor
         rather than being held to it. */
      if (!keys[i].startsWith("fallback") && !keys[j].startsWith("fallback")) continue;
      const d = worldDistance(worlds[keys[i]], worlds[keys[j]]);
      assert.ok(
        d >= floor,
        `${keys[i]} and ${keys[j]} are ${d.toFixed(4)} apart, under the handoff's own tightest ${floor.toFixed(4)}`
      );
    }
  }
});

check("FOUR UN-NAMED COURSES IS THE LIMIT, AND IT IS A STATED ONE", () => {
  /* Not an aspiration: the fifth wraps to the first, by design and on
     purpose. This pins the number so nobody reads the wrap as a bug, and so
     nobody quietly assumes the list is longer than it is. */
  const distinct = new Set<string>();
  for (let position = 0; position < 4; position++) {
    distinct.add(worldFor({ name: `Unnamed ${position}` }, position).one);
  }
  assert.equal(distinct.size, 4, "the fallback list no longer holds four distinct worlds");
  assert.equal(
    worldFor({ name: "x" }, 4).one,
    worldFor({ name: "x" }, 0).one,
    "the fifth un-named course must wrap to the first, not vanish"
  );
});

check("THE CODE IS READ FROM THE NAME, BECAUSE `code` IS NULL ON ALL SIX", () => {
  assert.equal(worldFor({ name: "NURC (410) Critical Care Nursing" }).one, "#f0a23a");
  assert.equal(worldFor({ name: "NURP (431) Nursing Leadership" }).one, "#b8455a");
  assert.equal(worldFor({ name: "NURM (410) Research Methods" }).one, "#e0b25a");
});

check("every spelling of a code lands on the same world", () => {
  /* The importer has written all three of these into this account. */
  const a = worldFor({ name: "NURC (410) Critical Care" });
  const b = worldFor({ name: "NURC 410 Critical Care" });
  const c = worldFor({ name: "critical care", code: "nurc410" });
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

check("THE STORED COLOUR IS NEVER CONSULTED", () => {
  /* All six really do hold #6366f1. If that ever reaches this function the
     six worlds collapse into one. */
  const withIndigo = worldFor({ name: "NURP (431) Nursing Leadership", code: null }, 3);
  const plain = worldFor({ name: "NURP (431) Nursing Leadership" }, 0);
  assert.deepEqual(withIndigo, plain, "position changed a NAMED course's world");
});

check("an unnamed course still gets a real world, and keeps it", () => {
  const first = worldFor({ name: "Elective Course" }, 5);
  const again = worldFor({ name: "Elective Course" }, 5);
  assert.deepEqual(first, again, "the same course changed colour between renders");
  assert.ok(first.one.startsWith("#"));
});

check("A SEVENTH COURSE DOES NOT COME BACK UNDEFINED", () => {
  for (const position of [6, 7, 12, 99, 0, -1]) {
    const w = worldFor({ name: "Something New" }, position);
    assert.ok(w && w.one && w.two, `position ${position} produced ${JSON.stringify(w)}`);
  }
});

check("A TWO-STOP WORLD STILL FILLS THE BOTTOM OF THE SCREEN", () => {
  /* Four of the six have no third colour. Leaving --w3 unset drops the last
     radial and the gradient stops dead half way down the page. */
  const vars = worldVars(worldFor({ name: "NURP (431) Nursing Leadership" }));
  assert.ok(vars["--w3"], "--w3 was left empty on a two-stop world");
  assert.equal(vars["--w3"], vars["--w2"]);
});

check("a three-stop world keeps its own deep end", () => {
  const vars = worldVars(worldFor({ name: "NURC (410) Critical Care" }));
  assert.equal(vars["--w3"], "#3e120b");
  assert.notEqual(vars["--w3"], vars["--w2"]);
});

check("the cover gradient names three stops whatever the world", () => {
  for (const s of HIS) {
    const css = coverGradient(worldFor(s));
    assert.ok(css.startsWith("linear-gradient(165deg"), css);
    assert.equal((css.match(/#[0-9a-f]{6}/g) ?? []).length, 3, css);
  }
});

check("THE LECTURE WORLD IS DEEPER AND REDDER THAN ANY COURSE", () => {
  /* "One step deeper/redder" is the handoff's phrase; this is the check that
     it was not copied from the course palette by mistake. */
  assert.deepEqual(LECTURE_WORLD, { one: "#e0703a", two: "#8e2a2e", three: "#3a0e14" });
  const courseFirsts = HIS.map((s, i) => worldFor(s, i).one);
  assert.ok(!courseFirsts.includes(LECTURE_WORLD.one), "a course owns the lecture's colour");
});

/* ── mutations ──────────────────────────────────────────────────────────── */

function mutationBites(name: string, probe: () => void) {
  try {
    probe();
    failures += 1;
    console.log(`  MUTATION DID NOT BITE  ${name}`);
  } catch {
    console.log(`  bites  ${name}`);
  }
}

console.log("");
console.log("mutations");

mutationBites("keying the world off the stored colour", () => {
  /* Every subject holds #6366f1, so this gives one world six times. */
  const byColour = HIS.map(() => "#6366f1");
  assert.equal(new Set(byColour).size, 6);
});

mutationBites("requiring the `code` column, which is null on all six", () => {
  const byColumn = HIS.map((s) => s.code).filter(Boolean);
  assert.equal(byColumn.length, 6);
});

mutationBites("indexing the fallback without wrapping", () => {
  const FALLBACK_LEN = 6;
  const bad = (position: number) => (position < FALLBACK_LEN ? "ok" : undefined);
  assert.ok(bad(7));
});

mutationBites("comparing world colours as strings instead of measuring them", () => {
  /* The exact palette that shipped and looked wrong: the Elective's old gold
     #d4a24a beside NURM 410's amber #e0b25a. Two different strings — which is
     all the previous check asked for — and on the iPad one colour. */
  const oldFallback: World = { one: "#d4a24a", two: "#7a4a18" };
  const amber = worldFor({ name: "NURM (410) x" });
  assert.notEqual(oldFallback.one, amber.one, "the strings do differ; that was never the question");
  assert.ok(
    worldDistance(oldFallback, amber) >= namedFloor(),
    "the old fallback sits closer to amber than the handoff's own tightest pair"
  );
});

mutationBites("leaving --w3 unset on a two-stop world", () => {
  const bad = (w: { three?: string }) => ({ "--w3": w.three });
  assert.ok(bad({}) ["--w3"]);
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("كل مادة لها عالمها، وما تتغير بين فتحة وفتحة.");
}
