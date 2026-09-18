import { prisma } from "@/lib/prisma";
import { clamp } from "@/lib/utils";

export interface UnderstandingScore {
  /**
   * Null when there is not enough real evidence to say anything. A number
   * here always means something was actually measured.
   */
  score: number | null;
  /**
   * Which inputs genuinely had evidence behind them. A component that nobody
   * has produced evidence for is absent rather than filled in.
   */
  basis: {
    knowledgeGaps: number | null;
    practice: number | null;
    flashcards: number | null;
    selfAssessment: number | null;
  };
  /** How many of the four inputs had real evidence. Zero means "unknown". */
  evidenceCount: number;
}

/**
 * How well a lecture is actually understood, or an honest admission that
 * there is no way to tell yet.
 *
 * This used to substitute 70 wherever evidence was missing — no practice
 * attempts, no flashcard reviews, no self-assessment all became "70". A
 * lecture nobody had touched therefore reported "Understanding: 70%", which
 * is a confident-looking number manufactured out of nothing, and a student
 * could reasonably have decided not to revise something on the strength of
 * it.
 *
 * Now each component is null when it has no evidence, the score is the
 * weighted average of only the components that do, and a lecture with no
 * evidence at all scores null rather than average.
 */
export async function computeLectureUnderstanding(lectureId: string): Promise<UnderstandingScore> {
  const [gaps, problems, flashcards, lecture] = await Promise.all([
    prisma.knowledgeGap.findMany({ where: { lectureId } }),
    prisma.problem.findMany({ where: { lectureId } }),
    prisma.flashcard.findMany({ where: { lectureId } }),
    prisma.lecture.findUnique({ where: { id: lectureId } }),
  ]);

  // Gaps are the one component that is meaningful when empty: "nothing has
  // been flagged as not understood" is itself evidence, as long as the
  // lecture has some other sign of having been engaged with.
  const unresolvedGaps = gaps.filter((g) => g.status !== "UNDERSTOOD" && g.status !== "MASTERED");
  const gapComponent = gaps.length > 0 ? clamp(100 - unresolvedGaps.length * 20, 0, 100) : null;

  const attemptedProblems = problems.filter((p) => p.status === "CORRECT" || p.status === "INCORRECT");
  const practiceComponent =
    attemptedProblems.length > 0
      ? (problems.filter((p) => p.status === "CORRECT").length / attemptedProblems.length) * 100
      : null;

  const reviewedCards = flashcards.filter((f) => f.reviewCount > 0);
  const answered = reviewedCards.reduce((s, f) => s + f.correctCount + f.incorrectCount, 0);
  const flashcardComponent =
    answered > 0
      ? (reviewedCards.reduce((s, f) => s + f.correctCount, 0) / answered) * 100
      : null;

  const selfAssessmentComponent = lecture?.selfAssessment ?? null;

  // Weighted over what actually exists, so a single real signal is reported
  // as that signal rather than diluted toward the middle by absent ones.
  const parts: { value: number; weight: number }[] = [];
  if (gapComponent !== null) parts.push({ value: gapComponent, weight: 0.3 });
  if (practiceComponent !== null) parts.push({ value: practiceComponent, weight: 0.25 });
  if (flashcardComponent !== null) parts.push({ value: flashcardComponent, weight: 0.25 });
  if (selfAssessmentComponent !== null) parts.push({ value: selfAssessmentComponent, weight: 0.2 });

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const score =
    parts.length === 0
      ? null
      : clamp(Math.round(parts.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight), 0, 100);

  return {
    score,
    basis: {
      knowledgeGaps: gapComponent,
      practice: practiceComponent,
      flashcards: flashcardComponent,
      selfAssessment: selfAssessmentComponent,
    },
    evidenceCount: parts.length,
  };
}
