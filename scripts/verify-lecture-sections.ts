/**
 * التوبيكس, against the student's own twenty-one.
 *
 * The fixture is not invented: it is the real breakdown from the study file he
 * built for his Management Process lecture and revised an exam from — 21
 * sections, 111 points, every one carrying the slide's English and an Arabic
 * example. If the rules reject the content they were modelled on, the rules
 * are wrong, so that is the first check.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  problemsWith,
  describeProblem,
  isSound,
  firstSlideOf,
  MIN_SECTIONS,
  MAX_SECTIONS,
  MAX_POINTS,
  type Section,
} from "../src/lib/lecture-sections";

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

console.log("التوبيكس");
console.log("");

const here = dirname(fileURLToPath(import.meta.url));
const REAL = JSON.parse(
  readFileSync(join(here, "..", "prisma", "sections", "management-process.json"), "utf8")
) as Section[];

const copy = (s: Section[]): Section[] => JSON.parse(JSON.stringify(s)) as Section[];

/* ── the content this was modelled on ───────────────────────────────────── */

check("HIS OWN TWENTY-ONE TOPICS PASS THEIR OWN RULES", () => {
  assert.deepEqual(problemsWith(REAL).map(describeProblem), []);
  assert.equal(isSound(REAL), true);
});

check("it really is the whole lecture, not a sample", () => {
  assert.equal(REAL.length, 21, "the fixture lost sections");
  assert.equal(
    REAL.reduce((n, s) => n + s.points.length, 0),
    111,
    "the fixture lost points"
  );
});

check("EVERY POINT CARRIES THE LECTURE'S OWN SENTENCE", () => {
  for (const [i, section] of REAL.entries()) {
    for (const [p, point] of section.points.entries()) {
      assert.ok(point.source.trim().length > 0, `section ${i} point ${p} has no source line`);
    }
  }
});

check("every problem has words a student could read", () => {
  const broken = copy(REAL);
  broken[0].title = "";
  broken[1].points = [];
  broken[2].points[0].source = "";
  for (const problem of problemsWith(broken)) {
    const text = describeProblem(problem);
    assert.ok(text.length > 0, `${problem.kind} describes as nothing`);
    assert.ok(!text.includes("undefined"), `${problem.kind} leaks undefined`);
  }
});

/* ── the slide range ────────────────────────────────────────────────────── */

check("A SLIDE RANGE RESOLVES TO THE SLIDE IT OPENS ON", () => {
  assert.equal(firstSlideOf("9"), 9);
  assert.equal(firstSlideOf("4–5"), 4);   // en dash, which is what the source uses
  assert.equal(firstSlideOf("4-5"), 4);   // hyphen
  assert.equal(firstSlideOf("30–33"), 30);
  assert.equal(firstSlideOf("14–16"), 14);
  assert.equal(firstSlideOf(undefined), null);
  assert.equal(firstSlideOf("—"), null);
  assert.equal(firstSlideOf("0"), null);  // there is no slide zero
});

check("every section in the source resolves to a real opening slide", () => {
  for (const section of REAL) {
    if (section.slides) {
      assert.ok(firstSlideOf(section.slides)! > 0, `"${section.slides}" resolved to nothing`);
    }
  }
});

check("A RANGE WITH NO NUMBER IN IT IS REFUSED", () => {
  const broken = copy(REAL);
  broken[0].slides = "early slides";
  assert.ok(problemsWith(broken).some((p) => p.kind === "SLIDES_UNREADABLE"));
});

/* ── the graph of content ───────────────────────────────────────────────── */

check("A TOPIC WITH NO POINTS IS REFUSED", () => {
  const broken = copy(REAL);
  broken[3].points = [];
  assert.ok(problemsWith(broken).some((p) => p.kind === "NO_POINTS"));
});

check("A POINT WITHOUT THE LECTURE'S OWN LINE IS REFUSED", () => {
  const broken = copy(REAL);
  broken[4].points[0].source = "   ";
  assert.ok(problemsWith(broken).some((p) => p.kind === "POINT_NO_SOURCE"));
});

check("a missing Arabic note is ALLOWED — filler would be worse", () => {
  const ok = copy(REAL);
  for (const section of ok) for (const point of section.points) delete point.note;
  assert.deepEqual(problemsWith(ok).map(describeProblem), []);
});

check("TWO TOPICS WITH THE SAME NAME ARE REFUSED", () => {
  const broken = copy(REAL);
  broken[5].title = broken[4].title;
  assert.ok(problemsWith(broken).some((p) => p.kind === "DUPLICATE_TITLE"));
});

check("too few and too many topics are both refused", () => {
  assert.ok(problemsWith(copy(REAL).slice(0, MIN_SECTIONS - 1)).some((p) => p.kind === "TOO_FEW_SECTIONS"));
  const many = copy(REAL);
  while (many.length <= MAX_SECTIONS) many.push({ ...copy(REAL)[0], title: `extra ${many.length}` });
  assert.ok(problemsWith(many).some((p) => p.kind === "TOO_MANY_SECTIONS"));
});

