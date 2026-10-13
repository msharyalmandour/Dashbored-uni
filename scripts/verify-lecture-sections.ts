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
  slideRangeOf,
  topicForSlide,
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

/* ── which topic a slide belongs to ─────────────────────────────────────── */

check("A RANGE HAS BOTH ENDS", () => {
  assert.deepEqual(slideRangeOf("9"), { from: 9, to: 9 });
  assert.deepEqual(slideRangeOf("4–5"), { from: 4, to: 5 });
  assert.deepEqual(slideRangeOf("30–33"), { from: 30, to: 33 });
  assert.deepEqual(slideRangeOf("14–16"), { from: 14, to: 16 });
  assert.equal(slideRangeOf(null), null);
  assert.equal(slideRangeOf("—"), null);
});

check("a reversed range is read in order, not refused", () => {
  assert.deepEqual(slideRangeOf("33–30"), { from: 30, to: 33 });
});

check("HIS REAL SLIDES LAND ON THE RIGHT TOPIC", () => {
  /* Spot-checked against the deck's own numbering, including the inside of
     every range — the whole reason ranges have two ends. */
  const at = (slide: number) => topicForSlide(REAL, slide)?.title ?? null;
  assert.equal(at(9), "Planning");
  assert.equal(at(10), "Organizing");
  assert.equal(at(13), "Controlling");
  assert.equal(at(4), "Managers");
  assert.equal(at(5), "Managers");          // inside the 4–5 range
  assert.equal(at(2), "Objectives & Opening Questions");  // inside 1–3
  assert.equal(at(15), "Emotional Intelligence Competencies");
  assert.equal(at(31), "III · Unit Management");  // inside 30–33
  assert.equal(at(33), "III · Unit Management");  // the far end
});

check("EVERY SLIDE OF THE DECK IS COVERED BY SOME TOPIC", () => {
  /* The lecture runs to 33 slides and the sections claim 1–33 between them.
     A gap would be a slide the student opens to no label at all. */
  const uncovered: number[] = [];
  for (let slide = 1; slide <= 33; slide++) {
    if (!topicForSlide(REAL, slide)) uncovered.push(slide);
  }
  assert.deepEqual(uncovered, [], `slides with no topic: ${uncovered.join(", ")}`);
});

check("a slide outside the lecture gets NO topic rather than the nearest", () => {
  assert.equal(topicForSlide(REAL, 99), null);
  assert.equal(topicForSlide(REAL, 0), null);
  assert.equal(topicForSlide(REAL, -1), null);
  assert.equal(topicForSlide(REAL, 2.5), null);
});

check("WHEN TWO TOPICS CLAIM A SLIDE, THE NARROWER ONE WINS", () => {
  /* Real, not hypothetical: slide 15 is inside "14–16" (AONE) AND is exactly
     "15" (Emotional Intelligence). The one that says "this IS slide 15" is
     the right answer. */
  assert.equal(topicForSlide(REAL, 15)?.title, "Emotional Intelligence Competencies");
  assert.equal(topicForSlide(REAL, 14)?.title, "Nurse Managers in Practice & AONE Competencies");
  assert.equal(topicForSlide(REAL, 16)?.title, "Nurse Managers in Practice & AONE Competencies");

  /* A tie on width falls back to whichever opened first. */
  const overlap = copy(REAL);
  overlap[5].slides = "9";  // Organizing now also claims exactly 9, like Planning
  assert.equal(topicForSlide(overlap, 9)?.title, "Planning", "the later topic stole the slide");
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

/* The slide→topic lookup gets its own mutation shape too. */
function lookupMutationBites(
  name: string,
  find: (slide: number) => string | null,
  probeSlide?: number,
  probeTitle?: string | null
) {
  try {
    if (probeSlide !== undefined) {
      assert.equal(find(probeSlide), probeTitle);
    }
    assert.equal(find(5), "Managers");            // inside a range
    assert.equal(find(31), "III · Unit Management");
    assert.equal(find(99), null);                 // outside the deck
    failures += 1;
    console.log(`  MUTATION DID NOT BITE  ${name}`);
  } catch {
    console.log(`  bites  ${name}`);
  }
}

lookupMutationBites("matching only the FIRST slide of a topic, not its range", (slide) => {
  const hit = REAL.find((s) => firstSlideOf(s.slides) === slide);
  return hit?.title ?? null;
});

lookupMutationBites("preferring the EARLIER topic over the narrower one", (slide) => {
  let best: { title: string; from: number } | null = null;
  for (const s of REAL) {
    const r = slideRangeOf(s.slides);
    if (!r || slide < r.from || slide > r.to) continue;
    if (!best || r.from < best.from) best = { title: s.title, from: r.from };
  }
  return best?.title ?? null;
}, 15, "Emotional Intelligence Competencies");

lookupMutationBites("naming the nearest topic for a slide nobody covers", (slide) => {
  let best: { title: string; d: number } | null = null;
  for (const s of REAL) {
    const r = slideRangeOf(s.slides);
    if (!r) continue;
    const d = Math.min(Math.abs(slide - r.from), Math.abs(slide - r.to));
    if (!best || d < best.d) best = { title: s.title, d };
  }
  return best?.title ?? null;
});

console.log("");
if (failures > 0) {
  console.log(`${failures} failed.`);
  process.exitCode = 1;
} else {
  console.log("المحاضرة، توبيك توبيك — وكل نقطة معها سلايدها.");
}
