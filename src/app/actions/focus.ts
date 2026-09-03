"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";

export async function startFocusSession(input: {
  subjectId?: string;
  lectureId?: string;
  taskLabel?: string;
  plannedMinutes: number;
}) {
  const userId = await getCurrentUserId();
  const session = await prisma.focusSession.create({
    data: {
      userId,
      subjectId: input.subjectId || null,
      lectureId: input.lectureId || null,
      taskLabel: input.taskLabel || null,
      plannedMinutes: input.plannedMinutes,
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
  const session = await prisma.focusSession.update({
    where: { id: input.sessionId },
    data: {
      status: "COMPLETED",
      endedAt: new Date(),
      actualMinutes: input.actualMinutes,
      accomplished: input.accomplished || null,
      notUnderstood: input.notUnderstood || null,
      toReview: input.toReview || null,
    },
  });

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
