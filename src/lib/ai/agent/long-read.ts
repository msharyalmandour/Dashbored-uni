/**
 * Reading a document too long to fit in one pass.
 *
 * A textbook is not an edge case for a nursing student — it is the largest and
 * most important file they own. Everything here happened inside one request
 * with a wall-clock budget and a 30,000-character ceiling, so a 500-page PDF
 * had its opening pages read and the remainder silently ignored, and the run
 * reported success. The student had no way to know that what came back
 * described chapter one.
 *
 * Long documents are now read in passes. Each pass is a full agent run over one
 * section, so the agent can act on what it finds there — file a lecture, record
 * a gap, write cards — rather than accumulating an ever-growing context that
 * would blow the same budget from the other direction.
 */

/** How much one pass reads. Held at the single-pass ceiling it replaces. */
export const PASS_CHARS = 30_000;

/**
 * Where a pass ends up starting again.
 *
 * Sections are overlapped because the split is arithmetic, not editorial: a cut
 * lands mid-sentence, mid-table, mid-definition. Without the overlap the term
 * introduced on one side of the cut and defined on the other is lost from both
 * passes — and a flashcard whose answer was severed is worse than no card.
 */
export const PASS_OVERLAP = 1_200;

/**
 * A ceiling on passes, so one enormous file cannot spend a student's whole
 * budget. Twelve passes is around 350,000 characters — a full textbook — and
 * past that the returns are not worth what they cost.
 */
export const MAX_PASSES = 12;

export interface ReadingProgress {
  /** How many passes have already been read. */
  done: number;
  /** How many there are in total, capped. */
  total: number;
}

/** Whether this content needs more than one pass at all. */
export function needsPasses(contentLength: number): boolean {
  return contentLength > PASS_CHARS;
}

/** How many passes a document of this length takes. */
export function passCount(contentLength: number): number {
  if (contentLength <= PASS_CHARS) return 1;
  const stride = PASS_CHARS - PASS_OVERLAP;
  return Math.min(MAX_PASSES, Math.ceil((contentLength - PASS_OVERLAP) / stride));
}

/**
 * The slice of text one pass reads.
 *
 * Clamped rather than allowed to run off the end, so the last pass of an
 * awkwardly sized document is a short real section and never an empty string
 * the agent would be asked to organise.
 */
export function passSlice(content: string, index: number): string {
  const stride = PASS_CHARS - PASS_OVERLAP;
  const start = Math.min(index * stride, Math.max(0, content.length - 1));
  return content.slice(start, start + PASS_CHARS);
}

/** The progress to store after a pass, or null once the document is finished. */
export function advance(progress: ReadingProgress): ReadingProgress | null {
  const done = progress.done + 1;
  return done >= progress.total ? null : { done, total: progress.total };
}

/** What is stored on the row, validated on the way back out. */
export function parseProgress(raw: unknown): ReadingProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<ReadingProgress>;
  if (typeof candidate.done !== "number" || typeof candidate.total !== "number") return null;
  if (candidate.done < 0 || candidate.total < 1 || candidate.done >= candidate.total) return null;
  return { done: candidate.done, total: candidate.total };
}
