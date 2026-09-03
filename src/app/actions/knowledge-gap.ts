"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { createReviewSchedule } from "@/lib/review-scheduler";
import { GapStatus, ReviewType, Difficulty, GapSource } from "@prisma/client";

export async function updateGapStatus(gapId: string, status: GapStatus) {
  const isResolved = status === GapStatus.UNDERSTOOD || status === GapStatus.MASTERED;
  const gap = await prisma.knowledgeGap.update({
    where: { id: gapId },
    data: { status, resolvedAt: isResolved ? new Date() : null },
  });

  // "Automatically create review schedules when a knowledge gap is resolved."
  if (isResolved) {
    const existing = await prisma.reviewItem.findFirst({
      where: { knowledgeGapId: gapId, type: ReviewType.KNOWLEDGE_GAP },
    });
    if (!existing) {
      const userId = await getCurrentUserId();
      await createReviewSchedule({
        userId,
        subjectId: gap.subjectId,
        lectureId: gap.lectureId,
        topicId: gap.topicId,
        knowledgeGapId: gap.id,
        type: ReviewType.KNOWLEDGE_GAP,
      });
    }
  }

  revalidatePath("/knowledge-gaps");
  revalidatePath("/");
}

export async function createKnowledgeGap(input: {
  subjectId: string;
  lectureId?: string;
  topicId?: string;
  clinicalTrainingId?: string;
  title: string;
  description?: string;
  difficulty: Difficulty;
  source: GapSource;
}) {
  await prisma.knowledgeGap.create({
    data: {
      subjectId: input.subjectId,
      lectureId: input.lectureId || null,
      topicId: input.topicId || null,
      clinicalTrainingId: input.clinicalTrainingId || null,
      title: input.title,
      description: input.description || null,
      difficulty: input.difficulty,
      source: input.source,
    },
  });
  revalidatePath("/knowledge-gaps");
  revalidatePath("/clinical");
}
