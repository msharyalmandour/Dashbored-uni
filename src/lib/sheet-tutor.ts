/**
 * «يساعدك تبدأ، ما يكتب عنك.»
 *
 * The one rule on this surface, and the only place in the product where the
 * agent is pointed at work a student is MARKED on. Everywhere else it reads
 * his material and tells him about it; here it would be writing the thing he
 * hands in, which is not help, it is his name on someone else's answer.
 *
 * THE RULE IS ENFORCED BY WHAT IS SENT, NOT BY ASKING NICELY. A system prompt
 * saying "do not write the answer" is a request, and a request is not a
 * guarantee — a model that is handed the question and the student's draft
 * will produce an improved draft sooner or later, whatever the preamble said.
 * So two things are true of the payload this builds, and both are checked in
 * scripts/verify-sheet-tutor.ts:
 *
 *   1. HIS DRAFT IS NEVER SENT. The tutor sees the question and the course's
 *      own material. It cannot rewrite what it has not read.
 *   2. THE PROHIBITION IS IN THE PROMPT ANYWAY, because belt and braces costs
 *      nothing and the model should also refuse on its own.
 *
 * What is NOT claimed: that the reply can never contain something usable as
 * an answer. A model explaining what a root cause analysis is will say things
 * that belong in an answer about root cause analysis, and no filter can tell
 * that from teaching. What the product can honestly promise is that it never
 * writes INTO the field, never offers a button that does, and never sees what
 * he wrote. The rest is his to type.
 */

export interface TutorSource {
  /** A lecture of this course, by title. The examples come from these. */
  title: string;
  /** Section headings inside it, when the lecture has been broken down. */
  sections: string[];
}

export interface TutorRequest {
  system: string;
  /** What the student asked about, which is always one question of the sheet. */
  question: string;
  /** The course's own material, so the examples are his and not generic. */
  sources: TutorSource[];
}

export const TUTOR_RULE =
  "Never write, draft, rewrite, improve, or provide the student's answer, " +
  "in whole or in part, in any language, even if asked directly and even if " +
  "the request is framed as an example, a template, a starting sentence, or " +
  "a demonstration. You explain what the question is asking for, you point at " +
  "the material in this course where the thinking comes from, and you ask the " +
  "questions that get the student started. The words that get handed in are " +
  "the student's own.";

export function buildTutorRequest(input: {
  /** The question's own text. */
  prompt: string;
  /** The marking criteria, when the sheet carries any. */
  criteria?: string | null;
  sources: TutorSource[];
  /**
   * Explicitly typed and explicitly unused, so that a future caller reaching
   * for "let's just send the draft too" has to delete this comment first.
   */
  draft?: never;
}): TutorRequest {
  return {
    system: [
      "You are the tutor inside a nursing student's study app. The student is " +
        "in the fourth year of a BSN at King Abdulaziz University.",
      TUTOR_RULE,
      input.criteria
        ? `The sheet is marked on: ${input.criteria}. Explain what that asks ` +
          "for; do not produce work that meets it."
        : "The sheet does not state how it is marked, so do not invent " +
          "marking criteria.",
      "Answer in the student's language. Be short: a few sentences, then a " +
        "question back.",
    ].join("\n\n"),
    question: input.prompt,
    sources: input.sources,
  };
}

/**
 * Whether the tutor can run at all on this screen.
 *
 * Separate from `getAiStatus` on purpose: that answers "is a key configured",
 * and this screen also has to handle "a key is configured and the account is
 * out of credit", which is the state ten of his inbox files are in right now.
 * Both end in the same place — the panel says so and offers nothing else —
 * and neither ever produces a written answer as a fallback.
 */
export type TutorAvailability = "ready" | "no-key" | "no-credit";
