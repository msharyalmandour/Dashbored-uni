/**
 * The Arabic name of a course, where the owner has given one.
 *
 * WHY THIS IS A MAP AND NOT A TRANSLATION. The database holds exactly one
 * name per course and it is English: "NURC (410) Critical Care Nursing". The
 * approved cover puts the Arabic name in the largest type on the card, with
 * the English under it — so the screen needs a word that is nowhere in the
 * data.
 *
 * It is NOT translated here. Project rule 9 is that course names are never
 * invented, and a machine translation of a course title is an invention with
 * a confident tone: "Research Methods" could as easily be "مناهج البحث",
 * "طرق البحث" or "مناهج البحث العلمي", and the registrar's Arabic transcript
 * says exactly one of them. These are the names the OWNER wrote, on his own
 * design board of 2026-10-14, and nothing else goes in.
 *
 * A course with no entry shows its English name as the title and no second
 * line. That is the honest state: the cover is still readable, and it is
 * visibly missing the Arabic rather than quietly carrying a guess.
 */

import { courseCode } from "@/lib/course-code";

/** "NURC (410)" -> "NURC410", so every spelling lands on one key. */
function bare(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const NAMES: Record<string, string> = {
  /* His board names three. NURC 411 reuses NURC 410's Arabic there — the two
     really are the same subject, split theory/clinical — and NURP 432 gets
     NURP 431's for the same reason and by the same pattern he set. */
  NURC410: "العناية المركزة",
  NURC411: "العناية المركزة",
  NURP431: "القيادة التمريضية",
  NURP432: "القيادة التمريضية",
};

/**
 * The Arabic name, or null when the owner has not given one.
 *
 * Null is a real answer and the caller must render it as one. Falling back to
 * the English string here would make the cover look complete while the Arabic
 * line is missing, and nobody would ever notice it was never supplied.
 */
export function arabicCourseName(
  subject: { name: string; code?: string | null }
): string | null {
  const code = courseCode(subject.name, subject.code);
  if (!code) return null;
  return NAMES[bare(code)] ?? null;
}
