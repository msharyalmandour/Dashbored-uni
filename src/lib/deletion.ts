/**
 * What disappears when you delete something.
 *
 * Seventeen kinds of thing could be created in this app and five could be
 * deleted, which meant anything the agent filed wrongly from a drop was
 * permanent. Adding deletion is straightforward; adding deletion a student can
 * TRUST is not, and the difference is entirely in what they are told first.
 *
 * "Are you sure?" is not a warning. It asks a question the student cannot
 * answer, because the thing they need to know — that this course is carrying
 * five lectures and thirty flashcards they spent a term making — is exactly
 * what the dialog failed to mention. So every confirmation here is built from
 * counts read out of the database at the moment of asking.
 *
 * The rules are here as pure functions because they are easy to get subtly
 * wrong: listing something that will not actually be deleted teaches the
 * student to distrust the warning, and omitting something that will is worse
 * than showing nothing at all.
 */

/** One line of "and this goes too", with the number that makes it real. */
export type Consequence = { key: ConsequenceKey; count: number };

export type ConsequenceKey =
  /* A term contains courses; a course contains everything else. `subjects` is
     here because it was briefly reported under `topics` — a confirmation dialog
     saying "6 topics" about six whole courses, which is the one place in an app
     where a wrong noun is not a cosmetic problem. */
  | "subjects"
  | "lectures"
  | "slides"
  | "annotations"
  | "resources"
  | "topics"
  | "flashcards"
  | "problems"
  | "mistakes"
  | "gaps"
  | "tasks"
  | "videos";

/**
 * What actually happens to a thing that is attached to what is being deleted.
 *
 * Three outcomes, and the difference matters to a student:
 *
 *   - `deleted`   — it goes as well. This is the only kind worth warning about.
 *   - `kept`      — it survives and stops pointing at the deleted thing. A
 *                   flashcard is knowledge the student built; deleting the
 *                   lecture it came from is not a reason to take it away.
 *   - `none`      — there are none of these, so there is nothing to say.
 */
export type Fate = "deleted" | "kept" | "none";

export function fateOf(count: number, cascades: boolean): Fate {
  if (count <= 0) return "none";
  return cascades ? "deleted" : "kept";
}

/**
 * The lines a confirmation should show, worst first.
 *
 * Only what is actually being destroyed, and only what exists. A warning listing
 * "0 lectures" is noise that trains people to click through warnings, which is
 * the habit that makes the next one dangerous.
 */
export function consequencesOf(counts: Partial<Record<ConsequenceKey, number>>): Consequence[] {
  return (Object.entries(counts) as [ConsequenceKey, number | undefined][])
    .filter(([, n]) => typeof n === "number" && n > 0)
    .map(([key, n]) => ({ key, count: n as number }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Whether this deletion is big enough to deserve more than a click.
 *
 * A stray task the agent misfiled should not need ceremony — asking for
 * ceremony every time is how a student learns to stop reading. Something
 * carrying a term's work should.
 */
export const HEAVY_DELETION_THRESHOLD = 5;

export function isHeavy(consequences: Consequence[]): boolean {
  return consequences.reduce((n, c) => n + c.count, 0) >= HEAVY_DELETION_THRESHOLD;
}

/**
 * Whether a typed confirmation is warranted.
 *
 * Only for a whole course or a whole term — the two things that can carry a
 * year. Everywhere else a deliberate second click is proportionate, and asking
 * someone to type the name of a video is theatre.
 */
export function needsTypedConfirmation(kind: DeletableKind, consequences: Consequence[]): boolean {
  return (kind === "subject" || kind === "semester") && isHeavy(consequences);
}

export type DeletableKind =
  | "semester"
  | "subject"
  | "topic"
  | "lecture"
  | "slide"
  | "resource"
  | "task"
  | "flashcard"
  | "problem"
  | "mistake"
  | "gap"
  | "clinical"
  | "video";

/**
 * Storage files are not rows.
 *
 * `ON DELETE CASCADE` tidies the database and knows nothing about the PDF
 * sitting in object storage. Deleting a course used to be impossible, so this
 * never came up; now that it is possible, every lecture file under it would be
 * left paying rent forever, unreferenced and unreachable.
 *
 * So a deletion that removes documents collects their paths BEFORE the rows go,
 * because afterwards there is nothing left to ask.
 */
export function filesToRemove(paths: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const p of paths) {
    if (typeof p === "string" && p.trim().length > 0) seen.add(p);
  }
  return [...seen];
}
