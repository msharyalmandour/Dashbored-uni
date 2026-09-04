"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { parseOrThrow, dateString, nonNegativeInt } from "@/lib/validation";

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
  const userId = await requireUserId();
  const date = parseOrThrow(dateString, input.date, "date");
  const casesSeen = input.casesSeen !== undefined ? parseOrThrow(nonNegativeInt, input.casesSeen, "cases seen") : 0;

  await prisma.clinicalTraining.create({
    data: {
      userId,
      date: new Date(date),
      hospital: input.hospital || null,
      department: input.department || null,
      supervisor: input.supervisor || null,
      skillsPracticed: input.skillsPracticed || null,
      casesSeen,
      whatILearned: input.whatILearned || null,
      whatIDidNotUnderstand: input.whatIDidNotUnderstand || null,
      questionsToAsk: input.questionsToAsk || null,
      reflection: input.reflection || null,
      nextAction: input.nextAction || null,
    },
  });
  revalidatePath("/clinical");
}
