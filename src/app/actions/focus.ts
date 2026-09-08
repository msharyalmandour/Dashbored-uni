"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, verifySubject, verifyLecture, assertMutated } from "@/lib/authz";
import { parseOrThrow, positiveInt, nonNegativeInt } from "@/lib/validation";

export async function startFocusSession(input: {
  subjectId?: string;
  lectureId?: string;
  taskLabel?: string;
  plannedMinutes: number;
}) {
  const userId = await requireUserId();
  if (input.subjectId) await verifySubject(userId, input.subjectId);
  if (input.lectureId) await verifyLecture(userId, input.lectureId);
  const plannedMinutes = parseOrThrow(positiveInt, input.plannedMinutes, "planned minutes");

  const session = await prisma.focusSession.create({
    data: {
      userId,
      subjectId: input.subjectId || null,
      lectureId: input.lectureId || null,
      taskLabel: input.taskLabel || null,
      plannedMinutes,
    },
  });
  return session.id;
}

/**
 * End-of-session reflection: "What did you accomplish? What didn't you
 * understand? What should you review later?" — answers are stored on the
 * session, and an unclear note becomes a real Knowledge Gap automatically.
 */
export async function endFocusSession(input: {
  sessionId: string;
  actualMinutes: number;
  accomplished?: string;
  notUnderstood?: string;
  toReview?: string;
}) {
  const userId = await requireUserId();
  const actualMinutes = parseOrThrow(nonNegativeInt, input.actualMinutes, "actual minutes");

  const { count } = await prisma.focusSession.updateMany({
    where: { id: input.sessionId, userId },
    data: {
      status: "COMPLETED",
      endedAt: new Date(),
      actualMinutes,
      accomplished: input.accomplished || null,
      notUnderstood: input.notUnderstood || null,
      toReview: input.toReview || null,
    },
  });
  assertMutated(count, "Focus session");

  const session = await prisma.focusSession.findUniqueOrThrow({ where: { id: input.sessionId } });

  let createdGap = false;
  if (input.notUnderstood && session.subjectId) {
    await prisma.knowledgeGap.create({
      data: {
        subjectId: session.subjectId,
        lectureId: session.lectureId,
        title: input.notUnderstood.slice(0, 100),
        description: input.notUnderstood,
        source: "OTHER",
      },
    });
    createdGap = true;
  }

  revalidatePath("/focus");
  revalidatePath("/knowledge-gaps");
  revalidatePath("/");
  return { createdGap };
}
