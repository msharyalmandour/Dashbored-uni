"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, verifySubject, assertMutated } from "@/lib/authz";
import { parseOrThrow, shortText, dateString } from "@/lib/validation";
import type { TaskType, TaskPriority, TaskStatus } from "@prisma/client";

export async function createTask(input: {
  title: string;
  description?: string;
  type: TaskType;
  deadline: string;
  priority: TaskPriority;
  subjectId?: string;
}) {
  const userId = await requireUserId();
  if (input.subjectId) await verifySubject(userId, input.subjectId);
  const title = parseOrThrow(shortText, input.title, "title");
  const deadline = parseOrThrow(dateString, input.deadline, "deadline");

  await prisma.task.create({
    data: {
      userId,
      subjectId: input.subjectId || null,
      title,
      description: input.description || null,
      type: input.type,
      deadline: new Date(deadline),
      priority: input.priority,
    },
  });
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  const userId = await requireUserId();
  const { count } = await prisma.task.updateMany({
    where: { id, userId },
    data: { status, completionPercentage: status === "COMPLETED" ? 100 : undefined },
  });
  assertMutated(count, "Task");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/");
}
