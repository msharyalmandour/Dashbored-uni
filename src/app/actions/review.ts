"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { gradeFlashcard, type ReviewGrade } from "@/lib/spaced-repetition";

export async function completeReviewItem(id: string) {
  await prisma.reviewItem.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  revalidatePath("/review");
  revalidatePath("/");
}

export async function skipReviewItem(id: string) {
  await prisma.reviewItem.update({ where: { id }, data: { status: "SKIPPED" } });
  revalidatePath("/review");
  revalidatePath("/");
}

export async function gradeFlashcardAction(cardId: string, grade: ReviewGrade) {
  const card = await prisma.flashcard.findUniqueOrThrow({ where: { id: cardId } });
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
