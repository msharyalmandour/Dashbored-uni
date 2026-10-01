/**
 * The pasted checklist.
 *
 * This parser is the input that `Procedure` never had. Everything above it was
 * already built and already passing — ospe.ts scores a station, practiceOrder
 * ranks what to drill, the practice run records misses as Mistake rows — and
 * all of it read an empty table for twenty days because the only way to make a
 * procedure was an agent with no credit.
 *
 * Two rules here are worth breaking the build over, and both are tested by
 * mutation below: the order never changes, and `critical` is never guessed.
 *
 * Run: npx tsx scripts/verify-checklist.ts
 */

import { parseChecklist, wasTruncated, MAX_STEPS, type ParsedStep } from "../src/lib/checklist";

let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
    failed++;
  }
}

const texts = (s: ParsedStep[]) => s.map((x) => x.text);

console.log("Pasted checklist\n");

/* ── The order is the content ─────────────────────────────────────────────── */

{
  // A real paste off a nasogastric-tube sheet, numbered as such sheets are.
  const sheet = `1. Verify the physician's order
2. Perform hand hygiene
3. Identify the patient using two identifiers
4. Measure the tube from nose to earlobe to xiphoid process
5. Lubricate the tip with water-soluble jelly
6. Confirm placement before instilling anything`;

  const steps = parseChecklist(sheet);
  ok("every line becomes a step", steps.length === 6, `got ${steps.length}`);
  ok("the numbering is stripped, not kept",
    steps[0].text === "Verify the physician's order", steps[0].text);
  ok("the order is exactly the order given",
    texts(steps)[1] === "Perform hand hygiene" &&
    texts(steps)[3].startsWith("Measure the tube") &&
    texts(steps)[5].startsWith("Confirm placement"));

  // Mutation: a parser that sorted — alphabetically, by length, anything —
  // would put "Confirm placement" first and "Verify" last. If this ever
  // passes with a sort in place, the test is worthless.
  const sorted = [...texts(steps)].sort();
  ok("and is NOT alphabetical, so a sort would be caught",
    texts(steps).join("|") !== sorted.join("|"));
}

{
  // Every marker shape his faculty sheets actually mix, including the
  // Arabic-Indic digits.
  const mixed = `- Wash hands
* Don gloves
• Position the patient
12) Document the procedure
٣. تحقق من هوية المريض
4 - Dispose of sharps`;
  const steps = parseChecklist(mixed);
  ok("every marker shape is stripped", steps.length === 6 &&
    steps.every((s) => !/^[-*•]/.test(s.text) && !/^[0-9٠-٩]+\s*[.)\-]/.test(s.text)),
    JSON.stringify(texts(steps)));
  ok("an Arabic line survives intact",
    steps[4].text === "تحقق من هوية المريض", steps[4].text);
}

{
  // A number INSIDE a step is not furniture. "Elevate 30 degrees" must keep
  // its 30, and only a leading ordinal is removed.
  const steps = parseChecklist("1. Elevate the head of the bed 30 to 45 degrees");
  ok("a number inside the step is untouched",
    steps[0].text === "Elevate the head of the bed 30 to 45 degrees", steps[0].text);
}

{
  const steps = parseChecklist("Wash hands\n\n\n   \nDon gloves");
  ok("blank and whitespace-only lines are dropped, not made into steps",
    steps.length === 2, `got ${steps.length}`);
}

{
  const steps = parseChecklist("**Perform hand hygiene**\n__Don gloves__");
  ok("markdown emphasis from a copy-paste is removed",
    steps[0].text === "Perform hand hygiene" && steps[1].text === "Don gloves",
    JSON.stringify(texts(steps)));
}

/* ── critical is read, never inferred ─────────────────────────────────────── */

{
  const steps = parseChecklist(`Perform hand hygiene
Confirm tube placement (critical)
Identify the patient [Critical]
Check the order — killer step
تحقق من الهوية (حرجة)`);

  ok("an explicit annotation is read", steps[1].critical && steps[2].critical);
  ok("in any bracket shape, and case-insensitively",
    steps[1].critical && steps[2].critical);
  ok("\"killer step\" is read, being the other name marking sheets use",
    steps[3].critical);
  ok("and the Arabic annotation too", steps[4].critical);
  ok("an unannotated step is NOT critical", steps[0].critical === false);

  ok("the annotation is stripped from the step's words",
    steps[1].text === "Confirm tube placement" &&
    steps[2].text === "Identify the patient",
    JSON.stringify(texts(steps)));
}

{
  // THE RULE THIS FILE EXISTS FOR. Nursing steps are worded as obligations:
  // "must", "always", "ensure", "mandatory". A parser that read those as
  // critical would mark a whole sheet critical, and a sheet where every step
  // fails the station is the same as a sheet where none does — except it
  // looks authoritative while being wrong.
  const obligations = parseChecklist(`You must perform hand hygiene
Always verify the patient's identity
Ensure the tube is secured
This step is mandatory
Never instil before confirming placement`);

  ok("\"must\" is not an annotation", obligations[0].critical === false);
  ok("\"always\" is not an annotation", obligations[1].critical === false);
  ok("\"ensure\" is not an annotation", obligations[2].critical === false);
  ok("\"mandatory\" is not an annotation", obligations[3].critical === false);
  ok("\"never\" is not an annotation", obligations[4].critical === false);
  ok("so a sheet of obligations yields NO critical steps",
    obligations.every((s) => !s.critical),
    `${obligations.filter((s) => s.critical).length} marked`);

  // Mutation: widen the rule to the word "must" anywhere and the assertions
  // above go red. That is the point — this is the one inference the app is
  // not allowed to make, because which steps fail a station is his school's
  // convention and not ours to decide.
}

{
  // A step that mentions a critical value is about the patient, not about the
  // marking scheme.
  const steps = parseChecklist("Report any critical lab value to the physician");
  ok("\"critical\" mid-sentence does not mark the step",
    steps[0].critical === false, JSON.stringify(steps[0]));
  ok("and the words are kept whole",
    steps[0].text === "Report any critical lab value to the physician", steps[0].text);
}

/* ── The paste that is really a document ──────────────────────────────────── */

{
  const huge = Array.from({ length: MAX_STEPS + 15 }, (_, i) => `Step ${i + 1}`).join("\n");
  const steps = parseChecklist(huge);
  ok("a runaway paste is capped at the constant, not a literal",
    steps.length === MAX_STEPS, `got ${steps.length}`);
  ok("and the cap keeps the FIRST steps, since order is the content",
    steps[0].text === "Step 1" && steps[MAX_STEPS - 1].text === `Step ${MAX_STEPS}`);
  ok("truncation is reportable, so the interface need not stay silent",
    wasTruncated(huge));
  ok("a paste that fits is not reported as truncated",
    wasTruncated("Wash hands\nDon gloves") === false);
  ok("and neither is one of exactly the cap",
    wasTruncated(Array.from({ length: MAX_STEPS }, (_, i) => `Step ${i + 1}`).join("\n")) === false);
}

{
  ok("empty input yields no steps rather than one blank step",
    parseChecklist("").length === 0 && parseChecklist("   \n\n  ").length === 0);
  ok("a line that is only a marker yields no step",
    parseChecklist("1.\n-\n•").length === 0,
    JSON.stringify(parseChecklist("1.\n-\n•")));
  ok("a line that is only an annotation yields no step",
    parseChecklist("(critical)").length === 0);
}

console.log(failed === 0 ? "\nAll checks passed" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
