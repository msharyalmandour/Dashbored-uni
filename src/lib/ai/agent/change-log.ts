import { prisma } from "@/lib/prisma";

/**
 * Recording what the orb changed, so a request can be undone like a drop.
 *
 * `undo.ts` takes back everything one drop CREATED, by deleting rows that
 * carry its `sourceCaptureId`. That covers the orb's first mode completely and
 * its second mode not at all: when the student asks for something, most of the
 * work is editing rows they already own, and deleting nothing puts a postponed
 * deadline back where it was.
 *
 * So the rule, and it is absolute: **the orb may not change a field it has not
 * first recorded the old value of.** This module is the only place that
 * records, and the only place that puts back.
 *
 * ── THE FIELD REGISTRY IS THE SAFETY BOUNDARY ───────────────────────────────
 *
 * `CHANGEABLE` lists every field the orb may touch, with its type. It is not
 * documentation; it is enforcement, and it does two jobs that are easy to
 * conflate:
 *
 *   1. It stops the orb editing a field nobody decided it should edit. A tool
 *      that took a field name as a string would let one confused run write to
 *      whatever field the model named, and `userId` is a field name.
 *   2. It makes the change reversible. The log stores text, because a log with
 *      a typed column per field falls behind the first time a tool touches a
 *      new kind of field. Putting a value back therefore means parsing it, and
 *      the only way to parse "2026-11-03" correctly is to know the field it
 *      belongs to. The registry is that knowledge, written once.
 *
 * Adding a field here is a decision, which is the point. Two are deliberately
 * absent: `completionPercentage` and `selfAssessment` are in ROADMAP's DECIDED
 * AGAINST — `null`, `3` and `0` across all seven lectures after 26 days — and
 * giving a dead field a voice makes it worse rather than better.
 */

type FieldType = "string" | "int" | "date" | "enum";

interface FieldSpec {
  type: FieldType;
  /** For "enum": the only values that may be written. Nothing else is. */
  values?: readonly string[];
}

/** Prisma model name → the fields of it the orb may change. */
export const CHANGEABLE = {
  Task: {
    title: { type: "string" },
    deadline: { type: "date" },
    /* OVERDUE is a real TaskStatus and is deliberately not offered. A task is
       overdue because of its deadline — urgency.ts computes exactly that from
       the date — so letting the orb assert it creates a second, stale answer
       to a question the data already answers. */
    status: { type: "enum", values: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] },
    estimatedMinutes: { type: "int" },
    description: { type: "string" },
  },
  KnowledgeGap: {
    title: { type: "string" },
    status: {
      type: "enum",
      values: ["NOT_UNDERSTOOD", "LEARNING", "PRACTICING", "UNDERSTOOD", "MASTERED"],
    },
    difficulty: { type: "enum", values: ["EASY", "MEDIUM", "HARD"] },
  },
  Lecture: {
    title: { type: "string" },
    status: { type: "enum", values: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "NEEDS_REVIEW"] },
    quickNotes: { type: "string" },
  },
  Subject: {
    status: { type: "enum", values: ["ACTIVE", "COMPLETED", "ARCHIVED"] },
  },
} as const satisfies Record<string, Record<string, FieldSpec>>;

export type ChangeableModel = keyof typeof CHANGEABLE;

export function isChangeableModel(name: string): name is ChangeableModel {
  return Object.hasOwn(CHANGEABLE, name);
}

export function specOf(model: ChangeableModel, field: string): FieldSpec | null {
  const fields = CHANGEABLE[model] as Record<string, FieldSpec>;
  return Object.hasOwn(fields, field) ? fields[field] : null;
}

/* ────────────────────────────────────────────────────────────────────────────
   Text in, text out
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * A stored value as the log's text.
 *
 * Dates go in as ISO 8601 and nothing else, because a date rendered any other
 * way is a date that depends on a locale to read back. Numbers go in as their
 * digits. `null` stays null and means the field was null — the one thing this
 * must never do is turn an absent value into the string "null", which would
 * then be restored as text into a field that had nothing in it.
 */
export function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  // Nothing else is a scalar this app stores in a changeable field. Refusing
  // beats guessing: an unrecordable value must stop the change, not be logged
  // as something it is not.
  throw new Error(`change-log: ${typeof value} is not a recordable value`);
}

/**
 * The log's text back into the value the field holds.
 *
 * Returns `undefined` — distinct from `null` — when the text cannot be read as
 * the field's type. The caller must treat that as "do not write", because the
 * alternative is restoring a wrong value over the student's data while
 * reporting a successful undo.
 */
export function fromText(
  spec: FieldSpec,
  text: string | null
): string | number | Date | null | undefined {
  if (text === null) return null;

  switch (spec.type) {
    case "string":
      return text;
    case "int": {
      // Not parseInt: "45 minutes" would become 45, and a field restored from
      // a value the log never held is the failure this guards against.
      if (!/^-?\d+$/.test(text)) return undefined;
      const n = Number(text);
      return Number.isSafeInteger(n) ? n : undefined;
    }
    case "date": {
      const d = new Date(text);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }
    case "enum":
      return spec.values?.includes(text) ? text : undefined;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Writing
   ──────────────────────────────────────────────────────────────────────────── */

export interface PendingChange {
  field: string;
  before: unknown;
  after: unknown;
}

/**
 * The changes that are real, from the ones proposed.
 *
 * A field set to the value it already holds is not a change. Dropping those
 * here rather than at the database keeps two things honest at once: the count
 * of what a run did, and the undo — a logged no-op is a revert the student is
 * told about that puts back what was already there.
 */
export function realChanges(proposed: PendingChange[]): { field: string; before: string | null; after: string | null }[] {
  const out: { field: string; before: string | null; after: string | null }[] = [];
  for (const c of proposed) {
    const before = toText(c.before);
    const after = toText(c.after);
    if (before === after) continue;
    out.push({ field: c.field, before, after });
  }
  return out;
}

/**
 * Write the log for one row's changes.
 *
 * Called inside the same transaction as the update it describes, so a change
 * that lands without its log is not a state this system can reach. That
 * ordering is the whole guarantee; a log written afterwards is a log that is
 * missing exactly the entries whose write failed.
 */
export async function recordChanges(
  tx: Pick<typeof prisma, "orbChange">,
  input: {
    userId: string;
    captureId: string;
    model: ChangeableModel;
    recordId: string;
    changes: { field: string; before: string | null; after: string | null }[];
  }
): Promise<void> {
  if (input.changes.length === 0) return;
  await tx.orbChange.createMany({
    data: input.changes.map((c) => ({
      userId: input.userId,
      captureId: input.captureId,
      model: input.model,
      recordId: input.recordId,
      field: c.field,
      before: c.before,
      after: c.after,
    })),
  });
}
