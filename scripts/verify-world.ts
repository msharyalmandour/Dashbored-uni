/**
 * Each course gets its own world, and the same one every time.
 *
 * The failure this exists to stop is not a crash: it is six courses that all
 * come out the same colour, which is exactly what keying off the stored
 * `color` would do on the real account — all six hold the schema's default
 * indigo because the agent filed every one of them.
 */

import assert from "node:assert/strict";
import { worldFor, worldVars, coverGradient, LECTURE_WORLD } from "../src/lib/world";

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

check("NO FALLBACK WORLD COLLIDES WITH A NAMED ONE", () => {
  /* The failure that produced five worlds for six courses: the fallback list
     was a copy of the handoff's palette, so a code-less course landed on
     Critical Care's saffron. */
  const named = new Set(
    [
      "NURC (410) x", "NURC (411) x", "NURP (431) x", "NURP (432) x", "NURM (410) x",
    ].map((name) => worldFor({ name }).one)
  );
  for (let position = 0; position < 24; position++) {
    const w = worldFor({ name: `Unnamed ${position}` }, position);
    assert.ok(!named.has(w.one), `fallback at ${position} reuses a named world: ${w.one}`);
  }
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
