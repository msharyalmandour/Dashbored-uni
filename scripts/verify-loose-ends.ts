/**
 * Saying what is half-filed, without becoming a nag screen.
 *
 * Measured on the real account: 46 topics with no lecture in them, 4 lectures
 * under no topic, 25 files attached to no lecture, 5 courses with no topics.
 * None of it was an error and no screen mentioned any of it. The topics page
 * listed forty-six headings, each opening onto nothing, and the only way to
 * learn that was to open forty-six of them.
 *
 * The risk in fixing it is the opposite failure: a panel that appears on every
 * visit, lists four things including three zeroes, and demands work the student
 * cannot do. Half these checks are about not becoming that.
 *
 * Run: npx tsx scripts/verify-loose-ends.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasLooseEnds, looseEnds, type LooseEndCounts } from "../src/lib/loose-ends";

/**
 * Source with comments and imports removed.
 *
 * Every check here asks what the code DOES. An import line and a comment both
 * contain the same words as the thing they refer to, and three checks in this
 * file passed on exactly that: one matched `UnattachedFiles` in its own import
 * while the JSX had been deleted, and two matched a token in the second of two
 * queries while the first had been broken.
 *
 * That is the fifth time in this sitting, so it is a function.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*import\b/.test(line))
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

/**
 * One named Prisma call, with its arguments — not the file it sits in.
 *
 * `String.replace` changes the FIRST match, so a file with two queries on the
 * same table has its second one left intact. A check that searches the whole
 * file then finds the token in the survivor and reports the broken one as fine.
 */
function prismaCall(source: string, model: string, method: string): string | null {
  const text = code(source);
  const at = text.indexOf(`prisma.${model}.${method}(`);
  if (at < 0) return null;
  let depth = 0;
  for (let i = text.indexOf("(", at); i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return text.slice(at, i + 1);
  }
  return null;
}

let failures = 0;
function check(label: string, run: () => void) {
  try {
    run();
    console.log(`  ok  ${label}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL  ${label}\n        ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log("Loose ends\n");

const NOTHING: LooseEndCounts = {
  coursesWithoutTopics: 0,
  topicsWithoutLectures: 0,
  lecturesWithoutTopic: 0,
  filesWithoutLecture: 0,
};

/** The real account, the day this was written. */
const MEASURED: LooseEndCounts = {
  coursesWithoutTopics: 5,
  topicsWithoutLectures: 46,
  lecturesWithoutTopic: 4,
  filesWithoutLecture: 25,
};

/* ── It says nothing when there is nothing to say ──────────────────────────── */

check("a tidy account gets no panel at all", () => {
  /* Not an empty state, not "all clear" — nothing. A section that appears on
     every visit to report zero is how a panel teaches you to skip it, and then
     it is still being skipped on the day it has something. */
  assert.deepEqual(looseEnds(NOTHING), []);
  assert.equal(hasLooseEnds(NOTHING), false);
});

check("a zero is never listed beside a real number", () => {
  const ends = looseEnds({ ...NOTHING, lecturesWithoutTopic: 4 });
  assert.equal(ends.length, 1, "zeroes were listed alongside the one real count");
  assert.equal(ends[0].kind, "lecturesWithoutTopic");
  assert.ok(ends.every((e) => e.count > 0));
});

/* ── And it says all of it when there is ───────────────────────────────────── */

check("every kind of loose end is reported", () => {
  const kinds = looseEnds(MEASURED).map((e) => e.kind).sort();
  assert.deepEqual(kinds, [
    "coursesWithoutTopics",
    "filesWithoutLecture",
    "lecturesWithoutTopic",
    "topicsWithoutLectures",
  ]);
});

check("the largest comes first", () => {
  // 46 empty topics is the finding. Fourth in a list is where it gets skipped.
  const ends = looseEnds(MEASURED);
  assert.equal(ends[0].kind, "topicsWithoutLectures");
  assert.deepEqual(ends.map((e) => e.count), [46, 25, 5, 4]);
});

check("equal counts come out in a stable order", () => {
  /* Two ends with the same count reordering between renders is a list that
     looks like it is changing when nothing has. */
  const a = looseEnds({ ...NOTHING, lecturesWithoutTopic: 3, filesWithoutLecture: 3 });
  const b = looseEnds({ ...NOTHING, lecturesWithoutTopic: 3, filesWithoutLecture: 3 });
  assert.deepEqual(a.map((e) => e.kind), b.map((e) => e.kind));
  assert.deepEqual(a.map((e) => e.kind), ["filesWithoutLecture", "lecturesWithoutTopic"]);
});

/* ── It never asks for something the student cannot do ─────────────────────── */

check("a topic with no lecture is stated, not demanded", () => {
  /* It resolves when material arrives for it. There is no page where a student
     can fix forty-six of them, and a link that goes somewhere you cannot act
     spends a click to say so. */
  const end = looseEnds(MEASURED).find((e) => e.kind === "topicsWithoutLectures");
  assert.ok(end, "the biggest finding is missing");
  assert.equal(end.href, null, "the student is sent somewhere they cannot act");
});

check("everything else goes somewhere real", () => {
  for (const end of looseEnds(MEASURED)) {
    if (end.kind === "topicsWithoutLectures") continue;
    assert.ok(end.href, `${end.kind} is reported with nowhere to go`);
    assert.match(end.href, /^\//, `${end.kind} does not point at a page in this app`);
  }
});

/* ── What the component asks, and in what language ─────────────────────────── */

const UI = readFileSync(new URL("../src/components/home/loose-ends.tsx", import.meta.url), "utf8");

check("every count is scoped to the student who is looking", () => {
  /* Four counts, four chances to count somebody else's material. Two of these
     reach the owner through a relation, which is exactly where it is easy to
     leave out. */
  /* Matched a line at a time. An earlier version tried to balance the nested
     braces with one regex and matched one query out of four — a check that
     would have reported "all scoped" while looking at a quarter of them. */
  const queries = UI.split("\n")
    .map((line) => /prisma\.(\w+)\.count\((.*)\),?\s*$/.exec(line.trim()))
    .filter((m): m is RegExpExecArray => m !== null);
  assert.equal(queries.length, 4, `found ${queries.length} counts, expected 4`);
  for (const [, model, body] of queries) {
    assert.match(body, /userId/, `the ${model} count is not scoped to a student`);
  }
});

check("it renders nothing rather than an empty panel", () => {
  assert.match(UI, /if \(ends\.length === 0\) return null;/, "an empty panel would render on a tidy account");
});

check("a kind with no destination is not made into a link", () => {
  assert.match(UI, /end\.href \?/, "the component does not distinguish a link from a statement");
});

check("both languages carry a line for every kind", () => {
  const kinds = looseEnds(MEASURED).map((e) => e.kind);
  assert.equal(kinds.length, 4);
  for (const dict of ["en", "ar"]) {
    const body = readFileSync(new URL(`../src/lib/i18n/dictionaries/${dict}.ts`, import.meta.url), "utf8");
    assert.match(body, /looseEnds: \{/, `${dict} has no looseEnds block`);
    for (const kind of kinds) {
      assert.match(body, new RegExp(`${kind}: "`), `${dict} is missing wording for ${kind}`);
    }
    /* The count has to appear in the sentence. "Courses have no topics yet"
       without a number is a fact with no size, and the size is the point. */
    const block = /looseEnds: \{[\s\S]*?\n    \},/.exec(body);
    assert.ok(block, `${dict}'s looseEnds block could not be read`);
    const lines = [...block[0].matchAll(/: "([^"]+)"/g)].map((m) => m[1]);
    const withCounts = lines.filter((l) => l.includes("{count}"));
    assert.equal(withCounts.length, 4, `${dict} has ${withCounts.length} lines that state a number, expected 4`);
  }
});

