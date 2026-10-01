"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, verifySubject, verifyLecture, verifyTask, assertMutated } from "@/lib/authz";
import { parseOrThrow, positiveInt, nonNegativeInt, shortText } from "@/lib/validation";
import { recordEvent } from "@/lib/student-events";
import { reconcileStaleSessions } from "@/lib/focus-reconcile";
import { targetFrom, targetColumns } from "@/lib/follow-through";

export async function startFocusSession(input: {
  subjectId?: string;
  lectureId?: string;
  taskLabel?: string;
  plannedMinutes: number;
  /** Set when the session came from a recommendation about a specific task,
   *  which is what makes estimate-versus-actual comparable later. */
  taskId?: string;
}) {
  const userId = await requireUserId();
  if (input.subjectId) await verifySubject(userId, input.subjectId);
  if (input.lectureId) await verifyLecture(userId, input.lectureId);
  if (input.taskId) await verifyTask(userId, input.taskId);
  const plannedMinutes = parseOrThrow(positiveInt, input.plannedMinutes, "planned minutes");

  // Starting a new session is the natural moment to close out ones the
  // student walked away from: they are demonstrably back, and whatever was
  // left ACTIVE is demonstrably over.
  await reconcileStaleSessions(userId);

  /* What this session is for, recorded on the session rather than only in the
     event log.

     Measured on the real account: nine sessions, two finished, and both of
     those had a target the app had written from one of the student's records
     while all seven abandonments had none or a free-typed one. That is two
     observations — below patterns.ts's MIN_OBSERVATIONS — so nothing acts on
     it yet. The point of writing it here is that in a month it is enough
     observations to either confirm the design decision in follow-through.ts or
     kill it, and until now the distinction was unrecoverable: it existed only
     in the shape of a label, across two languages.

     The classification lives in follow-through.ts and is tested there, so the
     one mapping that is not obvious — a lectureId with no section is FREE,
     because "study this lecture" has no completion condition — is a decision
     with a test behind it rather than a line in an action. */
  const target = targetFrom({
    taskId: input.taskId,
    lectureId: input.lectureId,
    taskLabel: input.taskLabel,
  });

  const session = await prisma.focusSession.create({
    data: {
      userId,
      subjectId: input.subjectId || null,
      lectureId: input.lectureId || null,
      taskLabel: input.taskLabel || null,
      plannedMinutes,
      ...targetColumns(target),
    },
  });

  await recordEvent(userId, {
    type: "SESSION_STARTED",
    focusSessionId: session.id,
    subjectId: session.subjectId,
    taskId: input.taskId || null,
    context: { plannedMinutes, hour: session.startedAt.getHours() },
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
  /* The note the student typed WHILE working, if they typed one. The two
     other fields this used to take — `notUnderstood` and `toReview` — came
     from an end-of-session form that nobody ever filled: nine sessions, zero
     words, across all three boxes. The columns stay on the row so the rows
     already written keep their shape; nothing writes to them any more. The
     gap that `notUnderstood` used to raise is raised during the session
     instead, by a button that is one tap and is actually used. */
  accomplished?: string;
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
    },
  });
  assertMutated(count, "Focus session");

  const session = await prisma.focusSession.findUniqueOrThrow({ where: { id: input.sessionId } });

  /* A gap used to be raised here, from the "what did you not understand"
     box on the end-of-session form. That box is gone — nine sessions, zero
     words — and with it the only input this branch ever had, so the branch
     went too rather than sitting behind a condition that can never be true.
     Gaps are raised DURING a session now, by a button that is one tap and is
     actually used; that path writes its own row and does not come through
     here. `createdGap` stays in the return shape because the client reads it
     to decide whether to mention a new gap, and it is now always false. */
  const createdGap = false;

  // Planned against actual, on the one event that carries both. This is the
  // whole basis of the session-length and duration-calibration patterns —
  // and it is only trustworthy because sessions that were *never* finished
  // are now recorded too, by reconcileStaleSessions.
  await recordEvent(userId, {
    type: "SESSION_COMPLETED",
    focusSessionId: session.id,
    subjectId: session.subjectId,
    context: {
      plannedMinutes: session.plannedMinutes,
      actualMinutes,
      hour: session.startedAt.getHours(),
    },
  });

  revalidatePath("/focus");
  revalidatePath("/knowledge-gaps");
  revalidatePath("/");
  return { createdGap };
}

/**
 * "I don't understand this", said mid-session.
 *
 * The student is in the middle of working and something is not landing. The
 * whole point is that they do not stop, navigate somewhere, pick a course
 * from a dropdown and classify their own confusion — the session already
 * knows which subject and lecture they are on, so the context comes from
 * there and they only have to say what was unclear.
 *
 * The note is also kept on the session, so an end-of-session reflection does
 * not lose what was already said. Nothing about this is shown back to the
 * student as "a Knowledge Gap was created": they said they were stuck, and
 * the useful reply is that we will bring it back to them.
 */
export async function noteConfusion(input: { sessionId: string; note: string }) {
  const userId = await requireUserId();
  const note = parseOrThrow(shortText, input.note, "note");

  const session = await prisma.focusSession.findFirst({
    where: { id: input.sessionId, userId },
    select: { id: true, subjectId: true, lectureId: true, notUnderstood: true },
  });
  if (!session) throw new Error("Not found: Focus session");

  // Without a subject there is nothing to attach it to, so it is kept on the
  // session rather than dropped — better held in the wrong shape than lost.
  if (session.subjectId) {
    await prisma.knowledgeGap.create({
      data: {
        subjectId: session.subjectId,
        lectureId: session.lectureId,
        title: note.slice(0, 100),
        description: note,
        source: "OTHER",
      },
    });
  }

  await prisma.focusSession.update({
    where: { id: session.id },
    data: {
      notUnderstood: session.notUnderstood ? `${session.notUnderstood}\n${note}` : note,
    },
  });

  // Being stuck is an observation, not a verdict. It is recorded so that a
  // task which keeps producing them can be noticed — never so that anything
  // can be concluded about the student.
  //
  // The task comes from the session's own start event rather than a column:
  // FocusSession deliberately has no taskId (adding one would be the column
  // change this layer exists to avoid), so the link lives where it was first
  // written. Without this lookup the event would carry no task at all and
  // per-task friction could never see it.
  const start = await prisma.studentEvent.findFirst({
    where: { userId, focusSessionId: session.id, type: "SESSION_STARTED" },
    select: { taskId: true },
  });

  await recordEvent(userId, {
    type: "STUDENT_STUCK",
    focusSessionId: session.id,
    subjectId: session.subjectId,
    taskId: start?.taskId ?? null,
  });

  revalidatePath("/knowledge-gaps");
  return { connected: !!session.subjectId };
}
