"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { Difficulty, SemesterStatus, SubjectStatus, LectureStatus } from "@prisma/client";

export async function createSemester(input: {
  name: string;
  startDate: string;
  endDate: string;
  status?: SemesterStatus;
}) {
  const userId = await getCurrentUserId();
  await prisma.semester.create({
    data: {
      userId,
      name: input.name,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
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
  const userId = await getCurrentUserId();
  const subject = await prisma.subject.create({
    data: {
      userId,
      semesterId: input.semesterId,
      name: input.name,
      code: input.code || null,
      instructor: input.instructor || null,
      color: input.color,
      creditHours: input.creditHours,
      status: SubjectStatus.ACTIVE,
    },
  });
  revalidatePath("/academics");
  return subject;
}

export async function updateSubjectStatus(subjectId: string, status: SubjectStatus) {
  await prisma.subject.update({ where: { id: subjectId }, data: { status } });
  revalidatePath("/academics");
  revalidatePath(`/subjects/${subjectId}`);
}

export async function createTopic(input: {
  subjectId: string;
  name: string;
  description?: string;
  difficulty: Difficulty;
}) {
  await prisma.topic.create({
    data: {
      subjectId: input.subjectId,
      name: input.name,
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
  const lecture = await prisma.lecture.create({
    data: {
      subjectId: input.subjectId,
      topicId: input.topicId || null,
      title: input.title,
      lectureNumber: input.lectureNumber,
      date: new Date(input.date),
      lecturer: input.lecturer || null,
      difficultyRating: input.difficultyRating ?? 3,
      status: LectureStatus.NOT_STARTED,
    },
  });
  revalidatePath(`/subjects/${input.subjectId}`);
  return lecture;
}
