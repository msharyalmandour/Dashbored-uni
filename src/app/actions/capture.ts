"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { attachUploadedDocument } from "@/app/actions/documents";
import { organizeWithAgent, parseReviewNotes } from "@/lib/ai/agent/organize";
import type { ReviewFinding } from "@/lib/ai/agent/review";
import { undoCaptureWrites, undoTotal, type UndoSummary } from "@/lib/ai/agent/undo";
import { recordEvent } from "@/lib/student-events";
import type { AgentRunResult } from "@/lib/ai/agent/types";
import { downloadDocumentFileAsUser } from "@/lib/document-storage";
import { getAccessToken } from "@/lib/supabase/server";
import { getAiStatus } from "@/lib/ai/provider";
import { parseOrThrow, id as idSchema, longText } from "@/lib/validation";
import { describeFile } from "@/lib/capture-kinds";
import type { DocumentCategory } from "@prisma/client";

/**
 * "Drop anything." Two entry points to get something in — one for text, one
 * for files — and one to hand it to the agent. Neither entry point asks the
 * student to classify, choose a course, or name anything, which is the point:
 * deciding what a thing is, and doing something about it, is the agent's job.
 */

/**
 * Records a typed or pasted thought and hands back the row immediately.
 *
 * The organising is *not* awaited here. Capture must feel instant, and the
 * agent takes seconds; the client starts `organizeWithAI` right after and
 * watches the row move through its states.
 */
export async function captureText(text: string) {
  const userId = await requireUserId();
  const content = parseOrThrow(longText, text, "note");

  const capture = await prisma.captureItem.create({
    data: { userId, kind: "TEXT", text: content, status: "PENDING" },
    select: { id: true },
  });

  revalidatePath("/inbox");
  return capture;
}

/**
 * Why one file did not make it in.
 *
 * A code rather than a sentence, because the sentence has to be in the
 * student's language and this runs on the server, which does not know it.
 */
export type CaptureFailureReason = "TOO_BIG" | "BLOCKED_TYPE" | "UPLOAD_FAILED";

/**
 * Records a file the browser uploaded straight to Storage.
 *
 * The counterpart to `requestUploadSlot`, and the path every dropped file now
 * takes. Only the path and the name cross the wire, so the request is a few
 * hundred bytes whatever the file weighs — which is the entire point: the
 * 4.5MB cap that used to decide what a student could drop no longer applies
 * to anything but this metadata.
 */
export async function captureUploadedFile(input: { path: string; fileName: string }) {
  const userId = await requireUserId();

  const { category: kind } = describeFile(input.fileName, "");
  const category: DocumentCategory = kind === "IMAGE" ? "IMAGE" : "OTHER";

  // Ownership of the path, the real size, and the file's existence are all
  // established in here — nothing above this line trusts the caller.
  const document = await attachUploadedDocument({
    path: input.path,
    fileName: input.fileName,
    category,
  });

  const capture = await prisma.captureItem.create({
    data: { userId, kind: "FILE", documentId: document.id, status: "PENDING" },
    select: { id: true },
  });

  revalidatePath("/inbox");
  return { id: capture.id, name: input.fileName };
}

/**
 * Hands one dropped item to the agent, and reports exactly what it did.
 *
 * This is the primary path now. What it replaced ran in two stages —
 * `requestAnalysis` to produce a fixed classification, then a switch statement
 * to decide what that classification was allowed to mean — and the switch
 * knew about three outcomes, so three outcomes were all the product could ever
 * have. Most of what the model understood was computed and discarded at the
 * moment of writing. Here it reaches the writes itself.
 *
 * `studentAnswer` carries a reply to a question a previous run asked. The run
 * is started again from the item rather than resumed mid-conversation, which
 * costs one re-read and avoids keeping a transcript — with a base64 photograph
 * inside it — in the database for every item ever dropped.
 */
/**
 * The run's outcome, plus anything reading the rows back turned up.
 *
 * The findings ride on the result rather than being fetched separately by the
 * page, because the moment they are worth reading is the moment the student is
 * looking at what just happened: a class at 3am is obvious to them then, and
 * invisible a week later when it is simply part of their calendar.
 */
export type OrganizeOutcome = AgentRunResult & { review: ReviewFinding[] };

