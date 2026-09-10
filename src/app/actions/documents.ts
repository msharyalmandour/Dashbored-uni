"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, verifySubject, verifyLecture, verifyDocument, assertMutated } from "@/lib/authz";
import { getAuthUserId, getAccessToken } from "@/lib/supabase/server";
import {
  uploadDocumentFile,
  deleteDocumentFile,
  getSignedDocumentUrl,
  createSignedUploadSlot,
  statDocumentFile,
} from "@/lib/document-storage";
import { parseOrThrow, shortText } from "@/lib/validation";
import { isBlocked, MAX_FILE_BYTES } from "@/lib/capture-kinds";
import type { DocumentCategory } from "@prisma/client";

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

  // Broad by design. This used to allow four mime types, which made a feature
  // called Drop Anything refuse most of what a student actually has — and
  // refuse it on `file.type`, which browsers report empty or wrong often
  // enough (HEIC, markdown, anything dragged from certain apps) that valid
  // files were being rejected too. What is left is a narrow block list and a
  // size cap; how far understanding goes per type is a separate question, and
  // one the UI answers honestly rather than by refusing the upload.
  if (isBlocked(file.name)) {
    throw new Error("That kind of file can't be stored here.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`That file is larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`);
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

/**
 * Builds the storage path for a new file. One scheme, one place.
 *
 * The first segment is the auth user id because Storage RLS matches on it —
 * that is the boundary confining every upload to its owner's folder, so it is
 * never taken from anything a caller supplied.
 */
function storagePathFor(authUserId: string, category: DocumentCategory, scope: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return `${authUserId}/${category.toLowerCase()}/${scope}/${Date.now()}-${safe}`;
}

/**
 * Permission for the browser to upload one file, straight to Storage.
 *
 * The two actions here replace `createDocument` for anything large. A file
 * used to be sent to a Server Action, whose request body the platform caps at
 * 4.5MB — a ceiling no configuration lifts, and one that has nothing to do
 * with what the app or the storage bucket can hold. Now the server decides
 * *whether* the file may exist and *where* it goes, hands back a token for
 * that one path, and never touches the bytes. A 25MB lecture PDF is suddenly
 * ordinary.
 *
 * Everything refusable is refused here, before a byte moves: a blocked
 * extension, a size the bucket would reject anyway. The size given is the
 * browser's claim and is treated as one — `attachUploadedDocument` reads the
 * real size back from Storage before it writes a row.
 */
export async function requestUploadSlot(input: {
  fileName: string;
  sizeBytes: number;
  category: DocumentCategory;
  subjectId?: string;
  lectureId?: string;
}) {
  const userId = await requireUserId();
  if (input.subjectId) await verifySubject(userId, input.subjectId);
  if (input.lectureId) await verifyLecture(userId, input.lectureId);

  const fileName = parseOrThrow(shortText, input.fileName, "file name");
  if (isBlocked(fileName)) throw new Error("That kind of file can't be stored here.");
  if (input.sizeBytes <= 0) throw new Error("No file provided.");
  if (input.sizeBytes > MAX_FILE_BYTES) {
    throw new Error(`That file is larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`);
  }

  const authUserId = await getAuthUserId();
  const accessToken = await getAccessToken();
  const scope = input.lectureId ?? input.subjectId ?? "unattached";

  return createSignedUploadSlot(storagePathFor(authUserId, input.category, scope, fileName), accessToken);
}

/**
 * Records a file the browser has already uploaded.
 *
 * Nothing the caller says about the file is trusted except its name. The path
 * is checked to be inside this user's own folder — otherwise a caller could
 * hand back someone else's path and have a row created pointing at their file
 * — and the size and type are read back from Storage, which is also what
 * proves the upload actually happened rather than being claimed.
 */
export async function attachUploadedDocument(input: {
  path: string;
  fileName: string;
  category: DocumentCategory;
  subjectId?: string;
  lectureId?: string;
  title?: string;
}) {
  const userId = await requireUserId();
  if (input.subjectId) await verifySubject(userId, input.subjectId);
  if (input.lectureId) await verifyLecture(userId, input.lectureId);

  const fileName = parseOrThrow(shortText, input.fileName, "file name");
  if (isBlocked(fileName)) throw new Error("That kind of file can't be stored here.");

  const authUserId = await getAuthUserId();
  const path = input.path;
  if (!path.startsWith(`${authUserId}/`) || path.includes("..")) {
    throw new Error("Not found: Document");
  }

  const accessToken = await getAccessToken();
  const stat = await statDocumentFile(path, accessToken);
  if (!stat) throw new Error("The upload did not finish. Try again.");
  if (stat.sizeBytes > MAX_FILE_BYTES) {
    // Reached only by a caller that lied to `requestUploadSlot` about the size.
    await deleteDocumentFile(path, accessToken).catch(() => {});
    throw new Error(`That file is larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`);
  }

  const document = await prisma.document.create({
    data: {
      userId,
      subjectId: input.subjectId || null,
      lectureId: input.lectureId || null,
      category: input.category,
      originalName: parseOrThrow(shortText, input.title || fileName, "file name"),
      storagePath: path,
      mimeType: stat.mimeType ?? "",
      sizeBytes: stat.sizeBytes,
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
