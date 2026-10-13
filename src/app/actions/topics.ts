"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";

/**
 * The three things a student does to a topic while reading it.
 *
 * All three check ownership the way everything here does — through
 * section -> lecture -> subject -> userId, in the `where` rather than after —
 * so a section id belonging to someone else is simply not found.
 */

/** Mark a topic studied, or un-mark it. Returns the new state. */
export async function setTopicStudied(sectionId: string, studied: boolean) {
  const userId = await requireUserId();

  const section = await prisma.lectureSection.findFirst({
    where: { id: sectionId, lecture: { subject: { userId } } },
    select: { id: true, lectureId: true },
  });
  if (!section) return { ok: false as const };

  if (studied) {
    /* Upsert rather than create: tapping twice on a slow connection must not
       fail on the unique index, it must mean what it looks like it means. */
    await prisma.lectureSectionProgress.upsert({
      where: { userId_sectionId: { userId, sectionId } },
      create: { userId, sectionId },
      update: { studiedAt: new Date() },
    });
  } else {
    /* Un-marking DELETES the row rather than setting a flag false. "I studied
       this on Tuesday" stops being true when he un-marks it, and keeping the
       date around as a lie would poison "what did I study this week". */
    await prisma.lectureSectionProgress.deleteMany({ where: { userId, sectionId } });
  }

  revalidatePath(`/lectures/${section.lectureId}/topics`);
  revalidatePath(`/lectures/${section.lectureId}`);
  revalidatePath("/");
  return { ok: true as const, studied };
}

/**
 * "I did not understand this point."
 *
 * It becomes a KnowledgeGap rather than a new kind of row, because the app
 * already has a place for things that did not land, and a second table would
 * mean two lists of the same thing in two screens. What is new is `sectionId`:
 * the gap points at the exact topic, so "I did not understand Assembling
 * Resources" is actionable where "I did not understand lecture 2" is
 * thirty-three slides of nothing in particular.
 */
export async function flagPoint(sectionId: string, pointIndex: number) {
  const userId = await requireUserId();

  const section = await prisma.lectureSection.findFirst({
    where: { id: sectionId, lecture: { subject: { userId } } },
    select: {
      id: true,
      title: true,
      lectureId: true,
      lecture: { select: { subjectId: true } },
      points: { orderBy: { position: "asc" }, select: { heading: true, source: true } },
    },
  });
  if (!section) return { ok: false as const };

  const point = section.points[pointIndex];
  if (!point) return { ok: false as const };

  /* One gap per point. Flagging the same line twice is the same confusion,
     not two of them — and a list with the same sentence three times is a list
     he stops reading. */
  const title = `${section.title} — ${point.heading}`;
  const existing = await prisma.knowledgeGap.findFirst({
    where: { sectionId, title, subject: { userId } },
    select: { id: true },
  });
  if (existing) return { ok: true as const, alreadyThere: true };

  await prisma.knowledgeGap.create({
    data: {
      subjectId: section.lecture.subjectId,
      lectureId: section.lectureId,
      sectionId: section.id,
      title,
      description: point.source,
      source: "LECTURE",
    },
  });

  revalidatePath(`/lectures/${section.lectureId}/topics`);
  revalidatePath("/knowledge-gaps");
  revalidatePath("/");
  return { ok: true as const, alreadyThere: false };
}

/**
 * Turn a topic's points into review cards.
 *
 * NO MODEL IS CALLED. The two halves of a point already are a card: the
 * student's own Arabic explanation is the prompt, and the slide's English —
 * the sentence the exam quotes — is the answer. Generating these would be
 * paying to rewrite content that is already correct, and would introduce the
 * one risk this content does not currently carry.
 *
 * Points with no Arabic note are skipped rather than carded front-blank: a
 * card whose question is the answer teaches nothing.
 */
export async function cardsFromTopic(sectionId: string) {
  const userId = await requireUserId();

  const section = await prisma.lectureSection.findFirst({
    where: { id: sectionId, lecture: { subject: { userId } } },
    select: {
      id: true,
      title: true,
      lectureId: true,
      lecture: { select: { subjectId: true } },
      points: {
        orderBy: { position: "asc" },
        select: { heading: true, source: true, note: true },
      },
    },
  });
  if (!section) return { ok: false as const, made: 0 };

  const usable = section.points.filter((p) => p.note && p.note.trim().length > 0);
  if (usable.length === 0) return { ok: true as const, made: 0 };

  /* Already-made cards are not made again. He will press this twice. */
  const fronts = usable.map((p) => `${section.title} — ${p.heading}`);
  const already = await prisma.flashcard.findMany({
    where: { userId, lectureId: section.lectureId, front: { in: fronts } },
    select: { front: true },
  });
  const have = new Set(already.map((c) => c.front));

  const rows = usable
    .map((p) => ({
      userId,
      subjectId: section.lecture.subjectId,
      lectureId: section.lectureId,
      front: `${section.title} — ${p.heading}`,
      back: p.source,
      difficulty: "MEDIUM" as const,
    }))
    .filter((row) => !have.has(row.front));

  if (rows.length === 0) return { ok: true as const, made: 0 };

  const created = await prisma.flashcard.createMany({ data: rows });
  revalidatePath(`/lectures/${section.lectureId}`);
  revalidatePath("/flashcards");
  revalidatePath("/review");
  return { ok: true as const, made: created.count };
}