export async function organizeWithAI(
  captureId: string,
  studentAnswer?: string
): Promise<OrganizeOutcome> {
  const userId = await requireUserId();
  const parsedId = parseOrThrow(idSchema, captureId, "capture id");

  const owned = await prisma.captureItem.findFirst({
    where: { id: parsedId, userId },
    select: { id: true },
  });
  if (!owned) throw new Error("Not found: Capture");

  const answer = studentAnswer ? parseOrThrow(longText, studentAnswer, "answer").slice(0, 300) : undefined;

  // Scoped to this user's own token, so Storage RLS still authorizes the read.
  // The service-role downloader belongs to the cron and must never be used on
  // a request path.
  const accessToken = await getAccessToken();
  const result = await organizeWithAgent(parsedId, (path) =>
    downloadDocumentFileAsUser(path, accessToken), { studentAnswer: answer });

  // Everything the agent can touch, refreshed at once. Which pages actually
  // changed depends on what it decided to do, and revalidating a page that
  // did not change costs a re-render the student never sees.
  revalidatePath("/inbox");
  revalidatePath("/");
  revalidatePath("/academics");
  revalidatePath("/tasks");
  revalidatePath("/knowledge-gaps");
  revalidatePath("/flashcards");
  revalidatePath("/mistakes");
  revalidatePath("/time");
  revalidatePath("/calendar");

  // Read back what the review pass recorded, so the findings travel with the
  // outcome rather than waiting for the page to fetch them separately.
  const reviewed = await prisma.captureItem.findUnique({
    where: { id: parsedId },
    select: { reviewNotes: true },
  });

  return { ...result, review: parseReviewNotes(reviewed?.reviewNotes) };
}

/**
 * Takes back everything one drop wrote.
 *
 * The item itself stays in the inbox, unorganised, rather than disappearing:
 * "that was wrong" and "I am finished with this" are different intentions, and
 * a student who undoes a bad reading of their timetable usually wants to try
 * again with a better photo. `discardCapture` is the other one.
 *
 * The uploaded file is never deleted here — undoing the organising is not
 * "destroy what I uploaded". Nor is a course the student has since added their
 * own work to; `undoCaptureWrites` explains why in detail.
 */
export async function undoDrop(captureId: string): Promise<UndoSummary> {
  const userId = await requireUserId();
  const parsedId = parseOrThrow(idSchema, captureId, "capture id");

  const owned = await prisma.captureItem.findFirst({
    where: { id: parsedId, userId },
    select: { id: true, agentSummary: true },
  });
  if (!owned) throw new Error("Not found: Capture");

  // Read before the undo clears it: what the agent said it did is the most
  // informative part of the correction, and in a moment it will be gone.
  const undoneNote = owned.agentSummary;

  const summary = await undoCaptureWrites(parsedId, userId);

  // The strongest correction the student can make, and until now the system
  // learned nothing from it. Not "this row is wrong" but "none of that was
  // right", said about a specific drop — which is what makes it worth keeping.
  if (undoTotal(summary) > 0) {
    const undone: Record<string, number> = {};
    for (const [kind, count] of Object.entries(summary)) {
      if (typeof count === "number" && count > 0) undone[kind] = count;
    }
    await recordEvent(userId, {
      type: "DROP_UNDONE",
      // The agent's own account of the drop travels with the correction. "Put 6
      // classes into your week", marked as undone, tells the next run far more
      // than a count of deleted rows ever could.
      context: { undone, note: undoneNote ?? undefined },
    });
  }

  // Back to where it was before the agent touched it, with the action log
  // cleared — leaving the log would have the inbox reporting rows that no
  // longer exist, which is the same dishonesty in the other direction.
  await prisma.captureItem.update({
    where: { id: parsedId },
    data: {
      status: "UNPROCESSED",
      organizedAt: null,
      agentActions: [],
      agentSummary: null,
      analyzedBy: null,
      error: null,
    },
  });

  if (undoTotal(summary) > 0) {
    revalidatePath("/inbox");
    revalidatePath("/");
    revalidatePath("/academics");
    revalidatePath("/tasks");
    revalidatePath("/knowledge-gaps");
    revalidatePath("/flashcards");
    revalidatePath("/mistakes");
    revalidatePath("/time");
    revalidatePath("/calendar");
  } else {
    revalidatePath("/inbox");
  }

  return summary;
}

/** Whether an AI provider is configured, for the inbox to report plainly. */
export async function getAiAvailability() {
  await requireUserId();
  return getAiStatus();
}

/**
 * Removes a capture from the inbox.
 *
 * The Document is deliberately left alone: deleting an inbox entry means "I
 * have dealt with this", not "destroy the file I uploaded". Files are removed
 * from wherever they were filed, by the existing delete path.
 */
export async function discardCapture(captureId: string) {
  const userId = await requireUserId();
  const parsedId = parseOrThrow(idSchema, captureId, "capture id");

  // Read before the delete, because binning an item the agent could not handle
  // is itself a correction: not "this row is wrong" but "you failed at this and
  // I gave up on it". Binning something that was organised fine is not, so only
  // the unresolved ones are recorded.
  const before = await prisma.captureItem.findFirst({
    where: { id: parsedId, userId },
    select: { status: true, error: true, agentSummary: true },
  });

  const { count } = await prisma.captureItem.deleteMany({ where: { id: parsedId, userId } });
  if (count === 0) throw new Error("Not found: Capture");

  if (before && before.status !== "ORGANIZED") {
    await recordEvent(userId, {
      type: "AGENT_ROW_DELETED",
      context: { note: (before.error ?? before.agentSummary ?? "").slice(0, 200) || undefined },
    });
  }

  revalidatePath("/inbox");
}
