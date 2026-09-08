"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, assertMutated } from "@/lib/authz";
import { gradeFlashcard, type ReviewGrade } from "@/lib/spaced-repetition";

export async function completeReviewItem(id: string) {
  const userId = await requireUserId();
  const { count } = await prisma.reviewItem.updateMany({
    where: { id, userId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  assertMutated(count, "Review item");
  revalidatePath("/review");
  revalidatePath("/");
}

export async function skipReviewItem(id: string) {
  const userId = await requireUserId();
  const { count } = await prisma.reviewItem.updateMany({ where: { id, userId }, data: { status: "SKIPPED" } });
  assertMutated(count, "Review item");
  revalidatePath("/review");
  revalidatePath("/");
}

export async function gradeFlashcardAction(cardId: string, grade: ReviewGrade) {
  const userId = await requireUserId();
  const card = await prisma.flashcard.findFirst({ where: { id: cardId, userId } });
  if (!card) throw new Error("Not found: Flashcard");

  const result = gradeFlashcard(card, grade);

  await prisma.flashcard.update({
    where: { id: cardId },
    data: {
      intervalDays: result.intervalDays,
      easeFactor: result.easeFactor,
      nextReviewDate: result.nextReviewDate,
      status: result.status,
      lastReviewed: new Date(),
      reviewCount: { increment: 1 },
      correctCount: result.wasCorrect ? { increment: 1 } : undefined,
      incorrectCount: !result.wasCorrect ? { increment: 1 } : undefined,
    },
  });

  revalidatePath("/flashcards");
  revalidatePath("/");
  return result;
}
