import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { getFilteredGaps } from "@/lib/knowledge-gaps";
import { GapFilterBar } from "@/components/knowledge-gaps/gap-filter-bar";
import { GapBoard } from "@/components/knowledge-gaps/gap-board";
import { AddGapDialog } from "@/components/knowledge-gaps/add-gap-dialog";
import type { Difficulty, GapSource } from "@prisma/client";

export const metadata = { title: "Knowledge Gaps" };

export default async function KnowledgeGapsPage({
  searchParams,
}: {
  searchParams: Promise<{
    subject?: string;
    lecture?: string;
    topic?: string;
    difficulty?: string;
    source?: string;
    gap?: string;
  }>;
}) {
  const sp = await searchParams;
  const userId = await getCurrentUserId();

  const [subjects, lectures, topics, gaps] = await Promise.all([
    prisma.subject.findMany({ where: { userId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.lecture.findMany({
      where: { subject: { userId } },
      select: { id: true, title: true, subjectId: true },
      orderBy: { title: "asc" },
    }),
    prisma.topic.findMany({
      where: { subject: { userId } },
      select: { id: true, name: true, subjectId: true },
      orderBy: { name: "asc" },
    }),
    getFilteredGaps(userId, {
      subjectId: sp.subject,
      lectureId: sp.lecture,
      topicId: sp.topic,
      difficulty: sp.difficulty as Difficulty | undefined,
      source: sp.source as GapSource | undefined,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Knowledge Gap Center</h1>
          <p className="text-sm text-muted-foreground">
            Everything you don&apos;t understand yet — the central intelligence layer of University OS.
          </p>
        </div>
        <AddGapDialog subjects={subjects} lectures={lectures} topics={topics} />
      </div>

      <GapFilterBar subjects={subjects} lectures={lectures} topics={topics} />

      <GapBoard gaps={gaps} />
    </div>
  );
}
