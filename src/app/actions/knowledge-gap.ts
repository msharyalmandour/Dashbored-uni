"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requireUserId,
  verifySubject,
  verifyLecture,
  verifyTopic,
  verifyClinicalTraining,
  assertMutated,
} from "@/lib/authz";
import { parseOrThrow, shortText } from "@/lib/validation";
import { createReviewSchedule } from "@/lib/review-scheduler";
import { GapStatus, ReviewType, Difficulty, GapSource } from "@prisma/client";

export async function updateGapStatus(gapId: string, status: GapStatus) {
  const userId = await requireUserId();
  const isResolved = status === GapStatus.UNDERSTOOD || status === GapStatus.MASTERED;

  const { count } = await prisma.knowledgeGap.updateMany({
    where: { id: gapId, subject: { userId } },
    data: { status, resolvedAt: isResolved ? new Date() : null },
  });
  assertMutated(count, "Knowledge gap");

  // "Automatically create review schedules when a knowledge gap is resolved."
  if (isResolved) {
    const gap = await prisma.knowledgeGap.findUniqueOrThrow({ where: { id: gapId } });
    const existing = await prisma.reviewItem.findFirst({
      where: { knowledgeGapId: gapId, type: ReviewType.KNOWLEDGE_GAP },
    });
    if (!existing) {
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
  const userId = await requireUserId();
  await verifySubject(userId, input.subjectId);
  if (input.lectureId) await verifyLecture(userId, input.lectureId);
  if (input.topicId) await verifyTopic(userId, input.topicId);
  if (input.clinicalTrainingId) await verifyClinicalTraining(userId, input.clinicalTrainingId);
  const title = parseOrThrow(shortText, input.title, "title");

  await prisma.knowledgeGap.create({
    data: {
      subjectId: input.subjectId,
      lectureId: input.lectureId || null,
      topicId: input.topicId || null,
      clinicalTrainingId: input.clinicalTrainingId || null,
      title,
      description: input.description || null,
      difficulty: input.difficulty,
      source: input.source,
    },
  });
  revalidatePath("/knowledge-gaps");
  revalidatePath("/clinical");
}
