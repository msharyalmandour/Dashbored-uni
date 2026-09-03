"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import type { VideoPlatform, VideoStatus } from "@prisma/client";

export async function createVideo(input: {
  title: string;
  url: string;
  platform: VideoPlatform;
  subjectId?: string;
  lectureId?: string;
  topicId?: string;
}) {
  const userId = await getCurrentUserId();
  await prisma.video.create({
    data: {
      userId,
      title: input.title,
      url: input.url,
      platform: input.platform,
      subjectId: input.subjectId || null,
      lectureId: input.lectureId || null,
      topicId: input.topicId || null,
    },
  });
  revalidatePath("/videos");
}

export async function updateVideoStatus(id: string, status: VideoStatus) {
  await prisma.video.update({ where: { id }, data: { status } });
  revalidatePath("/videos");
}
