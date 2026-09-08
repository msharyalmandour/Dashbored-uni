"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, verifySubject, verifyLecture, verifyDocument, assertMutated } from "@/lib/authz";
import { getAuthUserId, getAccessToken } from "@/lib/supabase/server";
import { uploadDocumentFile, deleteDocumentFile, getSignedDocumentUrl } from "@/lib/document-storage";
import { parseOrThrow, shortText } from "@/lib/validation";
import type { DocumentCategory } from "@prisma/client";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

/**
 * The single upload entry point for the file-intelligence layer. Does the
 * minimum synchronous work — validate, upload, create the row, mark it
 * QUEUED — and returns immediately; text extraction happens later in the
 * background job (see netlify/functions/process-documents.mts), never in
 * this request. Lecture slides go through this too (see slides.ts); a
 * general "attach a document to a subject/lecture, or leave it
 * unattached" caller uses it directly.
 */
export async function createDocument(input: {
  file: File;
  category: DocumentCategory;
  subjectId?: string;
  lectureId?: string;
  title?: string;
}) {
  const userId = await requireUserId();
  if (input.subjectId) await verifySubject(userId, input.subjectId);
  if (input.lectureId) await verifyLecture(userId, input.lectureId);

  const { file } = input;
  if (file.size === 0) throw new Error("No file provided.");
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Only PDF, PNG, JPEG, or WebP files are supported.");
  }

  const originalName = parseOrThrow(shortText, input.title || file.name, "file name");

  const authUserId = await getAuthUserId();
  const accessToken = await getAccessToken();
  const category = input.category.toLowerCase();
  const scope = input.lectureId ?? input.subjectId ?? "unattached";
  const path = `${authUserId}/${category}/${scope}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const storagePath = await uploadDocumentFile(file, path, accessToken);

  const document = await prisma.document.create({
    data: {
      userId,
      subjectId: input.subjectId || null,
      lectureId: input.lectureId || null,
      category: input.category,
      originalName,
      storagePath,
      mimeType: file.type,
      sizeBytes: file.size,
      processingStatus: "QUEUED",
    },
  });

  if (input.lectureId) revalidatePath(`/lectures/${input.lectureId}/slides`);
  return document;
}

export async function getDocumentViewUrl(documentId: string) {
  const userId = await requireUserId();
  const doc = await prisma.document.findFirst({ where: { id: documentId, userId }, select: { storagePath: true } });
  if (!doc) throw new Error("Not found: Document");

  const accessToken = await getAccessToken();
  return getSignedDocumentUrl(doc.storagePath, accessToken);
}

export async function deleteDocument(documentId: string) {
  const userId = await requireUserId();
  const doc = await prisma.document.findFirst({ where: { id: documentId, userId }, select: { id: true, storagePath: true, lectureId: true } });
  if (!doc) throw new Error("Not found: Document");

  const accessToken = await getAccessToken();
  await prisma.document.delete({ where: { id: doc.id } });
  await deleteDocumentFile(doc.storagePath, accessToken);

  if (doc.lectureId) revalidatePath(`/lectures/${doc.lectureId}/slides`);
}

/** Requeues a FAILED (or stuck) document for another processing pass. */
export async function retryDocumentProcessing(documentId: string) {
  const userId = await requireUserId();
  await verifyDocument(userId, documentId);

  const { count } = await prisma.document.updateMany({
    where: { id: documentId, userId },
    data: { processingStatus: "QUEUED", processingError: null },
  });
  assertMutated(count, "Document");
}
