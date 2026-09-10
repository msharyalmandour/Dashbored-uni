"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { createDocument } from "@/app/actions/documents";
import { organizeWithAgent } from "@/lib/ai/agent/organize";
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
 * Records dropped files.
 *
 * Each file goes through the existing document path — same storage, same
 * validation, same extraction pipeline — and the capture row points at the
 * Document rather than copying it. A screenshot pasted from the clipboard
 * arrives here as an image/png File and needs no special case.
 *
 * Category is IMAGE or OTHER at this stage on purpose: what the file *is* is
 * exactly the question capture refuses to ask up front. Filing it under
 * LECTURE happens when the proposal is confirmed.
 */
/**
 * Why one file did not make it in.
 *
 * A code rather than a sentence, because the sentence has to be in the
 * student's language and this runs on the server, which does not know it.
 */
export type CaptureFailureReason = "TOO_BIG" | "BLOCKED_TYPE" | "UPLOAD_FAILED";

export type CaptureFilesResult = {
  created: { id: string; name: string }[];
  failed: { name: string; reason: CaptureFailureReason }[];
};

export async function captureFiles(formData: FormData): Promise<CaptureFilesResult> {
  const userId = await requireUserId();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  const created: CaptureFilesResult["created"] = [];
  const failed: CaptureFilesResult["failed"] = [];

  for (const file of files) {
    try {
      // Category is the file's shape, not a decision about what it is for —
      // that is exactly the question Drop Anything refuses to ask up front.
      const { category: kind } = describeFile(file.name, file.type);
      const category: DocumentCategory = kind === "IMAGE" ? "IMAGE" : "OTHER";
      const document = await createDocument({ file, category });

      const capture = await prisma.captureItem.create({
        data: { userId, kind: "FILE", documentId: document.id, status: "PENDING" },
        select: { id: true },
      });
      created.push({ id: capture.id, name: file.name });
    } catch (err) {
      // Returned, never thrown, and this is the whole point. A production
      // build withholds the message of anything a Server Action throws, so
      // "Failed to upload file: mime type not supported" reached neither the
      // student nor the logs — it became React's opaque placeholder, and the
      // real reason took a database query and a look at the storage bucket to
      // find. A failure that travels back as data can actually be shown.
      //
      // It also stops one bad file from sinking the rest: dropping six things
      // used to fail entirely because of whichever one the storage layer
      // disliked, including the five that were fine.
      const message = err instanceof Error ? err.message : "";
      failed.push({
        name: file.name,
        reason: /larger than/i.test(message)
          ? "TOO_BIG"
          : /can't be stored|cannot be stored/i.test(message)
            ? "BLOCKED_TYPE"
            : "UPLOAD_FAILED",
      });
      // Kept for whoever maintains this; never sent to the browser.
      console.error(`captureFiles: ${file.name} failed —`, message);
    }
  }

  revalidatePath("/inbox");
  return { created, failed };
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
export async function organizeWithAI(
  captureId: string,
  studentAnswer?: string
): Promise<AgentRunResult> {
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

  return result;
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

  const { count } = await prisma.captureItem.deleteMany({ where: { id: parsedId, userId } });
  if (count === 0) throw new Error("Not found: Capture");

  revalidatePath("/inbox");
}
