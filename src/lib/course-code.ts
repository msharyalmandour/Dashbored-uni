/**
 * THE SHORT NAME OF A COURSE.
 *
 * `Subject.code` exists and, measured on this account, is null for all six
 * courses — because the agent files courses from a timetable where the code is
 * part of the title, not a separate field:
 *
 *   NURP (432) Nursing Leadership
 *   NURC (410) Critical Care Nursing
 *   Elective Course
 *
 * This matters in exactly one place and it is not cosmetic. The `.tt` row is a
 * three-column grid whose label is `white-space: nowrap; text-overflow:
 * ellipsis` and whose note column is `auto` — the note takes the width it
 * wants and the LABEL is what gets cut. A note the length of "NURC (410)
 * Critical Care Nursing" therefore truncated the lecture title, so a phone
 * showed "GAS EXC…" beside the full name of a course the student already knows
 * they are studying. The row design is not wrong; it assumes a note is short,
 * and a full course name is not a note.
 *
 * So the note gets the code. The colour dot already carries which course it
 * is; the code is there to disambiguate NURC 410 from NURC 411, which on this
 * account are two different courses with nearly the same name.
 */

/**
 * "NURP (432) Nursing Leadership" -> "NURP 432".
 *
 * `stored` wins when it is there: a student who typed a code meant it. The
 * name is only read when the column is empty, which today is always.
 *
 * Returns null rather than a guess when there is no code to find — "Elective
 * Course" has none, and inventing "Elective" as a code would put a word in a
 * column that is supposed to hold an identifier.
 */
export function courseCode(name: string, stored?: string | null): string | null {
  const trimmed = stored?.trim();
  if (trimmed) return trimmed;

  /* Letters then a number, with the number optionally in brackets and with
     any amount of space between: "NURC (410)", "NURC410", "NURC 410". Anchored
     at the start, because a number later in a title is part of the title. */
  const match = /^([A-Za-z]{2,6})\s*\(?\s*(\d{3,4})\s*\)?/.exec(name.trim());
  if (!match) return null;
  return `${match[1].toUpperCase()} ${match[2]}`;
}

/**
 * The code when there is one, and otherwise something short enough for the
 * note column — never the whole title.
 *
 * `MAX` is the width this column can carry on a phone without eating the
 * label beside it.
 */
export const MAX_SHORT_NAME = 18;

export function shortCourseName(name: string, stored?: string | null): string {
  const code = courseCode(name, stored);
  if (code) return code;

  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length <= MAX_SHORT_NAME) return clean;
  /* Cut on a word boundary so the result is a word and not a fragment. */
  const cut = clean.slice(0, MAX_SHORT_NAME);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 8 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
