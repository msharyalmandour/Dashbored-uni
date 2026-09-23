/**
 * What is actually waiting to be reviewed — from both places it can be waiting.
 *
 * This app schedules review twice, on purpose, and then only ever asked one of
 * them:
 *
 *   Flashcard.nextReviewDate   the card's own schedule, advanced by answering
 *                              it. Defaults to now(), so a new card is due the
 *                              moment it exists. /flashcards reads this.
 *
 *   ReviewItem.scheduledDate   a five-stage chain (1, 3, 7, 14, 30 days)
 *                              created when a LECTURE is completed, a gap is
 *                              resolved, or a problem is answered wrong.
 *                              /review and the dashboard tile read this.
 *
 * Nothing creates a ReviewItem when a flashcard is created. The scheduler's own
 * comment says it "keeps REVIEW TODAY populated without the student having to
 * schedule anything", and it is called from three places, none of which is
 * making a card.
 *
 * Measured on the real account: 42 flashcards due, 42 of 42, and ReviewItem
 * empty — 0 rows, ever. So the dashboard told the student "0 reviews due" while
 * they held forty-two due cards, the page called Review showed nothing, and the
 * only place the work appeared was a page you had to already know to open.
 * Thirteen of the forty-two had ever been answered. That is not a student
 * avoiding review; that is an app saying there is nothing to do.
 *
 * The fix is not a third schedule. A card's own nextReviewDate is authoritative
 * for that card — it is what answering the card updates — and ReviewItem is
 * authoritative for the lecture, gap and mistake chains. Asking both, and
 * saying the true total, is all that was missing.
 */

import type { Prisma } from "@prisma/client";

/** Cards whose own schedule says they are due. */
export function dueFlashcardsWhere(userId: string, now: Date): Prisma.FlashcardWhereInput {
  if (!userId) throw new Error("Counting due reviews needs to know whose they are.");
  return { userId, nextReviewDate: { lte: now } };
}

/**
 * Scheduled reviews that are due and are NOT about a flashcard.
 *
 * The exclusion is the whole subtlety. A ReviewItem carrying a flashcardId is
 * the same piece of work as that card being due, so counting both reports two
 * things to do where the student sees one card — and a number that overstates
 * the pile is its own reason not to start. Lecture, gap and mistake chains
 * carry no flashcardId and are counted in full.
 */
export function dueReviewItemsWhere(userId: string, now: Date): Prisma.ReviewItemWhereInput {
  if (!userId) throw new Error("Counting due reviews needs to know whose they are.");
  return {
    userId,
    status: { in: ["SCHEDULED", "DUE"] },
    scheduledDate: { lte: now },
    flashcardId: null,
  };
}

/**
 * The one number the interface shows.
 *
 * Kept as a function rather than an addition at each call site because there
 * are three of them — the dashboard tile, the review page, and the home card —
 * and three places that each add up their own total is three places that can
 * disagree about what the student owes.
 */
export function totalDue(counts: { flashcards: number; reviewItems: number }): number {
  return counts.flashcards + counts.reviewItems;
}
