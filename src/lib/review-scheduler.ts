import { prisma } from "@/lib/prisma";
import { ReviewStage, ReviewType, type Prisma } from "@prisma/client";

export const DEFAULT_REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;

export const REVIEW_STAGES: ReviewStage[] = [
  ReviewStage.REVIEW_1,
  ReviewStage.REVIEW_2,
  ReviewStage.REVIEW_3,
  ReviewStage.REVIEW_4,
  ReviewStage.MASTERY_REVIEW,
];

interface CreateReviewScheduleInput {
  userId: string;
  subjectId: string;
  lectureId?: string | null;
  topicId?: string | null;
  flashcardId?: string | null;
  knowledgeGapId?: string | null;
  mistakeId?: string | null;
  type: ReviewType;
  intervals?: number[];
  startDate?: Date;
}

/**
 * Creates the full review chain (Review 1 -> Mastery Review) the moment a
 * lecture is completed, a topic is flagged difficult, a knowledge gap is
 * resolved, or a problem is answered incorrectly. This is what keeps
 * "REVIEW TODAY" populated without the student having to schedule anything.
 */
export async function createReviewSchedule(input: CreateReviewScheduleInput) {
  const intervals = input.intervals ?? DEFAULT_REVIEW_INTERVALS;
  const start = input.startDate ?? new Date();

  const rows: Prisma.ReviewItemCreateManyInput[] = intervals.map((days, i) => {
    const scheduledDate = new Date(start);
    scheduledDate.setDate(scheduledDate.getDate() + days);
    return {
      userId: input.userId,
      subjectId: input.subjectId,
      lectureId: input.lectureId ?? null,
      topicId: input.topicId ?? null,
      flashcardId: input.flashcardId ?? null,
      knowledgeGapId: input.knowledgeGapId ?? null,
      mistakeId: input.mistakeId ?? null,
      type: input.type,
      scheduledDate,
      reviewStage: REVIEW_STAGES[i] ?? ReviewStage.MASTERY_REVIEW,
    };
  });

  await prisma.reviewItem.createMany({ data: rows });
}

export async function getUserReviewIntervals(userId: string): Promise<number[]> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const settings = user?.profileSettings as { reviewIntervals?: number[] } | null;
  return settings?.reviewIntervals ?? [...DEFAULT_REVIEW_INTERVALS];
}
