/**
 * Deletion, and the warning that comes before it.
 *
 * The dangerous failure here is not a delete that does not work — that gets
 * noticed immediately. It is a warning that is WRONG: one that lists things
 * which will survive, or stays quiet about things that will not. Both teach a
 * student that the warning is decoration, and the habit of clicking through
 * warnings is what makes the next one cost them a term's work.
 *
 * Run: npx tsx scripts/verify-deletion.ts
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  consequencesOf,
  fateOf,
  filesToRemove,
  HEAVY_DELETION_THRESHOLD,
  isHeavy,
  needsTypedConfirmation,
} from "../src/lib/deletion";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) {
    failures++;
    console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

console.log("Deletion\n");

/* ================================== only what actually disappears ======== */
{
  const c = consequencesOf({ lectures: 5, flashcards: 30, tasks: 0 });
  check("nothing that does not exist is listed", !c.some((x) => x.count === 0),
    "a warning that says '0 lectures' is noise, and noise is what teaches people to click through warnings");
  check("what does exist is listed", c.length === 2);
  check("the worst comes first", c[0].key === "flashcards" && c[0].count === 30,
    c.map((x) => `${x.key}:${x.count}`).join(", "));
  check("an empty deletion says nothing at all", consequencesOf({}).length === 0);
  check("...and so does one where everything is zero",
    consequencesOf({ lectures: 0, slides: 0 }).length === 0);
  check("a negative count is not a warning", consequencesOf({ lectures: -3 }).length === 0);
}

/* ============================ kept is not the same as deleted ============ */
// A flashcard is knowledge the student built. Deleting the lecture it came from
// is not a reason to take it away — and telling them it will be taken away,
// when it will not, is a lie that costs them the deletion they meant to make.
{
  check("something that cascades is deleted", fateOf(5, true) === "deleted");
  check("something that does not is kept", fateOf(5, false) === "kept");
  check("none of it is neither", fateOf(0, true) === "none" && fateOf(0, false) === "none");
}

/* ======================================= proportionate ceremony ========== */
{
  check("one stray thing is not heavy", !isHeavy(consequencesOf({ tasks: 1 })),
    "asking for ceremony every time is how a student learns to stop reading");
  check("a term's work is", isHeavy(consequencesOf({ lectures: 5, flashcards: 30 })));
  check("the threshold counts everything together",
    isHeavy(consequencesOf({ lectures: 2, slides: 2, tasks: 1 })) &&
      !isHeavy(consequencesOf({ lectures: 2, slides: 2 })),
    `threshold is ${HEAVY_DELETION_THRESHOLD}`);

  check("a whole course carrying work asks you to type its name",
    needsTypedConfirmation("subject", consequencesOf({ lectures: 5, flashcards: 30 })));
  check("...and so does a term", needsTypedConfirmation("semester", consequencesOf({ lectures: 9 })));
  check("an empty course does not", !needsTypedConfirmation("subject", consequencesOf({})));
  check("a video never does", !needsTypedConfirmation("video", consequencesOf({ lectures: 99 })),
    "asking someone to type the name of a video is theatre");
  check("nor does a lecture", !needsTypedConfirmation("lecture", consequencesOf({ slides: 12 })));
}

/* ===================================== the files nobody else frees ======= */
// ON DELETE CASCADE tidies the database and knows nothing about the PDF sitting
// in object storage. Every lecture file under a deleted course would otherwise
// be left paying rent forever, unreferenced and unreachable.
{
  const paths = filesToRemove(["a/one.pdf", "a/two.pdf", "a/one.pdf", null, undefined, "", "   "]);
  check("every real file is collected", paths.includes("a/one.pdf") && paths.includes("a/two.pdf"));
  check("each only once", paths.length === 2, paths.join(", "));
  check("nothing empty is sent to storage", !paths.some((p) => p.trim() === ""),
    "an empty path is a delete request against the bucket root");
  check("nothing at all is an empty list, not a crash", filesToRemove([]).length === 0);
  check("only nulls is an empty list", filesToRemove([null, undefined]).length === 0);
}

/* ============================ every delete is scoped to its owner ======== */
/* Static, and on purpose. An unscoped deleteMany is not a bug that shows up in
   testing — it works perfectly for the person who wrote it and deletes other
   people's work in production. There is no runtime moment at which to notice
   it, so the file is read instead.
 *
 * The first version of this check looked for "userId" anywhere in the function
 * and was therefore useless: `const userId = await requireUserId()` satisfied
 * it, so an unscoped `deleteMany({ where: { id: taskId } })` passed. A mutation
 * proved it. What has to be scoped is the WHERE CLAUSE, so that is what is read.
 */
{
  /* Every actions file, not just delete.ts. The rule is about deletions, and
     deletions predate this file — `deleteSlide` has lived in slides.ts since
     the annotator shipped. A rule that only applies to new code is a rule the
     old code is exempt from, which is backwards. */
  const dir = join(import.meta.dirname, "..", "src", "app", "actions");
  const src = readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  const bodies = [...src.matchAll(/export async function (\w+)[\s\S]*?(?=\nexport async function |\n\/\* =|$)/g)];

  check("the delete actions file has actions in it", bodies.length >= 10, `found ${bodies.length}`);

  /** The `where: { ... }` of one Prisma call, brace-matched rather than guessed. */
  function whereClauses(body: string): string[] {
    const out: string[] = [];
    const re = /\bwhere:\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      let depth = 1;
      let i = m.index + m[0].length;
      while (i < body.length && depth > 0) {
        if (body[i] === "{") depth++;
        else if (body[i] === "}") depth--;
        i++;
      }
      out.push(body.slice(m.index, i));
    }
    return out;
  }

  let writes = 0;
  for (const m of bodies) {
    const name = m[1];
    const body = m[0];
    const mutating = /prisma\.\w+\.(delete|deleteMany)\(/.test(body);
    if (!mutating) continue;
    writes++;

    check(`${name} establishes who is asking`, /requireUserId\(\)/.test(body));

    const clauses = whereClauses(body);
    check(`${name} filters on something`, clauses.length > 0);
    for (const clause of clauses) {
      check(`${name}: every where clause names the owner`, /userId/.test(clause),
        `${clause.replace(/\s+/g, " ").slice(0, 90)} — an id alone deletes whoever's row it is`);
    }
  }
  check("there are deletions to check", writes >= 10, `${writes} mutating actions`);

  // The counting half must be scoped too: a count is a read of somebody's data,
  // and "how many lectures does this course have" is not a question a stranger
  // should get an answer to.
  for (const m of bodies) {
    if (!/Consequences/.test(m[1])) continue;
    check(`${m[1]} verifies ownership before counting anything`,
      /findFirst[\s\S]*?userId/.test(m[0]),
      "counting someone else's lectures tells you they exist");
  }
}

if (failures) {
  console.error(`\n${failures} failing check(s).`);
  process.exit(1);
}
console.log(
  "  A confirmation counts what will really go, names nothing that will survive,\n" +
    "  and stays quiet about what does not exist. Ceremony is proportionate — a\n" +
    "  stray task takes a click, a course carrying a term takes its name typed.\n" +
    "  Files in storage are collected before the rows that point at them go."
);
