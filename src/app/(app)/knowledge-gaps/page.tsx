import { OSPageHeader } from "@/components/shared/os-page-header";
import { pageTitle } from "@/lib/i18n/page-title";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { getFilteredGaps } from "@/lib/knowledge-gaps";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { GapFilterBar } from "@/components/knowledge-gaps/gap-filter-bar";
import { GapBoard } from "@/components/knowledge-gaps/gap-board";
import { StaleGaps } from "@/components/knowledge-gaps/stale-gaps";
import { gapAction } from "@/lib/follow-through";
import { AddGapDialog } from "@/components/knowledge-gaps/add-gap-dialog";
import type { Difficulty, GapSource } from "@prisma/client";

export const generateMetadata = pageTitle((dict) => dict.nav.items.knowledgeGaps.label);

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
  const dict = getDictionary(await getLocale());

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

  /* The gaps nobody has touched, asked about rather than left to sit.
  
     Measured on the real account: twelve gaps, created on one day, not one of
     them resolved or touched in the eighteen days since. The board was showing
     all twelve in a column and waiting, and waiting is what produced 0 out of
     12 — see the StaleGaps comment. */
  const now = new Date();
  const stale = gaps.filter(
    (g) =>
      gapAction(
        { id: g.id, status: g.status, createdAt: new Date(g.createdAt), updatedAt: new Date(g.updatedAt) },
        now
      ) === "ASK_TO_CLOSE"
  );

  return (
    <div className="flex flex-col gap-6">
      <OSPageHeader
        title={dict.knowledgeGaps.title}
        state={dict.knowledgeGaps.subtitle}
        actions={<AddGapDialog subjects={subjects} lectures={lectures} topics={topics} />}
      />

      {/* Above the filter bar and the board on purpose: a question the student
          can answer in one tap is worth more than a column they can sort. */}
      {stale.length > 0 && <StaleGaps gaps={stale} now={now.toISOString()} />}

      <GapFilterBar subjects={subjects} lectures={lectures} topics={topics} />

      <GapBoard gaps={gaps} />
    </div>
  );
}
