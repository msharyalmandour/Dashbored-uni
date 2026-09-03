"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import type { TaskType, TaskPriority, TaskStatus } from "@prisma/client";

export async function createTask(input: {
  title: string;
  description?: string;
  type: TaskType;
  deadline: string;
  priority: TaskPriority;
  subjectId?: string;
}) {
  const userId = await getCurrentUserId();
  await prisma.task.create({
    data: {
      userId,
      subjectId: input.subjectId || null,
      title: input.title,
      description: input.description || null,
      type: input.type,
      deadline: new Date(input.deadline),
      priority: input.priority,
    },
  });
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  await prisma.task.update({
    where: { id },
    data: { status, completionPercentage: status === "COMPLETED" ? 100 : undefined },
  });
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/");
}
