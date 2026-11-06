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
 * HARD shortens the step; EASY lengthens it. Both are measured against what
 * GOOD would have given, which is what makes the four buttons four answers.
 */
const HARD_MULTIPLIER = 1.2;
const EASY_BONUS = 1.3;

/**
 * Simplified SM-2. Grades map to the classic "again / hard / good / easy"
 * buttons used by Anki-style reviewers.
 *
 * THREE OF THE FOUR BUTTONS USED TO DO THE SAME THING. The ease factor was
 * adjusted AFTER the interval was computed from it, so HARD, GOOD and EASY
 * all returned the identical next interval and only diverged on the review
 * after that:
 *
 *   interval 4, ease 2.5  ->  HARD 10d   GOOD 10d   EASY 10d
 *   interval 10, ease 2.5 ->  HARD 25d   GOOD 25d   EASY 25d
 *
 * Measured on this account: 42 cards, 16 reviews already graded through that
 * path. It was invisible because nothing showed the student what a button
 * would do — and it stops being invisible the moment the review screen does,
 * which is what the design asks for: "تحت كل زر متى ترجع البطاقة". A screen
 * printing the same date under three buttons is the honest rendering of a
 * broken scheduler, so the scheduler is fixed rather than the screen.
 *
 * GOOD'S LADDER IS UNTOUCHED — 0 -> 1 -> 4 -> round(i × ease) — because his
 * fifteen reviewed cards are sitting on it and changing it would reschedule
 * work he has already done. HARD and EASY are now computed from GOOD's result
 * rather than being GOOD with a different ease nudge.
 *
 * ON A BRAND-NEW CARD, HARD AND GOOD BOTH LAND TOMORROW, and that is real
 * rather than a leftover: at day granularity there is nothing between "today"
 * and "tomorrow" to put between them. They still differ in ease, so the
 * review after that diverges. The preview says tomorrow for both because
 * tomorrow is the truth.
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
    /* What GOOD would give. The other two are derived from it, so the three
       can never collapse onto the same number again. */
    const good =
      intervalDays <= 0 ? 1 : intervalDays === 1 ? 4 : Math.round(intervalDays * easeFactor);

    if (grade === "HARD") {
      /* From the CURRENT interval, not from GOOD's — "hard" means a smaller
         step than last time, not a smaller version of a big step. At least a
         day, or a card he found hard would come back today and the queue
         would never drain. */
      intervalDays = Math.max(1, Math.round(intervalDays * HARD_MULTIPLIER));
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.15);
    } else if (grade === "EASY") {
      intervalDays = Math.max(good + 1, Math.round(good * EASY_BONUS));
      easeFactor = easeFactor + 0.15;
    } else {
      intervalDays = good;
    }
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


/**
 * What each button would do, from the same function that does it.
 *
 * NOT A SECOND IMPLEMENTATION. The obvious way to label the buttons is to
 * write the formula again in the component — and then the label and the
 * behaviour drift the first time either changes, which is worse than no
 * label: a student who has learned to trust "بعد 10 أيام" and gets 25 stops
 * trusting the screen rather than the number. This calls `gradeFlashcard`
 * four times, so the preview is the outcome by construction.
 */
export function previewGrades(
  card: Pick<Flashcard, "intervalDays" | "easeFactor" | "reviewCount">,
  now: Date = new Date()
): Record<ReviewGrade, SpacedRepetitionResult> {
  return {
    AGAIN: gradeFlashcard(card, "AGAIN", now),
    HARD: gradeFlashcard(card, "HARD", now),
    GOOD: gradeFlashcard(card, "GOOD", now),
    EASY: gradeFlashcard(card, "EASY", now),
  };
}

/**
 * How to say when a card comes back, as a bucket and a number.
 *
 * A BUCKET AND NOT A STRING, so the words stay in the dictionaries and
 * Arabic can have its five plural forms. "بعد 45 يوم" is grammatical and
 * useless — a month and a half is what he needs to know, and no amount of
 * precision past that changes a decision.
 */
export type ReturnBucket =
  | { unit: "today" }
  | { unit: "tomorrow" }
  | { unit: "days"; count: number }
  | { unit: "months"; count: number };

export function returnBucket(intervalDays: number): ReturnBucket {
  if (intervalDays <= 0) return { unit: "today" };
  if (intervalDays === 1) return { unit: "tomorrow" };
  if (intervalDays < 30) return { unit: "days", count: intervalDays };
  /* Rounded, never floored: 59 days is "شهرين", not "شهر". Floor would say
     one month about something nearer two, under a button he presses to
     decide. */
  return { unit: "months", count: Math.max(1, Math.round(intervalDays / 30)) };
}
