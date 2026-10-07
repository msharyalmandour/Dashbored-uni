/**
 * The orb's change log, and the registry that bounds it.
 *
 * WHY THIS EXISTS, and it is not hypothetical. When CHANGEABLE was first
 * written, three of its five enum lists were wrong from memory:
 *
 *   TaskStatus  written PENDING / IN_PROGRESS / COMPLETED / CANCELLED
 *               actually NOT_STARTED / IN_PROGRESS / COMPLETED / OVERDUE
 *   GapStatus   written OPEN / IN_PROGRESS / UNDERSTOOD / MASTERED
 *               actually NOT_UNDERSTOOD / LEARNING / PRACTICING / UNDERSTOOD / MASTERED
 *
 * `satisfies` did not catch it and could not: the values are strings, and a
 * wrong string is a valid string. Nothing would have failed until the orb
 * tried to set a status and Postgres refused an enum value that does not
 * exist — at which point the student is told their request failed for no
 * reason they can see.
 *
 * So the registry is checked against the schema itself rather than against
 * anybody's recollection, by reading prisma/schema.prisma. That is the source
 * of truth for what the database will accept, and it cannot drift from itself.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  CHANGEABLE,
  isChangeableModel,
  specOf,
  toText,
  fromText,
  realChanges,
} from "../src/lib/ai/agent/change-log";

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log("The orb's change log");
console.log("");

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

/** Every value of one enum, as the schema declares it. */
function enumValues(name: string): string[] {
  const m = new RegExp(`^enum ${name} \\{([^}]*)\\}`, "m").exec(schema);
  assert.ok(m, `the schema has no enum called ${name}`);
  return m[1]
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").trim())
    .filter((l) => /^[A-Z][A-Z0-9_]*$/.test(l));
}

/** The type of one field of one model, as the schema declares it. */
function fieldType(model: string, field: string): string | null {
  const m = new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, "m").exec(schema);
  if (!m) return null;
  const line = m[1]
    .split("\n")
    .map((l) => l.trim())
    .find((l) => new RegExp(`^${field}\\s+\\S`).test(l));
  if (!line) return null;
  const parts = line.split(/\s+/);
  return parts[1] ?? null;
}

/* ── The registry names things that exist ─────────────────────────────────── */

check("every model in the registry is a model in the schema", () => {
  for (const model of Object.keys(CHANGEABLE)) {
    assert.ok(
      new RegExp(`^model ${model} \\{`, "m").test(schema),
      `CHANGEABLE names ${model}, which the schema does not declare`
    );
  }
});

check("every field in the registry is a field of that model", () => {
  for (const [model, fields] of Object.entries(CHANGEABLE)) {
    for (const field of Object.keys(fields)) {
      assert.ok(
        fieldType(model, field) !== null,
        `${model}.${field} is in the registry and not in the schema`
      );
    }
  }
});

check("every declared type matches what the field actually holds", () => {
  const EXPECTED: Record<string, string[]> = {
    string: ["String"],
    int: ["Int"],
    date: ["DateTime"],
  };
  for (const [model, fields] of Object.entries(CHANGEABLE)) {
    for (const [field, spec] of Object.entries(fields)) {
      const declared = fieldType(model, field)!.replace(/[?[\]]/g, "");
      if (spec.type === "enum") {
        // An enum field's schema type IS the enum's name, so this also proves
        // the field is an enum rather than a String the registry mislabelled.
        assert.ok(
          new RegExp(`^enum ${declared} \\{`, "m").test(schema),
          `${model}.${field} is declared "enum" but its type ${declared} is not an enum`
        );
      } else {
        assert.ok(
          EXPECTED[spec.type].includes(declared),
          `${model}.${field} is declared "${spec.type}" but holds ${declared}`
        );
      }
    }
  }
});

/* ── THE ONE THAT CAUGHT THE REAL BUG ─────────────────────────────────────── */

check("every enum value the orb may write is a value the database accepts", () => {
  for (const [model, fields] of Object.entries(CHANGEABLE)) {
    for (const [field, spec] of Object.entries(fields)) {
      if (spec.type !== "enum") continue;
      const enumName = fieldType(model, field)!.replace(/[?[\]]/g, "");
      const real = enumValues(enumName);
      for (const value of spec.values ?? []) {
        assert.ok(
          real.includes(value),
          `${model}.${field} offers "${value}", which ${enumName} does not have (it has: ${real.join(", ")})`
        );
      }
    }
  }
});

