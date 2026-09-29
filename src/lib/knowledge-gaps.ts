import { prisma } from "@/lib/prisma";
import type { Difficulty, GapSource, GapStatus } from "@prisma/client";

export interface GapListItem {
  id: string;
  title: string;
  description: string | null;
  difficulty: Difficulty;
  status: GapStatus;
  source: GapSource;
  createdAt: string;
  /** The last time the student did anything to it. follow-through.ts measures
   *  staleness from this, not from createdAt: an old gap worked on yesterday
   *  is alive, and asking someone to close something they are mid-way through
   *  is the most discouraging possible moment to ask. */
  updatedAt: string;
  resolvedAt: string | null;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  lectureId: string | null;
  lectureTitle: string | null;
  topicId: string | null;
  topicName: string | null;
  mistakeCount: number;
  flashcardCount: number;
  nextReviewDate: string | null;
}

export interface GapFilters {
  subjectId?: string;
  lectureId?: string;
  topicId?: string;
  difficulty?: Difficulty;
  source?: GapSource;
}

export async function getFilteredGaps(userId: string, filters: GapFilters): Promise<GapListItem[]> {
  const gaps = await prisma.knowledgeGap.findMany({
    where: {
      subject: { userId },
      subjectId: filters.subjectId,
      lectureId: filters.lectureId,
      topicId: filters.topicId,
      difficulty: filters.difficulty,
      source: filters.source,
    },
    include: {
      subject: true,
      lecture: true,
      topic: true,
      _count: { select: { mistakes: true, flashcards: true } },
      reviewItems: {
        where: { status: { in: ["SCHEDULED", "DUE"] } },
        orderBy: { scheduledDate: "asc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return gaps.map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    difficulty: g.difficulty,
    status: g.status,
    source: g.source,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    resolvedAt: g.resolvedAt?.toISOString() ?? null,
    subjectId: g.subjectId,
    subjectName: g.subject.name,
    subjectColor: g.subject.color,
    lectureId: g.lectureId,
    lectureTitle: g.lecture?.title ?? null,
    topicId: g.topicId,
    topicName: g.topic?.name ?? null,
    mistakeCount: g._count.mistakes,
    flashcardCount: g._count.flashcards,
    nextReviewDate: g.reviewItems[0]?.scheduledDate.toISOString() ?? null,
  }));
}
