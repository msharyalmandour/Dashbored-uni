/**
 * The "40%" on an exam, read out of its own title.
 *
 * WHY IT IS PARSED AND NOT STORED. `Task` has no weight column, and the
 * approved design puts a "40% من الدرجة" chip on the nearest deadline. Adding
 * a column would mean fifteen rows to fill in by hand before the chip ever
 * showed anything — and a column left null everywhere is a field that lies by
 * being empty. The percentage is already in the data: the importer wrote the
 * syllabus's own wording, "Final OSPE — Clinical Leadership and Management
 * (40%)", and that string is the most reliable source there is for it.
 *
 * WHEN IT IS NOT THERE, NOTHING IS SHOWN. The chip is hidden rather than
 * guessed at, because a wrong weight on the one deadline a student is looking
 * at is worse than no weight at all: it changes what he studies tonight.
 */

/** The percentage an exam is worth, or null when the title does not say. */
export function weightFromTitle(title: string | null | undefined): number | null {
  if (!title) return null;

  /* The % sign is REQUIRED. Without it "NURC 410 (2026)" reads as 2026 percent
     and "Quiz 1" as 1 — both of which appear in this account. A bare number in
     a title is never a weight. */
  /* The sign is INSIDE the capture. Left outside it, "-5%" matched "5%" and
     came back as 5 — a negative weight drawn as a positive chip. */
  const matches = [...title.matchAll(/(-?\d{1,3}(?:[.,]\d{1,2})?)\s*%/g)];
  if (matches.length === 0) return null;

  /* The FIRST one. A title carrying two — "worth 40% (was 30%)" — means the
     first; taking the largest would quietly promote a superseded figure. */
  const value = Number(matches[0][1].replace(",", "."));
  if (!Number.isFinite(value)) return null;

  /* 0 is not a weight, it is a typo or a placeholder, and showing "0% من
     الدرجة" on an exam tells a student it does not matter. Over 100 is
     likewise a misread — usually a year or a mark out of 150. */
  if (value <= 0 || value > 100) return null;

  /* One decimal at most. "12.5%" is real on some syllabuses; "12.50%" is the
     same number and the extra zero makes the chip wider for nothing. */
  return Math.round(value * 10) / 10;
}
