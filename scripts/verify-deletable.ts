/**
 * Everything a student makes, they can unmake.
 *
 * Seventeen kinds of thing can be created here. Twelve deletions closed most of
 * that; auditing what was left found three more, and one of them was the worst
 * of the set.
 *
 *   ScheduleEvent   a class in the week. Created ONLY by the agent reading a
 *                   photograph of a timetable, and removed ONLY by wiping every
 *                   event and re-importing. One class read wrongly off a
 *                   screenshot could not be deleted — the recourse was to
 *                   re-import the whole timetable, which is a strange thing to
 *                   have to do about one Tuesday.
 *
 *   FocusSession    a session left open and closed later by the reconciler
 *                   records hours nobody studied, in the analytics the student
 *                   reads about themselves.
 *
 *   SlideAnnotation every pen mark on a slide, in one row. The eraser edited
 *                   strokes; nothing cleared the page.
 *
 * Most of this file is about the one mistake that is not recoverable by trying
 * again: a delete that reaches another student's row. Sixteen deletions is
 * sixteen `where` clauses, and a missing owner in any one of them does not
 * fail, does not warn, and removes somebody else's work.
 *
 * Run: npx tsx scripts/verify-deletable.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

console.log("Deleting what you made\n");

const here = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/**
 * Source with its comments removed.
 *
 * Every check in this file asks what the code DOES, and a comment is prose that
 * happens to contain the same words. The check below about `assertMutated`
 * failed on its first run for exactly that: the function carries a comment
 * saying "Not assertMutated, because a slide with no marks is already in the
 * state being asked for", and searching the text found the word in the
 * explanation of its own absence.
 *
 * That is the fourth time in this sitting a check of mine matched a sentence or
 * a declaration instead of the thing itself, so it is a function now rather
 * than a habit I keep failing to remember.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}
const DELETE = code(here("src/app/actions/delete.ts"));
/* The schema is read WITH its comments: two checks below depend on what the
   schema says about itself, and `///` doc comments are how Prisma carries it. */
const SCHEMA = here("prisma/schema.prisma");

