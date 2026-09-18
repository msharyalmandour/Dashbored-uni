"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, assertMutated, verifySubject, verifyLecture } from "@/lib/authz";
import { parseOrThrow, optionalLongText } from "@/lib/validation";
import type { MistakeStatus, MistakeType } from "@prisma/client";

export async function updateMistakeStatus(id: string, status: MistakeStatus) {
  const userId = await requireUserId();
  const { count } = await prisma.mistake.updateMany({ where: { id, userId }, data: { status } });
  assertMutated(count, "Mistake");
  revalidatePath("/mistakes");
}

/**
 * Record a mistake by hand.
 *
 * Until now there was no way to. A mistake could be written by three things —
 * a wrong answer in the problem bank, a drop the agent read, or quick capture —
 * and by nothing a student did deliberately. So the one moment this journal
 * exists for, "I got that wrong in the exam and I want to remember why", had no
 * door: the page could only be read, filtered and ticked off.
 *
 * `whyIGotItWrong` carries the weight and is the only field worth insisting on;
 * the two after it are useful and frequently unknown at the moment of writing.
 * Demanding all three is how a journal stops being written in.
 */
export async function createMistake(input: {
  subjectId: string;
  mistakeType: MistakeType;
  whyIGotItWrong?: string;
  correctConcept?: string;
  whatIShouldReview?: string;
  lectureId?: string;
  topicId?: string;
}) {
  const userId = await requireUserId();
  await verifySubject(userId, input.subjectId);
  if (input.lectureId) await verifyLecture(userId, input.lectureId);

  /* A topic belongs to a course; checking it against THIS course is what stops
     a caller filing a mistake under someone else's topic. */
  if (input.topicId) {
    const topic = await prisma.topic.findFirst({
      where: { id: input.topicId, subjectId: input.subjectId, subject: { userId } },
      select: { id: true },
    });
    if (!topic) throw new Error("Not found: Topic");
  }

  const mistake = await prisma.mistake.create({
    data: {
      userId,
      subjectId: input.subjectId,
      lectureId: input.lectureId || null,
      topicId: input.topicId || null,
      mistakeType: input.mistakeType,
      whyIGotItWrong: parseOrThrow(optionalLongText, input.whyIGotItWrong || undefined, "why") ?? null,
      correctConcept: parseOrThrow(optionalLongText, input.correctConcept || undefined, "correct concept") ?? null,
      whatIShouldReview:
        parseOrThrow(optionalLongText, input.whatIShouldReview || undefined, "what to review") ?? null,
    },
  });

  revalidatePath("/mistakes");
  if (input.lectureId) revalidatePath(`/lectures/${input.lectureId}`);
  return mistake;
}
