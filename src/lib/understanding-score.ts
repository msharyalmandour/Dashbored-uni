import { prisma } from "@/lib/prisma";
import { clamp } from "@/lib/utils";

export interface UnderstandingScore {
  score: number;
  basis: { knowledgeGaps: number; practice: number; flashcards: number; selfAssessment: number };
}

/**
 * "Understanding: 78% — Based on knowledge gaps, practice performance,
 * flashcard performance, self-assessment."
 */
export async function computeLectureUnderstanding(lectureId: string): Promise<UnderstandingScore> {
  const [gaps, problems, flashcards, lecture] = await Promise.all([
    prisma.knowledgeGap.findMany({ where: { lectureId } }),
    prisma.problem.findMany({ where: { lectureId } }),
    prisma.flashcard.findMany({ where: { lectureId } }),
    prisma.lecture.findUnique({ where: { id: lectureId } }),
  ]);

  const unresolvedGaps = gaps.filter((g) => g.status !== "UNDERSTOOD" && g.status !== "MASTERED");
  const gapComponent = clamp(100 - unresolvedGaps.length * 20, 0, 100);

  const attemptedProblems = problems.filter((p) => p.status === "CORRECT" || p.status === "INCORRECT");
  const practiceComponent =
    attemptedProblems.length > 0
      ? (problems.filter((p) => p.status === "CORRECT").length / attemptedProblems.length) * 100
      : 70;

  const reviewedCards = flashcards.filter((f) => f.reviewCount > 0);
  const flashcardComponent =
    reviewedCards.length > 0
      ? (reviewedCards.reduce((s, f) => s + f.correctCount, 0) /
          Math.max(
            1,
            reviewedCards.reduce((s, f) => s + f.correctCount + f.incorrectCount, 0)
          )) *
        100
      : 70;

  const selfAssessmentComponent = lecture?.selfAssessment ?? 70;

  const score = clamp(
    Math.round(
      gapComponent * 0.3 +
        practiceComponent * 0.25 +
        flashcardComponent * 0.25 +
        selfAssessmentComponent * 0.2
    ),
    0,
    100
  );

  return {
    score,
    basis: {
      knowledgeGaps: gapComponent,
      practice: practiceComponent,
      flashcards: flashcardComponent,
      selfAssessment: selfAssessmentComponent,
    },
  };
}
