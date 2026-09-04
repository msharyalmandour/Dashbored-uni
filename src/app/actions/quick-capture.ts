"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, verifySubject } from "@/lib/authz";
import {
  Difficulty,
  GapSource,
  TaskType,
  TaskPriority,
  VideoPlatform,
} from "@prisma/client";

export type QuickCaptureType =
  | "TASK"
  | "KNOWLEDGE_GAP"
  | "FLASHCARD"
  | "PROBLEM"
  | "MISTAKE"
  | "TRAINING_NOTE"
  | "VIDEO"
  | "LECTURE";

export async function getQuickCaptureContext() {
  const userId = await requireUserId();
  const subjects = await prisma.subject.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });
  return { subjects };
}

interface QuickCaptureInput {
  type: QuickCaptureType;
  subjectId?: string;
  fields: Record<string, string>;
}

/**
 * CAPTURE NOW -> ORGANIZE LATER. One entry point for every record type the
 * app supports, so the student never has to navigate away from what they're
 * doing to jot something down.
 */
export async function createQuickCapture(input: QuickCaptureInput) {
  const userId = await requireUserId();
  const { type, subjectId, fields } = input;
  if (subjectId) await verifySubject(userId, subjectId);

  switch (type) {
    case "TASK": {
      if (!fields.title || !fields.deadline) throw new Error("Title and deadline are required.");
      await prisma.task.create({
        data: {
          userId,
          subjectId: subjectId || null,
          title: fields.title,
          description: fields.description || null,
          type: (fields.taskType as TaskType) || TaskType.ASSIGNMENT,
          deadline: new Date(fields.deadline),
          priority: (fields.priority as TaskPriority) || TaskPriority.MEDIUM,
        },
      });
      break;
    }
    case "KNOWLEDGE_GAP": {
      if (!fields.title || !subjectId) throw new Error("Title and subject are required.");
      await prisma.knowledgeGap.create({
        data: {
          subjectId,
          title: fields.title,
          description: fields.description || null,
          source: (fields.source as GapSource) || GapSource.OTHER,
          difficulty: (fields.difficulty as Difficulty) || Difficulty.MEDIUM,
        },
      });
      break;
    }
    case "FLASHCARD": {
      if (!fields.front || !fields.back || !subjectId)
        throw new Error("Front, back, and subject are required.");
      await prisma.flashcard.create({
        data: {
          userId,
          subjectId,
          front: fields.front,
          back: fields.back,
          difficulty: (fields.difficulty as Difficulty) || Difficulty.MEDIUM,
        },
      });
      break;
    }
    case "PROBLEM": {
      if (!fields.question || !fields.correctAnswer || !subjectId)
        throw new Error("Question, answer, and subject are required.");
      await prisma.problem.create({
        data: {
          userId,
          subjectId,
          question: fields.question,
          correctAnswer: fields.correctAnswer,
          difficulty: (fields.difficulty as Difficulty) || Difficulty.MEDIUM,
        },
      });
      break;
    }
    case "MISTAKE": {
      if (!fields.whyIGotItWrong || !subjectId) throw new Error("Subject and note are required.");
      await prisma.mistake.create({
        data: {
          userId,
          subjectId,
          mistakeType: (fields.mistakeType as never) || "MISUNDERSTANDING",
          whyIGotItWrong: fields.whyIGotItWrong,
          correctConcept: fields.correctConcept || null,
          whatIShouldReview: fields.whatIShouldReview || null,
        },
      });
      break;
    }
    case "TRAINING_NOTE": {
      if (!fields.reflection) throw new Error("A reflection note is required.");
      await prisma.clinicalTraining.create({
        data: {
          userId,
          date: fields.date ? new Date(fields.date) : new Date(),
          hospital: fields.hospital || null,
          department: fields.department || null,
          reflection: fields.reflection,
          whatIDidNotUnderstand: fields.whatIDidNotUnderstand || null,
        },
      });
      break;
    }
    case "VIDEO": {
      if (!fields.title || !fields.url) throw new Error("Title and URL are required.");
      await prisma.video.create({
        data: {
          userId,
          subjectId: subjectId || null,
          title: fields.title,
          url: fields.url,
          platform: (fields.platform as VideoPlatform) || VideoPlatform.YOUTUBE,
        },
      });
      break;
    }
    case "LECTURE": {
      if (!fields.title || !subjectId) throw new Error("Title and subject are required.");
      await prisma.lecture.create({
        data: {
          subjectId,
          title: fields.title,
          date: fields.date ? new Date(fields.date) : new Date(),
          lectureNumber: Number(fields.lectureNumber) || 1,
        },
      });
      break;
    }
  }

  revalidatePath("/", "layout");
}