check("a topic with more points than anyone reads is refused", () => {
  const broken = copy(REAL);
  const one = broken[0].points[0];
  broken[0].points = Array.from({ length: MAX_POINTS + 1 }, () => ({ ...one }));
  assert.ok(problemsWith(broken).some((p) => p.kind === "TOO_MANY_POINTS"));
});

/* ── the citations ──────────────────────────────────────────────────────── */

check("A SLIDE PAST THE END OF THE DECK IS REFUSED", () => {
  const broken = copy(REAL);
  broken[0].points[0].slide = 99;
  assert.ok(problemsWith(broken, 33).some((p) => p.kind === "SLIDE_OUT_OF_RANGE"));
  /* and is accepted against a deck that really is that long */
  assert.ok(!problemsWith(broken, 120).some((p) => p.kind === "SLIDE_OUT_OF_RANGE"));
});

check("slide 0 and a fractional slide are refused", () => {
  for (const slide of [0, -3, 2.5]) {
    const broken = copy(REAL);
    broken[0].points[0].slide = slide;
    assert.ok(
      problemsWith(broken).some((p) => p.kind === "SLIDE_NOT_A_PAGE"),
      `slide ${slide} was accepted`
    );
  }
});

/* ── emphasis ───────────────────────────────────────────────────────────── */

check("MARKING EVERYTHING IMPORTANT IS REFUSED", () => {
  const broken = copy(REAL);
  for (const section of broken) section.starred = true;
  assert.ok(problemsWith(broken).some((p) => p.kind === "EVERYTHING_STARRED"));
});

check("the source's own four-of-twenty-one is accepted", () => {
  assert.equal(REAL.filter((s) => s.starred).length, 4);
  assert.ok(!problemsWith(REAL).some((p) => p.kind === "EVERYTHING_STARRED"));
});

/* ── mutations ──────────────────────────────────────────────────────────── */

type Checker = (sections: Section[], pages?: number) => { kind: string }[];

function mutationBites(name: string, check_: Checker, probe: (c: Checker) => void) {
  try {
    probe(check_);
    failures += 1;
    console.log(`  MUTATION DID NOT BITE  ${name}`);
  } catch {
    console.log(`  bites  ${name}`);
  }
}

console.log("");
console.log("mutations");

mutationBites(
  "letting a point have no source line",
  (s, pages) => problemsWith(s, pages).filter((p) => p.kind !== "POINT_NO_SOURCE"),
  (c) => {
    const broken = copy(REAL);
    broken[4].points[0].source = "";
    assert.ok(c(broken).some((p) => p.kind === "POINT_NO_SOURCE"));
  }
);

mutationBites(
  "letting a topic have no points",
  (s, pages) => problemsWith(s, pages).filter((p) => p.kind !== "NO_POINTS"),
  (c) => {
    const broken = copy(REAL);
    broken[3].points = [];
    assert.ok(c(broken).some((p) => p.kind === "NO_POINTS"));
  }
);

mutationBites(
  "not checking the slide against the deck",
  (s) => problemsWith(s).filter((p) => p.kind !== "SLIDE_OUT_OF_RANGE"),
  (c) => {
    const broken = copy(REAL);
    broken[0].points[0].slide = 99;
    assert.ok(c(broken, 33).some((p) => p.kind === "SLIDE_OUT_OF_RANGE"));
  }
);

mutationBites(
  "allowing two topics with the same name",
  (s, pages) => problemsWith(s, pages).filter((p) => p.kind !== "DUPLICATE_TITLE"),
  (c) => {
    const broken = copy(REAL);
    broken[5].title = broken[4].title;
    assert.ok(c(broken).some((p) => p.kind === "DUPLICATE_TITLE"));
  }
);

mutationBites(
  "letting everything be starred",
  (s, pages) => problemsWith(s, pages).filter((p) => p.kind !== "EVERYTHING_STARRED"),
  (c) => {
    const broken = copy(REAL);
    for (const section of broken) section.starred = true;
    assert.ok(c(broken).some((p) => p.kind === "EVERYTHING_STARRED"));
  }
);

/* The slide parser gets its own mutation shape: it returns a number, not a
   list of problems, so it cannot go through `mutationBites` above. */
function parserMutationBites(name: string, parse: (s: string) => number | null) {
  try {
    /* "4–5" must open on 4. A parser that reads the LAST run of digits gives
       5 — one slide past where the topic begins, every time a topic spans a
       range, which in his lecture is nine sections out of twenty-one. */
    assert.equal(parse("4–5"), 4);
    assert.equal(parse("30–33"), 30);
    failures += 1;
    console.log(`  MUTATION DID NOT BITE  ${name}`);
  } catch {
    console.log(`  bites  ${name}`);
  }
}

parserMutationBites("reading a slide range from the END instead of the start", (slides) => {
  const match = slides.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
});

parserMutationBites("taking every digit in the range as one number", (slides) => {
  const digits = slides.replace(/\D/g, "");
  return digits ? Number(digits) : null;
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("المحاضرة، توبيك توبيك — وكل نقطة معها سلايدها.");
}
