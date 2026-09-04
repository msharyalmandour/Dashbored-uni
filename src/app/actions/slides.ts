"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { uploadSlideFile } from "@/lib/supabase-storage";

const ALLOWED_TYPES: Record<string, "pdf" | "image"> = {
  "application/pdf": "pdf",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
};

export async function uploadSlide(lectureId: string, formData: FormData) {
  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) throw new Error("No file provided.");

  const fileType = ALLOWED_TYPES[file.type];
  if (!fileType) throw new Error("Only PDF, PNG, JPEG, or WebP files are supported.");

  const path = `${lectureId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const fileUrl = await uploadSlideFile(file, path);

  const slide = await prisma.lectureSlide.create({
    data: {
      lectureId,
      title: title || file.name,
      fileUrl,
      fileType,
      pageCount: 1,
    },
  });

  revalidatePath(`/lectures/${lectureId}/slides`);
  return slide;
}

export async function setSlidePageCount(slideId: string, pageCount: number) {
  await prisma.lectureSlide.update({ where: { id: slideId }, data: { pageCount } });
}

export async function deleteSlide(slideId: string, lectureId: string) {
  await prisma.lectureSlide.delete({ where: { id: slideId } });
  revalidatePath(`/lectures/${lectureId}/slides`);
}

export async function saveSlideAnnotations(slideId: string, pageNumber: number, strokes: unknown) {
  await prisma.slideAnnotation.upsert({
    where: { slideId_pageNumber: { slideId, pageNumber } },
    create: { slideId, pageNumber, strokes: strokes as object },
    update: { strokes: strokes as object },
  });
}
