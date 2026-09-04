import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";

export { getCurrentUserId as requireUserId };

/**
 * Thrown when a client-supplied id doesn't resolve to a row the current
 * user owns. Deliberately doesn't distinguish "doesn't exist" from
 * "belongs to someone else" — that distinction itself is information an
 * attacker probing for valid ids shouldn't get.
 */
export class OwnershipError extends Error {
  constructor(entity = "resource") {
    super(`Not found: ${entity}`);
    this.name = "OwnershipError";
  }
}

function must(exists: boolean, entity: string): void {
  if (!exists) throw new OwnershipError(entity);
}

/** Throws unless `count` (from an ownership-scoped updateMany/deleteMany) is > 0. */
export function assertMutated(count: number, entity: string): void {
  must(count > 0, entity);
}

// --- Direct-owner tables (row has its own `userId` column) ---------------

export async function verifySemester(userId: string, semesterId: string) {
  const row = await prisma.semester.findFirst({ where: { id: semesterId, userId }, select: { id: true } });
  must(!!row, "Semester");
}

export async function verifySubject(userId: string, subjectId: string) {
  const row = await prisma.subject.findFirst({ where: { id: subjectId, userId }, select: { id: true } });
  must(!!row, "Subject");
}

export async function verifyFlashcard(userId: string, id: string) {
  const row = await prisma.flashcard.findFirst({ where: { id, userId }, select: { id: true } });
  must(!!row, "Flashcard");
}

export async function verifyProblem(userId: string, id: string) {
  const row = await prisma.problem.findFirst({ where: { id, userId }, select: { id: true } });
  must(!!row, "Problem");
}

export async function verifyClinicalTraining(userId: string, id: string) {
  const row = await prisma.clinicalTraining.findFirst({ where: { id, userId }, select: { id: true } });
  must(!!row, "Clinical training entry");
}

export async function verifyFocusSession(userId: string, id: string) {
  const row = await prisma.focusSession.findFirst({ where: { id, userId }, select: { id: true } });
  must(!!row, "Focus session");
}

// --- Derived-ownership tables (ownership via a parent relation) ----------

export async function verifyTopic(userId: string, topicId: string) {
  const row = await prisma.topic.findFirst({ where: { id: topicId, subject: { userId } }, select: { id: true } });
  must(!!row, "Topic");
}

export async function verifyLecture(userId: string, lectureId: string) {
  const row = await prisma.lecture.findFirst({ where: { id: lectureId, subject: { userId } }, select: { id: true } });
  must(!!row, "Lecture");
}

export async function verifyKnowledgeGap(userId: string, gapId: string) {
  const row = await prisma.knowledgeGap.findFirst({ where: { id: gapId, subject: { userId } }, select: { id: true } });
  must(!!row, "Knowledge gap");
}

export async function verifySlide(userId: string, slideId: string) {
  const row = await prisma.lectureSlide.findFirst({
    where: { id: slideId, lecture: { subject: { userId } } },
    select: { id: true },
  });
  must(!!row, "Slide");
}
