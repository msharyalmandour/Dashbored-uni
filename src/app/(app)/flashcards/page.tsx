import { pageTitle } from "@/lib/i18n/page-title";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { flashcardUrgencyScore } from "@/lib/spaced-repetition";
import { StatCard } from "@/components/shared/stat-card";
import { OSSection, OSRow, OSEmptyState } from "@/components/shared/os-section";
import { OSRowGroup } from "@/components/shared/os-row-group";
import { ContentText } from "@/components/ui/content-text";
import { OriginLink } from "@/components/shared/origin-link";
import { FlashcardStatusBadge, DifficultyBadge } from "@/components/shared/status-badges";
import { SubjectFilterSelect } from "@/components/flashcards/subject-filter-select";
import { CreateFlashcardDialog } from "@/components/flashcards/create-flashcard-dialog";
import { ReviewSession, type ReviewCard } from "@/components/flashcards/review-session";
import { Layers, Clock, Trophy } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, format as formatDict } from "@/lib/i18n/dictionaries";

export const generateMetadata = pageTitle((dict) => dict.nav.items.flashcards.label);

/** How many cards the management list draws. The header says when it caps. */
const CARD_LIST_LIMIT = 30;

export default async function FlashcardsPage({
  searchParams,
}: {
  /* `lecture` lets the lecture workspace link to exactly its own cards. */
  searchParams: Promise<{ subject?: string; lecture?: string }>;
}) {
  const { subject, lecture } = await searchParams;
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const now = new Date();

  const subjects = await prisma.subject.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [allCards, totalCount, masteredCount] = await Promise.all([
    prisma.flashcard.findMany({
      where: { userId, subjectId: subject, lectureId: lecture, nextReviewDate: { lte: now } },
      include: { subject: true },
    }),
    prisma.flashcard.count({ where: { userId, subjectId: subject, lectureId: lecture } }),
    prisma.flashcard.count({ where: { userId, subjectId: subject, lectureId: lecture, status: "MASTERED" } }),
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
    where: { userId, subjectId: subject, lectureId: lecture },
    // The lecture comes along so each card can point back at where it was
    // made. `lectureId` has been on this row since the schema was written and
    // the page had never once selected it.
    include: { subject: true, lecture: { select: { id: true, title: true } } },
    orderBy: { nextReviewDate: "asc" },
    take: CARD_LIST_LIMIT,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{dict.flashcards.title}</h1>
          <p className="text-sm text-muted-foreground">{dict.flashcards.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <SubjectFilterSelect subjects={subjects} />
          <CreateFlashcardDialog subjects={subjects} defaultSubjectId={subject} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={dict.flashcards.totalCards} value={totalCount} icon={Layers} />
        <StatCard label={dict.flashcards.dueNow} value={dueCards.length} icon={Clock} tone={dueCards.length > 0 ? "warning" : "default"} />
        <StatCard label={dict.flashcards.mastered} value={masteredCount} icon={Trophy} tone="success" />
      </div>

      <ReviewSession cards={dueCards} />

      <OSSection
        title={dict.flashcards.allFlashcards}
        count={totalCount}
        icon={Layers}
        /* The list is capped at CARD_LIST_LIMIT but the header counts every
           card, so when those differ the header would be quietly wrong about
           what is on the screen. Say which it is. */
        meta={
          totalCount > managementList.length ? (
            <span className="text-xs text-muted-foreground">
              {formatDict(dict.common.showingOf, {
                shown: managementList.length,
                total: totalCount,
              })}
            </span>
          ) : undefined
        }
      >
        {managementList.length === 0 ? (
          <OSEmptyState icon={Layers} title={dict.flashcards.noFlashcardsYet} />
        ) : (
          <OSRowGroup limit={8}>
            {managementList.map((c) => (
            <OSRow key={c.id}>
              <div className="min-w-0 flex-1">
                {/* The card's own front, in whatever language the student wrote
                    it. This list is where "Loading dose formula?" rendered as
                    "?Loading dose formula" before anything declared a direction. */}
                <ContentText as="p" className="truncate text-sm font-medium">
                  {c.front}
                </ContentText>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  <OriginLink
                    lecture={c.lecture}
                    subject={{ id: c.subject.id, name: c.subject.name, color: c.subject.color }}
                  />
                  <span aria-hidden>·</span>
                  <span>
                    {dict.flashcards.nextReview} {formatDate(c.nextReviewDate, locale)}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <DifficultyBadge difficulty={c.difficulty} dict={dict} />
                <FlashcardStatusBadge status={c.status} dict={dict} />
              </div>
              </OSRow>
            ))}
          </OSRowGroup>
        )}
      </OSSection>
    </div>
  );
}
