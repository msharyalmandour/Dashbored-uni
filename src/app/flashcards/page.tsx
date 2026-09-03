import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { flashcardUrgencyScore } from "@/lib/spaced-repetition";
import { StatCard } from "@/components/shared/stat-card";
import { FlashcardStatusBadge, DifficultyBadge } from "@/components/shared/status-badges";
import { SubjectFilterSelect } from "@/components/flashcards/subject-filter-select";
import { CreateFlashcardDialog } from "@/components/flashcards/create-flashcard-dialog";
import { ReviewSession, type ReviewCard } from "@/components/flashcards/review-session";
import { Layers, Clock, Trophy } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Flashcards" };

export default async function FlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject } = await searchParams;
  const userId = await getCurrentUserId();
  const now = new Date();

  const subjects = await prisma.subject.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [allCards, totalCount, masteredCount] = await Promise.all([
    prisma.flashcard.findMany({
      where: { userId, subjectId: subject, nextReviewDate: { lte: now } },
      include: { subject: true },
    }),
    prisma.flashcard.count({ where: { userId, subjectId: subject } }),
    prisma.flashcard.count({ where: { userId, subjectId: subject, status: "MASTERED" } }),
  ]);

  const dueCards: ReviewCard[] = allCards
    .map((c) => ({
      card: {
        id: c.id,
        front: c.front,
        back: c.back,
        difficulty: c.difficulty,
        subjectName: c.subject.name,
        subjectColor: c.subject.color,
      },
      score: flashcardUrgencyScore(c, now),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ card }) => card);

  const managementList = await prisma.flashcard.findMany({
    where: { userId, subjectId: subject },
    include: { subject: true },
    orderBy: { nextReviewDate: "asc" },
    take: 30,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Flashcards</h1>
          <p className="text-sm text-muted-foreground">Spaced repetition, prioritized by what you&apos;re forgetting.</p>
        </div>
        <div className="flex items-center gap-2">
          <SubjectFilterSelect subjects={subjects} />
          <CreateFlashcardDialog subjects={subjects} defaultSubjectId={subject} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Cards" value={totalCount} icon={Layers} />
        <StatCard label="Due Now" value={dueCards.length} icon={Clock} tone={dueCards.length > 0 ? "warning" : "default"} />
        <StatCard label="Mastered" value={masteredCount} icon={Trophy} tone="success" />
      </div>

      <ReviewSession cards={dueCards} />

      <div>
        <h2 className="mb-3 font-display text-lg font-semibold">All Flashcards</h2>
        <div className="flex flex-col gap-2">
          {managementList.length === 0 && (
            <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No flashcards yet. Capture one from any lecture or use Quick Capture.
            </p>
          )}
          {managementList.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.front}</p>
                <p className="text-xs text-muted-foreground">
                  {c.subject.name} · Next review {formatDate(c.nextReviewDate)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <DifficultyBadge difficulty={c.difficulty} />
                <FlashcardStatusBadge status={c.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
