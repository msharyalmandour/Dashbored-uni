import { prisma } from "@/lib/prisma";
import type { Prisma, StudentEventType } from "@prisma/client";

/**
 * Recording what the student did.
 *
 * This is the only writer of behaviour in the codebase, and it writes facts
 * with timestamps — never interpretations. "A 45-minute session was started at
 * 21:10 and never finished" is a fact. "The student struggles at night" is an
 * interpretation, and it is computed on demand from facts like that one,
 * somewhere else, where it can be recomputed when the student changes.
 *
 * Nothing here is ever updated. The table has no UPDATE policy, so a rewrite
 * would be refused by the database rather than by convention.
 */

export interface ObservationContext {
  plannedMinutes?: number;
  actualMinutes?: number;
  energy?: "LOW" | "NORMAL" | "HIGH";
  /** Minutes the student said they had, when they were asked. */
  statedMinutes?: number;
  /** How far a deadline moved, in days. Positive means later. */
  movedDays?: number;
  /** Which suggestion an accept/decline refers to. */
  suggestion?: string;
  /** Hour of day (0-23) the event happened in the student's own timezone. */
  hour?: number;
  taskType?: string;
}

/**
 * Writes one observation.
 *
 * Deliberately never throws. An event is a by-product of something the student
 * was actually trying to do — finishing a task, ending a session — and failing
 * their action because the observation failed would trade something they care
 * about for something only the system cares about. This is the one place in
 * the codebase where swallowing an error is right, precisely because nothing
 * here is the student's own content: every event is re-derivable from the
 * action that produced it, and a missing one only makes a pattern arrive
 * later.
 */
export async function recordEvent(
  userId: string,
  input: {
    type: StudentEventType;
    occurredAt?: Date;
    taskId?: string | null;
    focusSessionId?: string | null;
    subjectId?: string | null;
    context?: ObservationContext;
  }
): Promise<void> {
  try {
    await prisma.studentEvent.create({
      data: {
        userId,
        type: input.type,
        occurredAt: input.occurredAt ?? new Date(),
        taskId: input.taskId ?? null,
        focusSessionId: input.focusSessionId ?? null,
        subjectId: input.subjectId ?? null,
        context: (input.context ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    console.error("[student-events] failed to record", input.type, error);
  }
}

/** Same, for several events at once — one round trip instead of N. */
export async function recordEvents(
  userId: string,
  events: Array<Parameters<typeof recordEvent>[1]>
): Promise<void> {
  if (events.length === 0) return;
  try {
    await prisma.studentEvent.createMany({
      data: events.map((e) => ({
        userId,
        type: e.type,
        occurredAt: e.occurredAt ?? new Date(),
        taskId: e.taskId ?? null,
        focusSessionId: e.focusSessionId ?? null,
        subjectId: e.subjectId ?? null,
        context: (e.context ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
    });
  } catch (error) {
    console.error("[student-events] failed to record batch", error);
  }
}
