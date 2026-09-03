"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { createReviewSchedule } from "@/lib/review-scheduler";
import { ReviewType, LectureStatus, Difficulty, ResourceType } from "@prisma/client";

export async function updateLectureStatus(lectureId: string, status: LectureStatus) {
  const lecture = await prisma.lecture.update({
    where: { id: lectureId },
    data: {
      status,
      completionPercentage: status === "COMPLETED" ? 100 : status === "NOT_STARTED" ? 0 : undefined,
    },
  });

  // "Automatically create review schedules when a lecture is completed."
  if (status === "COMPLETED") {
    const existing = await prisma.reviewItem.findFirst({
      where: { lectureId, type: ReviewType.LECTURE },
    });
    if (!existing) {
      const userId = await getCurrentUserId();
      await createReviewSchedule({
        userId,
        subjectId: lecture.subjectId,
        lectureId: lecture.id,
        topicId: lecture.topicId,
        type: ReviewType.LECTURE,
      });
    }
  }

  revalidatePath(`/lectures/${lectureId}`);
  revalidatePath(`/subjects/${lecture.subjectId}`);
  revalidatePath("/");
}

export async function updateCompletionPercentage(lectureId: string, percentage: number) {
  const lecture = await prisma.lecture.update({
    where: { id: lectureId },
    data: {
      completionPercentage: percentage,
      status: percentage >= 100 ? LectureStatus.COMPLETED : percentage > 0 ? LectureStatus.IN_PROGRESS : LectureStatus.NOT_STARTED,
    },
  });
  revalidatePath(`/lectures/${lectureId}`);
  revalidatePath(`/subjects/${lecture.subjectId}`);
}

export async function updateSelfAssessment(lectureId: string, value: number) {
  await prisma.lecture.update({ where: { id: lectureId }, data: { selfAssessment: value } });
  revalidatePath(`/lectures/${lectureId}`);
}

export async function updateLectureNotes(lectureId: string, notes: string) {
  await prisma.lecture.update({ where: { id: lectureId }, data: { quickNotes: notes } });
  revalidatePath(`/lectures/${lectureId}`);
}

export async function addLectureResource(input: {
  lectureId: string;
  type: ResourceType;
  title: string;
  url?: string;
}) {
  await prisma.lectureResource.create({
    data: { lectureId: input.lectureId, type: input.type, title: input.title, url: input.url || null },
  });
  revalidatePath(`/lectures/${input.lectureId}`);
}

export async function addLectureGap(input: {
  lectureId: string;
  subjectId: string;
  topicId?: string | null;
  title: string;
  description?: string;
  difficulty: Difficulty;
}) {
  await prisma.knowledgeGap.create({
    data: {
      subjectId: input.subjectId,
      lectureId: input.lectureId,
      topicId: input.topicId || null,
      title: input.title,
      description: input.description || null,
      difficulty: input.difficulty,
      source: "LECTURE",
    },
  });
  revalidatePath(`/lectures/${input.lectureId}`);
}

export async function addLectureFlashcard(input: {
  lectureId: string;
  subjectId: string;
  topicId?: string | null;
  front: string;
  back: string;
  difficulty: Difficulty;
}) {
  const userId = await getCurrentUserId();
  await prisma.flashcard.create({
    data: {
      userId,
      subjectId: input.subjectId,
      lectureId: input.lectureId,
      topicId: input.topicId || null,
      front: input.front,
      back: input.back,
      difficulty: input.difficulty,
    },
  });
  revalidatePath(`/lectures/${input.lectureId}`);
}

export async function addLectureProblem(input: {
  lectureId: string;
  subjectId: string;
  topicId?: string | null;
  question: string;
  correctAnswer: string;
  difficulty: Difficulty;
}) {
  const userId = await getCurrentUserId();
  await prisma.problem.create({
    data: {
      userId,
      subjectId: input.subjectId,
      lectureId: input.lectureId,
      topicId: input.topicId || null,
      question: input.question,
      correctAnswer: input.correctAnswer,
      difficulty: input.difficulty,
    },
  });
  revalidatePath(`/lectures/${input.lectureId}`);
}
