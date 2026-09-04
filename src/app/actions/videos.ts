"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, verifySubject, verifyLecture, verifyTopic, assertMutated } from "@/lib/authz";
import { parseOrThrow, shortText, urlString } from "@/lib/validation";
import type { VideoPlatform, VideoStatus } from "@prisma/client";

export async function createVideo(input: {
  title: string;
  url: string;
  platform: VideoPlatform;
  subjectId?: string;
  lectureId?: string;
  topicId?: string;
}) {
  const userId = await requireUserId();
  if (input.subjectId) await verifySubject(userId, input.subjectId);
  if (input.lectureId) await verifyLecture(userId, input.lectureId);
  if (input.topicId) await verifyTopic(userId, input.topicId);
  const title = parseOrThrow(shortText, input.title, "title");
  const url = parseOrThrow(urlString, input.url, "url");

  await prisma.video.create({
    data: {
      userId,
      title,
      url,
      platform: input.platform,
      subjectId: input.subjectId || null,
      lectureId: input.lectureId || null,
      topicId: input.topicId || null,
    },
  });
  revalidatePath("/videos");
}

export async function updateVideoStatus(id: string, status: VideoStatus) {
  const userId = await requireUserId();
  const { count } = await prisma.video.updateMany({ where: { id, userId }, data: { status } });
  assertMutated(count, "Video");
  revalidatePath("/videos");
}
