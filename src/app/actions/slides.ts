"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, verifyLecture, verifySlide, assertMutated } from "@/lib/authz";
import { getAuthUserId, getAccessToken } from "@/lib/supabase/server";
import {
  deleteDocumentFile,
  getSignedDocumentUrl,
  statDocumentFile,
} from "@/lib/document-storage";
import { annotatableType } from "@/lib/annotatable";

/**
 * Records a lecture file the browser has already uploaded to Storage.
 *
 * This replaces an action that took the `File` itself. That version could not
 * work, and had not been working: a Server Action's request body is capped —
 * 2MB by this app's config, 4.5MB by the platform whatever the config says —
 * and a lecture deck is essentially never under either number. Attaching a
 * lecture returned HTTP 413 with "Body exceeded 2mb limit" before a line of
 * this file ran, and the dialog, having no message to show, simply sat there.
 *
 * Every other upload in the product had already moved to the browser → Storage
 * path (see lib/upload-direct.ts); the one entry point actually named "attach
 * a lecture" was the one that got missed. It uses the same three steps now,
 * and this is the third: nothing the caller says is trusted except the file
 * name. The path must be inside this student's own folder, or a caller could
 * hand back someone else's path and have a row created pointing at their file;
 * the size and type are read back from Storage, which is also what proves the
 * upload happened rather than being claimed.
 */
export async function attachUploadedSlide(input: {
  path: string;
  fileName: string;
  title?: string;
  lectureId: string;
}) {
  const userId = await requireUserId();
  await verifyLecture(userId, input.lectureId);

  const authUserId = await getAuthUserId();
  if (!input.path.startsWith(`${authUserId}/`) || input.path.includes("..")) {
    throw new Error("Not found: Slide");
  }

  const accessToken = await getAccessToken();
  const stat = await statDocumentFile(input.path, accessToken);
  if (!stat) throw new Error("The upload did not finish. Try again.");

  const fileType = annotatableType(stat.mimeType, input.fileName);
  if (!fileType) {
    // The file is real and uploaded, and nothing here can draw it. Leaving it
    // in the bucket would be an orphan nothing points at.
    await deleteDocumentFile(input.path, accessToken).catch(() => {});
    throw new Error("NOT_ANNOTATABLE");
  }

  const lecture = await prisma.lecture.findUniqueOrThrow({
    where: { id: input.lectureId },
    select: { subjectId: true },
  });

  const title = (input.title ?? "").trim() || input.fileName;

  const document = await prisma.document.create({
    data: {
      userId,
      subjectId: lecture.subjectId,
      lectureId: input.lectureId,
      category: "LECTURE",
      originalName: title,
      storagePath: input.path,
      mimeType: stat.mimeType ?? "",
      sizeBytes: stat.sizeBytes,
      processingStatus: "QUEUED",
    },
  });

  const slide = await prisma.lectureSlide.create({
    data: {
      lectureId: input.lectureId,
      documentId: document.id,
      title,
      fileUrl: input.path,
      fileType,
      // The real page count is written by the viewer the first time the deck
      // is opened — see setSlidePageCount — because counting pages needs the
      // PDF parsed, and parsing it here would mean downloading it again.
      pageCount: 1,
    },
  });

  revalidatePath(`/lectures/${input.lectureId}/slides`);
  return slide;
}

export async function setSlidePageCount(slideId: string, pageCount: number) {
  const userId = await requireUserId();
  const { count } = await prisma.lectureSlide.updateMany({
    where: { id: slideId, lecture: { subject: { userId } } },
    data: { pageCount },
  });
  assertMutated(count, "Slide");
}

export async function deleteSlide(slideId: string, lectureId: string) {
  const userId = await requireUserId();
  const slide = await prisma.lectureSlide.findFirst({
    where: { id: slideId, lecture: { subject: { userId } } },
    select: { id: true, fileUrl: true, documentId: true },
  });
  if (!slide) throw new Error("Not found: Slide");

  const accessToken = await getAccessToken();
  /* The delete carries its own ownership clause rather than leaning on the
     lookup above. The two were four lines apart and would have stayed correct
     right up until somebody moved one of them; every delete in this app now
     names the owner in its own WHERE, and scripts/verify-deletion.ts reads the
     source to make sure. */
  const { count } = await prisma.lectureSlide.deleteMany({
    where: { id: slideId, lecture: { subject: { userId } } },
  });
  assertMutated(count, "Slide");
  if (slide.documentId) await prisma.document.deleteMany({ where: { id: slide.documentId, userId } });
  await deleteDocumentFile(slide.fileUrl, accessToken);
  revalidatePath(`/lectures/${lectureId}/slides`);
}

/** A short-lived signed URL for viewing a slide's private file. */
export async function getSlideViewUrl(slideId: string) {
  const userId = await requireUserId();
  const slide = await prisma.lectureSlide.findFirst({
    where: { id: slideId, lecture: { subject: { userId } } },
    select: { fileUrl: true },
  });
  if (!slide) throw new Error("Not found: Slide");

  const accessToken = await getAccessToken();
  return getSignedDocumentUrl(slide.fileUrl, accessToken);
}

export async function saveSlideAnnotations(slideId: string, pageNumber: number, strokes: unknown) {
  const userId = await requireUserId();
  await verifySlide(userId, slideId);

  await prisma.slideAnnotation.upsert({
    where: { slideId_pageNumber: { slideId, pageNumber } },
    create: { slideId, pageNumber, strokes: strokes as object },
    update: { strokes: strokes as object },
  });
}
