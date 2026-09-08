import type { Flashcard } from "@prisma/client";
import { FlashcardStatus } from "@prisma/client";

export type ReviewGrade = "AGAIN" | "HARD" | "GOOD" | "EASY";

export interface SpacedRepetitionResult {
  intervalDays: number;
  easeFactor: number;
  nextReviewDate: Date;
  status: FlashcardStatus;
  wasCorrect: boolean;
}

const MIN_EASE = 1.3;
const MASTERY_INTERVAL_DAYS = 21;

/**
 * Simplified SM-2. Grades map to the classic "again / hard / good / easy"
 * buttons used by Anki-style reviewers.
 */
export function gradeFlashcard(
  card: Pick<Flashcard, "intervalDays" | "easeFactor" | "reviewCount">,
  grade: ReviewGrade,
  now: Date = new Date()
): SpacedRepetitionResult {
  let { intervalDays, easeFactor } = card;
  const wasCorrect = grade !== "AGAIN";

  if (grade === "AGAIN") {
    intervalDays = 0; // due again today, treated as "later today"
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
  } else {
    if (intervalDays <= 0) {
      intervalDays = 1;
    } else if (intervalDays === 1) {
      intervalDays = 4;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }

    if (grade === "HARD") easeFactor = Math.max(MIN_EASE, easeFactor - 0.15);
    if (grade === "EASY") easeFactor = easeFactor + 0.15;
  }

  const nextReviewDate = new Date(now);
  if (intervalDays <= 0) {
    nextReviewDate.setHours(nextReviewDate.getHours() + 6);
  } else {
    nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);
  }

  let status: FlashcardStatus = FlashcardStatus.REVIEWING;
  if (grade === "AGAIN") status = FlashcardStatus.LEARNING;
  else if (card.reviewCount === 0) status = FlashcardStatus.LEARNING;
  else if (intervalDays >= MASTERY_INTERVAL_DAYS) status = FlashcardStatus.MASTERED;

  return { intervalDays, easeFactor, nextReviewDate, status, wasCorrect };
}

/** Higher score = more urgent to review. Used to order the due queue. */
export function flashcardUrgencyScore(card: {
  nextReviewDate: Date;
  difficulty: string;
  incorrectCount: number;
  correctCount: number;
  knowledgeGapId?: string | null;
}, now: Date = new Date()): number {
  const overdueDays = Math.max(
    0,
    (now.getTime() - new Date(card.nextReviewDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const difficultyWeight = card.difficulty === "HARD" ? 15 : card.difficulty === "MEDIUM" ? 8 : 0;
  const missRate =
    card.incorrectCount + card.correctCount > 0
      ? card.incorrectCount / (card.incorrectCount + card.correctCount)
      : 0;

  let score = overdueDays * 10 + difficultyWeight + missRate * 30;
  if (card.knowledgeGapId) score += 12;
  return score;
}
