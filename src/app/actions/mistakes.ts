"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { MistakeStatus } from "@prisma/client";

export async function updateMistakeStatus(id: string, status: MistakeStatus) {
  await prisma.mistake.update({ where: { id }, data: { status } });
  revalidatePath("/mistakes");
}
