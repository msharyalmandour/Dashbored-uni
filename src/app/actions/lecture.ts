"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, verifyLecture, verifySubject, verifyTopic, assertMutated } from "@/lib/authz";
import { parseOrThrow, shortText, longText, optionalUrlString, percentage as percentageSchema } from "@/lib/validation";
import { createReviewSchedule } from "@/lib/review-scheduler";
import { ReviewType, LectureStatus, Difficulty, ResourceType } from "@prisma/client";

export async function updateLectureStatus(lectureId: string, status: LectureStatus) {
  const userId = await requireUserId();

  const { count } = await prisma.lecture.updateMany({
    where: { id: lectureId, subject: { userId } },
    data: {
      status,
      completionPercentage: status === "COMPLETED" ? 100 : status === "NOT_STARTED" ? 0 : undefined,
    },
  });
  assertMutated(count, "Lecture");

  const lecture = await prisma.lecture.findUniqueOrThrow({ where: { id: lectureId } });

  // "Automatically create review schedules when a lecture is completed."
  if (status === "COMPLETED") {
    const existing = await prisma.reviewItem.findFirst({
      where: { lectureId, type: ReviewType.LECTURE },
    });
    if (!existing) {
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
  const userId = await requireUserId();
  const value = parseOrThrow(percentageSchema, percentage, "completion percentage");

  const { count } = await prisma.lecture.updateMany({
    where: { id: lectureId, subject: { userId } },
    data: {
      completionPercentage: value,
      status: value >= 100 ? LectureStatus.COMPLETED : value > 0 ? LectureStatus.IN_PROGRESS : LectureStatus.NOT_STARTED,
    },
  });
  assertMutated(count, "Lecture");

  const lecture = await prisma.lecture.findUniqueOrThrow({ where: { id: lectureId } });
  revalidatePath(`/lectures/${lectureId}`);
  revalidatePath(`/subjects/${lecture.subjectId}`);
}

export async function updateSelfAssessment(lectureId: string, value: number) {
  const userId = await requireUserId();
  const parsedValue = parseOrThrow(percentageSchema, value, "self-assessment");
  const { count } = await prisma.lecture.updateMany({
    where: { id: lectureId, subject: { userId } },
    data: { selfAssessment: parsedValue },
  });
  assertMutated(count, "Lecture");
  revalidatePath(`/lectures/${lectureId}`);
}

export async function updateLectureNotes(lectureId: string, notes: string) {
  const userId = await requireUserId();
  const value = notes.length > 20000 ? notes.slice(0, 20000) : notes;
  const { count } = await prisma.lecture.updateMany({
    where: { id: lectureId, subject: { userId } },
    data: { quickNotes: value },
  });
  assertMutated(count, "Lecture");
  revalidatePath(`/lectures/${lectureId}`);
}

export async function addLectureResource(input: {
  lectureId: string;
  type: ResourceType;
  title: string;
  url?: string;
}) {
  const userId = await requireUserId();
  await verifyLecture(userId, input.lectureId);
  const title = parseOrThrow(shortText, input.title, "title");
  const url = input.url ? parseOrThrow(optionalUrlString, input.url, "url") : null;

  await prisma.lectureResource.create({
    data: { lectureId: input.lectureId, type: input.type, title, url: url || null },
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
  const userId = await requireUserId();
  await verifyLecture(userId, input.lectureId);
  await verifySubject(userId, input.subjectId);
  if (input.topicId) await verifyTopic(userId, input.topicId);
  const title = parseOrThrow(shortText, input.title, "title");

  await prisma.knowledgeGap.create({
    data: {
      subjectId: input.subjectId,
      lectureId: input.lectureId,
      topicId: input.topicId || null,
      title,
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
  const userId = await requireUserId();
  await verifyLecture(userId, input.lectureId);
  await verifySubject(userId, input.subjectId);
  if (input.topicId) await verifyTopic(userId, input.topicId);
  const front = parseOrThrow(longText, input.front, "front");
  const back = parseOrThrow(longText, input.back, "back");

  await prisma.flashcard.create({
    data: {
      userId,
      subjectId: input.subjectId,
      lectureId: input.lectureId,
      topicId: input.topicId || null,
      front,
      back,
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
  const userId = await requireUserId();
  await verifyLecture(userId, input.lectureId);
  await verifySubject(userId, input.subjectId);
  if (input.topicId) await verifyTopic(userId, input.topicId);
  const question = parseOrThrow(longText, input.question, "question");
  const correctAnswer = parseOrThrow(longText, input.correctAnswer, "correct answer");

  await prisma.problem.create({
    data: {
      userId,
      subjectId: input.subjectId,
      lectureId: input.lectureId,
      topicId: input.topicId || null,
      question,
      correctAnswer,
      difficulty: input.difficulty,
    },
  });
  revalidatePath(`/lectures/${input.lectureId}`);
}