/* ── Where each link actually lands ────────────────────────────────────────
 *
 * This section exists because of a bug I shipped in the commit above it. Home
 * said "25 files are not attached to a lecture" and linked to /studio, and
 * /studio read `lectureSlide` — decks, which by definition are files that ARE
 * attached to a lecture. The link went to the one page guaranteed not to show
 * them.
 *
 * A link that lands where the thing is not is worse than no link: it spends a
 * click to demonstrate the absence it promised to fix. And nothing about it
 * would fail — the href was valid, the page rendered, the count was right.
 */

check("the files link lands on a page that renders the section", () => {
  const studio = code(readFileSync(new URL("../src/app/(app)/studio/page.tsx", import.meta.url), "utf8"));
  const end = looseEnds(MEASURED).find((e) => e.kind === "filesWithoutLecture");
  assert.equal(end?.href, "/studio", "the destination moved; this check must move with it");
  /* The JSX, not the import — deleting the usage and keeping the import is
     what this check first passed on. */
  assert.match(studio, /<UnattachedFiles\b/, "/studio does not render the section, so it cannot show those files");
});

check("the section selects files attached to nothing, for this student", () => {
  const section = readFileSync(
    new URL("../src/components/studio/unattached-files.tsx", import.meta.url),
    "utf8"
  );
  /* Both queries, each on its own. One check over the whole file passes as long
     as EITHER still carries the token, which is how a broken findMany hid
     behind an intact count. */
  for (const method of ["findMany", "count"] as const) {
    const call = prismaCall(section, "document", method);
    assert.ok(call, `the section has no document.${method}`);
    assert.match(call, /lectureId: null/, `document.${method} does not select unattached files`);
    assert.match(call, /userId/, `document.${method} is not scoped to the student`);
  }
});

check("the courses link lands on a page that lists courses", () => {
  const end = looseEnds(MEASURED).find((e) => e.kind === "coursesWithoutTopics");
  assert.equal(end?.href, "/academics");
  const page = readFileSync(new URL("../src/app/(app)/academics/page.tsx", import.meta.url), "utf8");
  assert.match(page, /prisma\.(subject|semester)\./, "/academics does not read any course");
});

check("the unattached section stays quiet when every file is filed", () => {
  const section = readFileSync(
    new URL("../src/components/studio/unattached-files.tsx", import.meta.url),
    "utf8"
  );
  assert.match(section, /files\.length === 0\) return null/, "an empty section would render on a tidy account");
});

console.log("");
console.log(failures === 0 ? "What is half-filed says so." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