/** Every `prisma.X.deleteMany({ where: … })` in the file, one per line. */
function deleteCalls(source: string) {
  const calls: { model: string; where: string }[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const start = /prisma\.(\w+)\.deleteMany\(\{/.exec(lines[i]);
    if (!start) continue;
    /* A call may be written on one line or wrapped over several. Take until the
       braces balance rather than assuming either shape — assuming one-line is
       how a multi-line delete escapes the whole file's worth of checks. */
    let text = lines[i].slice(start.index);
    let depth = 0;
    let j = i;
    do {
      if (j > i) text += "\n" + lines[j];
      for (const ch of j === i ? text : lines[j]) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
      j++;
    } while (depth > 0 && j < lines.length && j - i < 12);
    calls.push({ model: start[1], where: text });
  }
  return calls;
}

const CALLS = deleteCalls(DELETE);

check("every delete in the file was found by the parser", () => {
  /* If this undercounts, every check below is inspecting a subset and passing
     for that reason. The count is asserted against the raw number of
     `deleteMany(` occurrences, which no brace-matching can disagree with. */
  const raw = (DELETE.match(/\.deleteMany\(/g) ?? []).length;
  assert.equal(CALLS.length, raw, `parsed ${CALLS.length} of ${raw} deletes`);
  assert.ok(CALLS.length >= 15, `only ${CALLS.length} deletes in the file`);
});

check("no delete can reach another student's row", () => {
  /* The one mistake no retry recovers. Every `where` must name the owner, by
     userId or through a relation that ends at one. */
  for (const { model, where } of CALLS) {
    assert.match(where, /userId/, `the ${model} delete is not scoped to a student:\n${where}`);
  }
});

check("no delete is issued on an id alone", () => {
  // `{ where: { id } }` type-checks and deletes anybody's row.
  for (const { model, where } of CALLS) {
    const clause = /where: \{([\s\S]*?)\}[\s\S]*$/.exec(where);
    assert.ok(clause, `could not read the ${model} delete's where clause`);
    assert.ok(
      /userId|subject|lecture|slide/.test(clause[1]),
      `the ${model} delete names only an id:\n${clause[1]}`
    );
  }
});

/* ── The three that were missing ───────────────────────────────────────────── */

for (const fn of ["deleteScheduleEvent", "deleteFocusSession", "clearSlideAnnotations"]) {
  check(`${fn} exists`, () => {
    assert.match(DELETE, new RegExp(`export async function ${fn}\\(`), `${fn} is gone`);
  });
}

check("a class is scoped on its own userId, not through its course", () => {
  /* ScheduleEvent.subjectId is nullable and severs to null when a course is
     deleted — the schema says so deliberately, so that deleting a lecture does
     not erase the record that time was spent. So every survivor of a deleted
     course has NO subject, and a subject-scoped delete could never reach one:
     the orphan left behind would be permanent. I wrote it that way first. */
  assert.match(SCHEMA, /subjectId\s+String\?/, "ScheduleEvent's subject is no longer optional");
  const call = CALLS.find((c) => c.model === "scheduleEvent");
  assert.ok(call, "nothing deletes a class");
  assert.match(call.where, /id: eventId, userId/, "the class delete does not scope on userId directly");
  assert.ok(
    !/subject: \{ userId \}/.test(call.where),
    "the class delete goes through the subject, so a class with no subject is undeletable"
  );
});

check("clearing pen marks does not claim the slide was not found", () => {
  /* A slide with no marks is already in the state being asked for. Reporting
     "not found" would be a lie about the student's own lecture. */
  const fn = /export async function clearSlideAnnotations[\s\S]*?\n\}/.exec(DELETE);
  assert.ok(fn, "clearSlideAnnotations is gone");
  assert.ok(!/assertMutated/.test(fn[0]), "clearing an unmarked slide would report an error");
  assert.match(fn[0], /return \{ cleared: count \}/, "the caller is not told how much was cleared");
});

check("every new delete establishes who is asking, before it deletes", () => {
  for (const fn of ["deleteScheduleEvent", "deleteFocusSession", "clearSlideAnnotations"]) {
    const body = new RegExp(`export async function ${fn}[\\s\\S]*?\\n\\}`).exec(DELETE);
    assert.ok(body, `${fn} is gone`);
    const auth = body[0].indexOf("await requireUserId()");
    const del = body[0].indexOf("deleteMany");
    assert.ok(auth >= 0, `${fn} never establishes identity`);
    assert.ok(auth < del, `${fn} deletes before it knows who is asking`);
  }
});

check("a deleted class disappears from every screen that draws the week", () => {
  /* Four screens read ScheduleEvent. A class removed on one and still drawn on
     three reads as the delete not having worked. */
  const body = /export async function deleteScheduleEvent[\s\S]*?\n\}/.exec(DELETE);
  assert.ok(body);
  for (const path of ["/time", "/calendar", "/today", '"/"']) {
    assert.ok(body[0].includes(path), `a deleted class would still show on ${path}`);
  }
});

/* ── Nothing creatable is left without a way out ───────────────────────────── */

check("every table a student can fill has a delete somewhere", () => {
  /* Read from the schema rather than a list kept by hand, so a new model shows
     up here rather than being remembered. */
  const models = [...SCHEMA.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]);
  const lower = (m: string) => m[0].toLowerCase() + m.slice(1);

  /* Not the student's to delete one of, and why. Each of these is a decision,
     not an oversight, and saying which is the point of listing them. */
  const NOT_INDIVIDUALLY_DELETABLE: Record<string, string> = {
    User: "an account deletion, not a row deletion — a separate flow with its own confirmation",
    StudentEvent: "the behaviour log; individually deleting one would bias the patterns read from it",
    StudentPreference: "settings are updated, never deleted",
    ReviewItem: "scheduling, owned by the thing it reviews and removed with it",
  };

  const actions = ["src/app/actions/delete.ts", "src/app/actions/capture.ts", "src/app/actions/documents.ts",
                   "src/app/actions/slides.ts", "src/app/actions/study-position.ts", "src/app/actions/time.ts"]
    .map((p) => code(here(p)))
    .join("\n");

  const missing = models.filter(
    (m) => !(m in NOT_INDIVIDUALLY_DELETABLE) && !actions.includes(`prisma.${lower(m)}.delete`)
  );
  assert.deepEqual(missing, [], `no way to delete: ${missing.join(", ")}`);
});

console.log("");
console.log(failures === 0 ? "What you made, you can unmake." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
