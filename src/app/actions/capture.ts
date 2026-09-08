"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, verifySubject } from "@/lib/authz";
import { createDocument } from "@/app/actions/documents";
import { analyzeCapture, parseStoredAnalysis } from "@/lib/ai/analyze-capture";
import { getAiStatus } from "@/lib/ai/provider";
import { parseOrThrow, id as idSchema, longText } from "@/lib/validation";
import type { DocumentCategory } from "@prisma/client";

/**
 * "Drop anything." The two entry points below are deliberately the whole
 * public surface of capture: one for text, one for files. Neither asks the
 * student to classify, choose a subject, or name anything — that is the point.
 * Deciding what a thing is happens afterwards, in review, and only ever with
 * the student's confirmation.
 */

/** Accepted on drop. Mirrors what the document pipeline can actually read. */
const ACCEPTED_MIME_PREFIXES = ["application/pdf", "image/"];

/**
 * Records a typed or pasted thought and hands back the row immediately.
 *
 * Analysis is *not* awaited here. Capture must feel instant, and an API call
 * to a model takes seconds; the client kicks off `requestAnalysis` right after
 * and watches the row move through its states.
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
export async function captureFiles(formData: FormData) {
  const userId = await requireUserId();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("No files provided.");

  const created: { id: string }[] = [];

  for (const file of files) {
    if (!ACCEPTED_MIME_PREFIXES.some((p) => file.type.startsWith(p))) {
      throw new Error(`${file.name}: only PDF and image files can be dropped here.`);
    }

    const category: DocumentCategory = file.type.startsWith("image/") ? "IMAGE" : "OTHER";
    const document = await createDocument({ file, category });

    const capture = await prisma.captureItem.create({
      data: { userId, kind: "FILE", documentId: document.id, status: "PENDING" },
      select: { id: true },
    });
    created.push(capture);
  }

  revalidatePath("/inbox");
  return created;
}

/**
 * Runs (or re-runs) analysis for one capture the caller owns.
 *
 * Called from the client immediately after a drop, and again from the retry
 * button. `analyzeCapture` records its own outcome and never throws, so this
 * returns the resulting status rather than succeeding or failing.
 */
export async function requestAnalysis(captureId: string) {
  const userId = await requireUserId();
  const parsedId = parseOrThrow(idSchema, captureId, "capture id");

  const owned = await prisma.captureItem.findFirst({
    where: { id: parsedId, userId },
    select: { id: true },
  });
  if (!owned) throw new Error("Not found: Capture");

  await analyzeCapture(parsedId);

  const after = await prisma.captureItem.findUnique({
    where: { id: parsedId },
    select: { status: true, analysis: true, analyzedBy: true, error: true },
  });

  revalidatePath("/inbox");
  return {
    status: after?.status ?? "FAILED",
    analysis: parseStoredAnalysis(after?.analysis),
    analyzedBy: after?.analyzedBy ?? null,
    error: after?.error ?? null,
  };
}

/** Whether an AI provider is configured, for the inbox to report plainly. */
export async function getAiAvailability() {
  await requireUserId();
  return getAiStatus();
}

export type OrganizeDecision = {
  captureId: string;
  /** Always the student's choice, whether or not it matches the proposal. */
  subjectId: string | null;
  /** What to create. NONE files the item without creating anything. */
  destination: "NONE" | "KNOWLEDGE_GAP" | "TASK";
  title: string;
  notes?: string;
  /** Required when destination is TASK — Task.deadline is not nullable. */
  deadline?: string;
};

/**
 * The confirmation step: turns a reviewed proposal into real records.
 *
 * Everything written here comes from `decision` — the student's edited,
 * accepted answer — never from the stored proposal directly. That is the line
 * this whole design is built around: a model may suggest, only a person may
 * file.
 */
export async function organizeCapture(decision: OrganizeDecision) {
  const userId = await requireUserId();
  const captureId = parseOrThrow(idSchema, decision.captureId, "capture id");
  const title = parseOrThrow(longText, decision.title, "title").slice(0, 200);

  const capture = await prisma.captureItem.findFirst({
    where: { id: captureId, userId },
    select: { id: true, documentId: true },
  });
  if (!capture) throw new Error("Not found: Capture");

  if (decision.subjectId) await verifySubject(userId, decision.subjectId);

  if (decision.destination !== "NONE" && !decision.subjectId) {
    throw new Error("Choose a subject before filing this.");
  }

  if (decision.destination === "KNOWLEDGE_GAP" && decision.subjectId) {
    await prisma.knowledgeGap.create({
      data: {
        subjectId: decision.subjectId,
        title,
        description: decision.notes || null,
        source: "READING",
      },
    });
  }

  if (decision.destination === "TASK") {
    if (!decision.deadline) throw new Error("A task needs a deadline.");
    const deadline = new Date(decision.deadline);
    if (Number.isNaN(deadline.getTime())) throw new Error("That deadline is not a valid date.");

    await prisma.task.create({
      data: {
        userId,
        subjectId: decision.subjectId,
        title,
        description: decision.notes || null,
        deadline,
      },
    });
  }

  // Filing the capture under a subject files the underlying file too, so the
  // document stops being loose and shows up in that subject's materials.
  if (capture.documentId && decision.subjectId) {
    await prisma.document.updateMany({
      where: { id: capture.documentId, userId },
      data: { subjectId: decision.subjectId },
    });
  }

  await prisma.captureItem.update({
    where: { id: capture.id },
    data: { status: "ORGANIZED", organizedAt: new Date(), error: null },
  });

  revalidatePath("/inbox");
  revalidatePath("/");
  if (decision.destination === "TASK") revalidatePath("/tasks");
  if (decision.destination === "KNOWLEDGE_GAP") revalidatePath("/knowledge-gaps");
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
