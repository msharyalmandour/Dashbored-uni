"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, verifySubject, assertMutated } from "@/lib/authz";
import { parseOrThrow, shortText, dateString } from "@/lib/validation";
import { recordEvent } from "@/lib/student-events";
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

  // Read before writing, because the event wants the task's shape and the
  // update itself does not return it. Scoped by userId, so this is also the
  // ownership check.
  const before = await prisma.task.findFirst({
    where: { id, userId },
    select: { id: true, type: true, subjectId: true, status: true },
  });
  assertMutated(before ? 1 : 0, "Task");

  const { count } = await prisma.task.updateMany({
    where: { id, userId },
    data: { status, completionPercentage: status === "COMPLETED" ? 100 : undefined },
  });
  assertMutated(count, "Task");

  // Only the transition into COMPLETED is an event. Re-saving an already
  // completed task is not a second completion, and counting it as one would
  // let a stray click look like a productive afternoon.
  if (status === "COMPLETED" && before!.status !== "COMPLETED") {
    const now = new Date();
    await recordEvent(userId, {
      type: "TASK_COMPLETED",
      taskId: id,
      subjectId: before!.subjectId,
      occurredAt: now,
      context: { hour: now.getHours(), taskType: before!.type },
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/");
}

/**
 * Moving a deadline.
 *
 * Nothing in the product could do this before, which meant a student whose
 * plan had slipped had two options: leave a date that was already wrong, or
 * mark something done that wasn't. Both corrupt the record the rest of the
 * app reasons from, so the honest fix is to let the date move.
 *
 * The move is recorded — not to judge it. A deadline that moves once is a
 * week that changed. A deadline that moves four times is a task that needs a
 * different approach, and noticing that is the only reason this is stored.
 */
export async function postponeTask(id: string, newDeadline: string) {
  const userId = await requireUserId();
  const parsed = parseOrThrow(dateString, newDeadline, "deadline");
  const deadline = new Date(parsed);

  const before = await prisma.task.findFirst({
    where: { id, userId },
    select: { id: true, deadline: true, type: true, subjectId: true },
  });
  assertMutated(before ? 1 : 0, "Task");

  const movedDays = Math.round(
    (deadline.getTime() - before!.deadline.getTime()) / 86400000
  );

  const { count } = await prisma.task.updateMany({
    where: { id, userId },
    data: { deadline },
  });
  assertMutated(count, "Task");

  // Only a move to a *later* date is a postponement. Pulling a deadline
  // forward is the opposite behaviour and must not be counted as the same
  // thing, or a student getting ahead would look like one falling behind.
  if (movedDays > 0) {
    await recordEvent(userId, {
      type: "TASK_POSTPONED",
      taskId: id,
      subjectId: before!.subjectId,
      context: { movedDays, taskType: before!.type },
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { movedDays };
}
