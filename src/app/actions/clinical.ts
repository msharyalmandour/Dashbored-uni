"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";

export async function createClinicalEntry(input: {
  date: string;
  hospital?: string;
  department?: string;
  supervisor?: string;
  skillsPracticed?: string;
  casesSeen?: number;
  whatILearned?: string;
  whatIDidNotUnderstand?: string;
  questionsToAsk?: string;
  reflection?: string;
  nextAction?: string;
}) {
  const userId = await getCurrentUserId();
  await prisma.clinicalTraining.create({
    data: {
      userId,
      date: new Date(input.date),
      hospital: input.hospital || null,
      department: input.department || null,
      supervisor: input.supervisor || null,
      skillsPracticed: input.skillsPracticed || null,
      casesSeen: input.casesSeen ?? 0,
      whatILearned: input.whatILearned || null,
      whatIDidNotUnderstand: input.whatIDidNotUnderstand || null,
      questionsToAsk: input.questionsToAsk || null,
      reflection: input.reflection || null,
      nextAction: input.nextAction || null,
    },
  });
  revalidatePath("/clinical");
}