check("a narrower list than the enum is allowed, and says why", () => {
  /* The registry may offer FEWER values than the enum — Task.status leaves out
     OVERDUE on purpose, because urgency.ts computes that from the deadline and
     a second stored answer to the same question goes stale. What it may never
     do is offer a value the database will refuse, which the check above
     covers. This one only asserts the deliberate narrowing is still there, so
     that "fix" does not get applied by someone tidying. */
  const offered = CHANGEABLE.Task.status.values as readonly string[];
  assert.ok(!offered.includes("OVERDUE"), "Task.status must not offer OVERDUE");
  assert.ok(enumValues("TaskStatus").includes("OVERDUE"), "TaskStatus should still have OVERDUE");
});

/* ── The boundary refuses what is not declared ────────────────────────────── */

check("a model that is not in the registry is refused", () => {
  assert.equal(isChangeableModel("Task"), true);
  for (const name of ["User", "Document", "OrbChange", "Flashcard", "", "task"]) {
    assert.equal(isChangeableModel(name), false, `${name} must not be changeable`);
  }
});

check("a field that is not in the registry is refused", () => {
  assert.ok(specOf("Task", "deadline"));
  // userId is the one that matters: a tool taking a field name as a string
  // would otherwise let one confused run reassign a row to another account.
  for (const field of ["userId", "id", "sourceCaptureId", "createdAt", "Deadline", ""]) {
    assert.equal(specOf("Task", field), null, `Task.${field} must not be changeable`);
  }
});

/* ── Text in, text out ────────────────────────────────────────────────────── */

check("null stays null and never becomes the word", () => {
  assert.equal(toText(null), null);
  assert.equal(toText(undefined), null);
  // The failure this guards: "null" restored as text into a field that held
  // nothing, so an undo writes a four-letter string where there was absence.
  assert.notEqual(toText(null), "null");
});

check("a date round-trips exactly", () => {
  const d = new Date("2026-11-03T00:00:00.000Z");
  const text = toText(d);
  assert.equal(text, "2026-11-03T00:00:00.000Z");
  const back = fromText({ type: "date" }, text);
  assert.ok(back instanceof Date);
  assert.equal((back as Date).getTime(), d.getTime());
});

check("an unreadable value returns undefined rather than a wrong one", () => {
  // undefined means "do not write". The alternative — a plausible-looking
  // value — restores something the log never held and calls it an undo.
  assert.equal(fromText({ type: "int" }, "45 minutes"), undefined);
  assert.equal(fromText({ type: "int" }, "4.5"), undefined);
  assert.equal(fromText({ type: "int" }, ""), undefined);
  assert.equal(fromText({ type: "date" }, "not a date"), undefined);
  assert.equal(fromText({ type: "enum", values: ["A", "B"] }, "C"), undefined);
  // And the readable ones still read.
  assert.equal(fromText({ type: "int" }, "45"), 45);
  assert.equal(fromText({ type: "int" }, "-3"), -3);
  assert.equal(fromText({ type: "enum", values: ["A", "B"] }, "B"), "B");
  assert.equal(fromText({ type: "string" }, "45 minutes"), "45 minutes");
});

check("a number is not parsed with parseInt's tolerance", () => {
  /* parseInt("45 minutes") is 45, and a field restored from a value the log
     never held is precisely the failure mode this module exists to prevent. */
  assert.equal(fromText({ type: "int" }, "45abc"), undefined);
  assert.equal(fromText({ type: "int" }, " 45"), undefined);
});

/* ── A change that changed nothing is not a change ────────────────────────── */

check("setting a field to what it already holds records nothing", () => {
  assert.deepEqual(realChanges([{ field: "title", before: "A", after: "A" }]), []);
  assert.deepEqual(realChanges([{ field: "x", before: null, after: null }]), []);
  assert.deepEqual(realChanges([{ field: "x", before: undefined, after: null }]), []);
  const d = new Date("2026-01-01T00:00:00.000Z");
  assert.deepEqual(realChanges([{ field: "deadline", before: d, after: new Date(d) }]), []);
});

check("a real change is recorded, and null is one side of one", () => {
  assert.deepEqual(realChanges([{ field: "estimatedMinutes", before: null, after: 45 }]), [
    { field: "estimatedMinutes", before: null, after: "45" },
  ]);
  assert.deepEqual(realChanges([{ field: "estimatedMinutes", before: 45, after: null }]), [
    { field: "estimatedMinutes", before: "45", after: null },
  ]);
});

check("a value that cannot be recorded stops the change rather than being logged wrong", () => {
  assert.throws(() => realChanges([{ field: "x", before: {}, after: "a" }]));
  assert.throws(() => realChanges([{ field: "x", before: true, after: "a" }]));
});

console.log("");
console.log(failures === 0 ? "The orb cannot change what it has not recorded." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
