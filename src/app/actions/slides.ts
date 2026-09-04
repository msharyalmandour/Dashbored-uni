"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, verifyLecture, verifySlide, assertMutated } from "@/lib/authz";
import { getAuthUserId, getAccessToken } from "@/lib/supabase/server";
import { uploadSlideFile, deleteSlideFile, getSignedSlideUrl } from "@/lib/supabase-storage";

const ALLOWED_TYPES: Record<string, "pdf" | "image"> = {
  "application/pdf": "pdf",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
};

export async function uploadSlide(lectureId: string, formData: FormData) {
  const userId = await requireUserId();
  await verifyLecture(userId, lectureId);

  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) throw new Error("No file provided.");

  const fileType = ALLOWED_TYPES[file.type];
  if (!fileType) throw new Error("Only PDF, PNG, JPEG, or WebP files are supported.");

  const authUserId = await getAuthUserId();
  const accessToken = await getAccessToken();
  const path = `${authUserId}/lectures/${lectureId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const storagePath = await uploadSlideFile(file, path, accessToken);

  const slide = await prisma.lectureSlide.create({
    data: {
      lectureId,
      title: title || file.name,
      fileUrl: storagePath,
      fileType,
      pageCount: 1,
    },
  });

  revalidatePath(`/lectures/${lectureId}/slides`);
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
    select: { id: true, fileUrl: true },
  });
  if (!slide) throw new Error("Not found: Slide");

  const accessToken = await getAccessToken();
  await prisma.lectureSlide.delete({ where: { id: slide.id } });
  await deleteSlideFile(slide.fileUrl, accessToken);
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
  return getSignedSlideUrl(slide.fileUrl, accessToken);
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
