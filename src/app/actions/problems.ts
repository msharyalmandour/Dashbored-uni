"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { createReviewSchedule } from "@/lib/review-scheduler";
import { MistakeType, ReviewType, Difficulty } from "@prisma/client";

interface SubmitAttemptInput {
  problemId: string;
  userAnswer: string;
  outcome: "CORRECT" | "INCORRECT" | "NEEDS_RETRY";
  mistake?: {
    mistakeType: MistakeType;
    whyIGotItWrong: string;
    correctConcept?: string;
    whatIShouldReview?: string;
  };
}

/**
 * "Every incorrect problem must generate a MISTAKE RECORD." Also schedules
 * a review chain for incorrect attempts so the concept resurfaces.
 */
export async function submitProblemAttempt(input: SubmitAttemptInput) {
  const userId = await getCurrentUserId();
  const problem = await prisma.problem.update({
    where: { id: input.problemId },
    data: {
      userAnswer: input.userAnswer,
      status: input.outcome,
      attempts: { increment: 1 },
    },
  });

  if (input.outcome === "INCORRECT" && input.mistake) {
    // Bump frequency if this exact concept has been missed before.
    const existingMistake = await prisma.mistake.findFirst({
      where: { userId, problemId: problem.id },
    });

    if (existingMistake) {
      await prisma.mistake.update({
        where: { id: existingMistake.id },
        data: { frequency: { increment: 1 }, status: "OPEN" },
      });
    } else {
      await prisma.mistake.create({
        data: {
          userId,
          problemId: problem.id,
          subjectId: problem.subjectId,
          topicId: problem.topicId,
          lectureId: problem.lectureId,
          knowledgeGapId: problem.knowledgeGapId,
          mistakeType: input.mistake.mistakeType,
          whyIGotItWrong: input.mistake.whyIGotItWrong,
          correctConcept: input.mistake.correctConcept || null,
          whatIShouldReview: input.mistake.whatIShouldReview || null,
        },
      });
    }

    const existingReview = await prisma.reviewItem.findFirst({
      where: { userId, type: ReviewType.MISTAKE, subjectId: problem.subjectId, topicId: problem.topicId },
    });
    if (!existingReview) {
      await createReviewSchedule({
        userId,
        subjectId: problem.subjectId,
        topicId: problem.topicId,
        lectureId: problem.lectureId,
        type: ReviewType.MISTAKE,
      });
    }
  }

  revalidatePath("/problems");
  revalidatePath("/mistakes");
  revalidatePath("/");
}

export async function createProblem(input: {
  subjectId: string;
  topicId?: string;
  lectureId?: string;
  question: string;
  correctAnswer: string;
  difficulty: Difficulty;
}) {
  const userId = await getCurrentUserId();
  await prisma.problem.create({
    data: {
      userId,
      subjectId: input.subjectId,
      topicId: input.topicId || null,
      lectureId: input.lectureId || null,
      question: input.question,
      correctAnswer: input.correctAnswer,
      difficulty: input.difficulty,
    },
  });
  revalidatePath("/problems");
}
