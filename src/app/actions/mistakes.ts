"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, assertMutated } from "@/lib/authz";
import type { MistakeStatus } from "@prisma/client";

export async function updateMistakeStatus(id: string, status: MistakeStatus) {
  const userId = await requireUserId();
  const { count } = await prisma.mistake.updateMany({ where: { id, userId }, data: { status } });
  assertMutated(count, "Mistake");
  revalidatePath("/mistakes");
}
