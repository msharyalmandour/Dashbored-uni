"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, verifySemester, verifySubject, verifyTopic, assertMutated } from "@/lib/authz";
import { parseOrThrow, shortText, dateString, hexColor, positiveInt, rating1to5 } from "@/lib/validation";
import { Difficulty, SemesterStatus, SubjectStatus, LectureStatus } from "@prisma/client";

export async function createSemester(input: {
  name: string;
  startDate: string;
  endDate: string;
  status?: SemesterStatus;
}) {
  const userId = await requireUserId();
  const name = parseOrThrow(shortText, input.name, "name");
  const startDate = parseOrThrow(dateString, input.startDate, "start date");
  const endDate = parseOrThrow(dateString, input.endDate, "end date");

  await prisma.semester.create({
    data: {
      userId,
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: input.status ?? SemesterStatus.ACTIVE,
    },
  });
  revalidatePath("/academics");
}

export async function createSubject(input: {
  semesterId: string;
  name: string;
  code?: string;
  instructor?: string;
  color: string;
  creditHours: number;
}) {
  const userId = await requireUserId();
  await verifySemester(userId, input.semesterId);
  const name = parseOrThrow(shortText, input.name, "name");
  const color = parseOrThrow(hexColor, input.color, "color");
  const creditHours = parseOrThrow(positiveInt, input.creditHours, "credit hours");

  const subject = await prisma.subject.create({
    data: {
      userId,
      semesterId: input.semesterId,
      name,
      code: input.code || null,
      instructor: input.instructor || null,
      color,
      creditHours,
      status: SubjectStatus.ACTIVE,
    },
  });
  revalidatePath("/academics");
  return subject;
}

export async function updateSubjectStatus(subjectId: string, status: SubjectStatus) {
  const userId = await requireUserId();
  const { count } = await prisma.subject.updateMany({ where: { id: subjectId, userId }, data: { status } });
  assertMutated(count, "Subject");
  revalidatePath("/academics");
  revalidatePath(`/subjects/${subjectId}`);
}

export async function createTopic(input: {
  subjectId: string;
  name: string;
  description?: string;
  difficulty: Difficulty;
}) {
  const userId = await requireUserId();
  await verifySubject(userId, input.subjectId);
  const name = parseOrThrow(shortText, input.name, "name");

  await prisma.topic.create({
    data: {
      subjectId: input.subjectId,
      name,
      description: input.description || null,
      difficulty: input.difficulty,
    },
  });
  revalidatePath(`/subjects/${input.subjectId}`);
}

export async function createLecture(input: {
  subjectId: string;
  topicId?: string;
  title: string;
  lectureNumber: number;
  date: string;
  lecturer?: string;
  difficultyRating?: number;
}) {
  const userId = await requireUserId();
  await verifySubject(userId, input.subjectId);
  if (input.topicId) await verifyTopic(userId, input.topicId);
  const title = parseOrThrow(shortText, input.title, "title");
  const date = parseOrThrow(dateString, input.date, "date");
  const lectureNumber = parseOrThrow(positiveInt, input.lectureNumber, "lecture number");
  const difficultyRating = input.difficultyRating !== undefined ? parseOrThrow(rating1to5, input.difficultyRating, "difficulty rating") : 3;

  const lecture = await prisma.lecture.create({
    data: {
      subjectId: input.subjectId,
      topicId: input.topicId || null,
      title,
      lectureNumber,
      date: new Date(date),
      lecturer: input.lecturer || null,
      difficultyRating,
      status: LectureStatus.NOT_STARTED,
    },
  });
  revalidatePath(`/subjects/${input.subjectId}`);
  return lecture;
}
