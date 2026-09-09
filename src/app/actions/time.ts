"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, verifySubject, assertMutated } from "@/lib/authz";
import { parseOrThrow, id as idSchema } from "@/lib/validation";
import { MINUTES_PER_DAY } from "@/lib/time-intelligence";
import type { CommitmentKind } from "@prisma/client";

/**
 * The student's real week.
 *
 * Everything written here is something a person actually told the system.
 * That matters more than it looks: these rows are the only reason the app can
 * ever say "you have two hours left today" without making it up, so nothing
 * in this file infers, defaults, or backfills a commitment on the student's
 * behalf.
 */

const COMMITMENT_KINDS = [
  "SLEEP",
  "UNIVERSITY",
  "CLINICAL",
  "COMMUTE",
  "MEALS",
  "WORK",
  "PERSONAL",
] as const satisfies readonly CommitmentKind[];

const minuteOfDay = z.number().int().min(0).max(MINUTES_PER_DAY - 1);

const commitmentSchema = z.object({
  kind: z.enum(COMMITMENT_KINDS),
  label: z.string().trim().max(120).optional(),
  /** Null is "every day" — the honest shape of sleep and meals. */
  weekday: z.number().int().min(0).max(6).nullable(),
  startMinute: minuteOfDay,
  endMinute: minuteOfDay,
  subjectId: idSchema.nullable().optional(),
});

export type CommitmentInput = z.infer<typeof commitmentSchema>;

/**
 * A zero-length block is always a mistake rather than a wrap: 09:00 → 09:00
 * says nothing, while 23:00 → 07:00 says sleep. Rejecting the first keeps
 * the wrap rule (`end <= start` crosses midnight) unambiguous everywhere
 * downstream.
 */
function rejectEmptySpan(input: CommitmentInput) {
  if (input.startMinute === input.endMinute) {
    throw new Error("A commitment needs a start and an end that differ.");
  }
}

export async function createTimeCommitment(input: CommitmentInput) {
  const userId = await requireUserId();
  const data = parseOrThrow(commitmentSchema, input, "commitment");
  rejectEmptySpan(data);

  if (data.subjectId) await verifySubject(userId, data.subjectId);

  const commitment = await prisma.timeCommitment.create({
    data: {
      userId,
      kind: data.kind,
      label: data.label || null,
      weekday: data.weekday,
      startMinute: data.startMinute,
      endMinute: data.endMinute,
      subjectId: data.subjectId ?? null,
    },
    select: { id: true },
  });

  revalidatePath("/time");
  revalidatePath("/");
  return commitment;
}

export async function updateTimeCommitment(commitmentId: string, input: CommitmentInput) {
  const userId = await requireUserId();
  const parsedId = parseOrThrow(idSchema, commitmentId, "commitment id");
  const data = parseOrThrow(commitmentSchema, input, "commitment");
  rejectEmptySpan(data);

  if (data.subjectId) await verifySubject(userId, data.subjectId);

  // Scoped by userId in the same statement, so another user's row cannot be
  // reached even with a valid-looking id.
  const { count } = await prisma.timeCommitment.updateMany({
    where: { id: parsedId, userId },
    data: {
      kind: data.kind,
      label: data.label || null,
      weekday: data.weekday,
      startMinute: data.startMinute,
      endMinute: data.endMinute,
      subjectId: data.subjectId ?? null,
    },
  });
  assertMutated(count, "Commitment");

  revalidatePath("/time");
  revalidatePath("/");
}

export async function deleteTimeCommitment(commitmentId: string) {
  const userId = await requireUserId();
  const parsedId = parseOrThrow(idSchema, commitmentId, "commitment id");

  const { count } = await prisma.timeCommitment.deleteMany({
    where: { id: parsedId, userId },
  });
  assertMutated(count, "Commitment");

  revalidatePath("/time");
  revalidatePath("/");
}

/**
 * How long a task really takes.
 *
 * Null is a legitimate value and clears the estimate: "we don't know" is a
 * state the planner handles explicitly, and is a better answer than a number
 * nobody stands behind.
 */
export async function setTaskEstimate(taskId: string, minutes: number | null) {
  const userId = await requireUserId();
  const parsedId = parseOrThrow(idSchema, taskId, "task id");
  const estimatedMinutes =
    minutes === null
      ? null
      : parseOrThrow(z.number().int().min(5).max(100 * 60), minutes, "estimate");

  const { count } = await prisma.task.updateMany({
    where: { id: parsedId, userId },
    data: { estimatedMinutes },
  });
  assertMutated(count, "Task");

  revalidatePath("/tasks");
  revalidatePath("/time");
  revalidatePath("/");
}
