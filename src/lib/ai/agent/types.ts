import { z } from "zod";
import type { AgentSpend } from "./spend";

/**
 * What the agent actually did.
 *
 * Every variant carries the real database id of the row it created, because
 * that is what makes the log checkable: the interface can say "I added
 * Pharmacology" and the student can follow it to a course that exists. A
 * summary sentence cannot be verified; an id can.
 *
 * These are written from the return value of a completed write, never from
 * what the model said it was going to do. That ordering is the whole point —
 * it makes it structurally impossible for the interface to report a success
 * that did not happen, which is the failure mode this product cannot afford.
 */
export const agentActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("COURSE"), id: z.string(), name: z.string() }),
  z.object({
    kind: z.literal("TIMETABLE"),
    coursesCreated: z.number().int(),
    classesAdded: z.number().int(),
    skipped: z.number().int(),
    replaced: z.number().int(),
  }),
  z.object({
    kind: z.literal("TASK"),
    id: z.string(),
    title: z.string(),
    deadline: z.string(),
    subjectName: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("GAP"),
    id: z.string(),
    title: z.string(),
    subjectName: z.string(),
  }),
  z.object({
    kind: z.literal("LECTURE"),
    id: z.string(),
    title: z.string(),
    subjectName: z.string(),
  }),
  z.object({
    kind: z.literal("FLASHCARDS"),
    count: z.number().int(),
    subjectName: z.string(),
  }),
  z.object({
    kind: z.literal("MISTAKE"),
    id: z.string(),
    subjectName: z.string(),
  }),
  z.object({ kind: z.literal("FILED"), title: z.string(), subjectName: z.string().nullable() }),
  /* The file the student can now actually open. Carries the lecture's title as
     well as the deck's, because "Opened Gas Exchange" means nothing until you
     know which lecture it landed in. */
  z.object({
    kind: z.literal("READABLE"),
    id: z.string(),
    title: z.string(),
    lectureTitle: z.string(),
  }),
  z.object({
    kind: z.literal("RESOURCE"),
    id: z.string(),
    title: z.string(),
    lectureTitle: z.string(),
  }),
  z.object({ kind: z.literal("PROBLEMS"), count: z.number().int(), subjectName: z.string() }),
  z.object({ kind: z.literal("VIDEO"), id: z.string(), title: z.string() }),
  z.object({ kind: z.literal("CLINICAL"), id: z.string(), date: z.string() }),
]);

export type AgentAction = z.infer<typeof agentActionSchema>;

export const agentActionsSchema = z.array(agentActionSchema);

/**
 * How a run ended.
 *
 * `ASKED` is deliberately not a failure. A question the agent could not answer
 * from the content — "is this for a course you already have, or a new one?" —
 * is a better outcome than a confident guess that creates the wrong course,
 * and the run stops there rather than writing something to look decisive.
 *
 * `PARTIAL` exists because a run can hit its own limits (steps, writes, the
 * clock) after some writes have already landed. Those writes are real and are
 * reported as real; what the status adds is that the agent was cut off rather
 * than finished, so the student is not told the job is done when it is not.
 */
export type AgentRunResult = (
  | { status: "DONE"; actions: AgentAction[]; summary: string }
  | { status: "PARTIAL"; actions: AgentAction[]; summary: string; reason: string }
  | { status: "ASKED"; actions: AgentAction[]; question: string }
  | { status: "NOTHING_TO_DO"; actions: AgentAction[]; summary: string }
  | { status: "FAILED"; actions: AgentAction[]; message: string }
) & {
  /**
   * What the run cost, when a run actually happened.
   *
   * Optional because a result can be built without calling the model at all —
   * a refusal to start, a test double — and because the type is constructed in
   * a dozen places that have nothing to say about tokens. An intersection
   * rather than a field on each variant so `status` still discriminates.
   */
  spend?: AgentSpend;
};

/** Reads a stored log back. Anything that no longer parses is treated as absent. */
export function parseStoredActions(value: unknown): AgentAction[] {
  const result = agentActionsSchema.safeParse(value);
  return result.success ? result.data : [];
}
