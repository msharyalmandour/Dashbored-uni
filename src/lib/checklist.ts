/**
 * Turning a pasted checklist into ordered steps.
 *
 * WHY THIS EXISTS, measured: `Procedure` and `ProcedureStep` held zero rows,
 * and the whole OSPE machine above them — `score`, `practiceOrder`,
 * `watchSteps`, the practice run, the station result — was built, reachable
 * from the sidebar, tested, and permanently empty. Not because the student
 * would not use it. Because its ONLY input was the agent's `create_procedure`
 * tool, and every drop since 11 September has failed for want of credit. On
 * that same account every flashcard, every knowledge gap and every topic
 * carries a creation date of 11 September: the day the agent died mid-stride.
 * Only `Document` and `Lecture` kept growing, and they are the two things with
 * a path that does not go through a model.
 *
 * So this is the hand path. It is deliberately the cheapest thing that fills
 * the table: paste the block of steps off the faculty sheet, one per line.
 *
 * WHAT IT WILL NOT DO is reorder. For a procedure the order IS the content —
 * step 5 before step 4 is a different and sometimes unsafe act — so lines come
 * out in the order they went in, always.
 */

/** A step as parsed, before it is given a position and written. */
export interface ParsedStep {
  text: string;
  critical: boolean;
}

/**
 * An OSPE station checklist that runs past this is not a checklist any more,
 * it is a pasted document. The limit exists so one stray paste cannot write
 * hundreds of rows; it is not a claim about how long a procedure may be.
 */
export const MAX_STEPS = 60;

/**
 * Leading list furniture: "1.", "12)", "3 -", "٤.", "-", "*", "•", "–".
 *
 * Stripped because it is the paste's numbering, not the step's words, and
 * keeping it would print "1. 1. Wash hands" once we number the list ourselves.
 * Arabic-Indic digits are in the class because his faculty sheets are mixed.
 */
const LEADING_MARKER = /^\s*(?:[-*•–—]|[0-9٠-٩]{1,3}\s*[.)\-:])\s*/;

/**
 * An explicit critical annotation, and nothing wider.
 *
 * This is the one rule worth being pedantic about. Which steps are critical is
 * a marking convention that differs between schools and between procedures, so
 * the app must never decide it. But a line that literally carries "(critical)"
 * IS the document saying so, and reading that is not inference.
 *
 * Deliberately NOT matched: a bare "must", "mandatory" or "always". Those are
 * how every step of a nursing procedure is worded — "must verify the patient's
 * identity" — so matching them would mark the whole list critical, which is
 * the same as marking none while looking authoritative.
 */
const CRITICAL_ANNOTATION =
  /[([‏]*\s*(?:critical|killer(?:\s+step)?|حرجة|حرج|حاسمة)\s*[)\]‏]*\s*$/i;

/** Markdown emphasis a paste off a PDF or a doc often carries. */
const EMPHASIS = /(\*\*|__|\*|_)/g;

/**
 * Parse a pasted block into steps.
 *
 * Blank lines are dropped rather than becoming empty steps, so a double-spaced
 * paste reads the same as a single-spaced one. Nothing else about the order or
 * the wording is touched.
 */
export function parseChecklist(text: string): ParsedStep[] {
  const steps: ParsedStep[] = [];

  for (const raw of text.split(/\r?\n/)) {
    let line = raw.replace(EMPHASIS, "").trim();
    if (line === "") continue;

    line = line.replace(LEADING_MARKER, "").trim();
    if (line === "") continue;

    // Read the annotation, then remove it: the marker is metadata about the
    // step, not part of what the student has to perform.
    const critical = CRITICAL_ANNOTATION.test(line);
    if (critical) line = line.replace(CRITICAL_ANNOTATION, "").trim();
    if (line === "") continue;

    steps.push({ text: line, critical });

    if (steps.length === MAX_STEPS) break;
  }

  return steps;
}

/**
 * Whether a paste was truncated, so the interface can say so instead of
 * silently keeping the first sixty and dropping the rest.
 */
export function wasTruncated(text: string): boolean {
  return parseChecklist(text).length === MAX_STEPS && countLines(text) > MAX_STEPS;
}

/** Non-empty lines, which is what the student counts when they look at a sheet. */
function countLines(text: string): number {
  let n = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(EMPHASIS, "").replace(LEADING_MARKER, "").trim();
    if (line !== "") n += 1;
  }
  return n;
}
