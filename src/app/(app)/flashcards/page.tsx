import { pageTitle } from "@/lib/i18n/page-title";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { flashcardUrgencyScore } from "@/lib/spaced-repetition";
import { OSPageHeader, StateLine } from "@/components/shared/os-page-header";
import { TtSection, TtRow, TtEmpty } from "@/components/shared/tt";
import { ContentText } from "@/components/ui/content-text";
import { DeleteThing } from "@/components/shared/delete-thing";
import { OriginLink } from "@/components/shared/origin-link";
import { SubjectFilterSelect } from "@/components/flashcards/subject-filter-select";
import { CreateFlashcardDialog } from "@/components/flashcards/create-flashcard-dialog";
import { ReviewSession, type ReviewCard } from "@/components/flashcards/review-session";
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

  const [allCards, totalCount] = await Promise.all([
    prisma.flashcard.findMany({
      where: { userId, subjectId: subject, lectureId: lecture, nextReviewDate: { lte: now } },
      include: { subject: true },
    }),
    prisma.flashcard.count({ where: { userId, subjectId: subject, lectureId: lecture } }),
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
      <OSPageHeader
        title={dict.flashcards.title}
        state={
          <StateLine
            template={dueCards.length > 0 ? dict.flashcards.stateLine : dict.flashcards.stateLineClear}
            values={{ due: dueCards.length, total: totalCount }}
            tones={{ due: "due" }}
          />
        }
        actions={
          <>
            {/* `/review` lost its sidebar row — it held 0 rows beside this
                page's 42, and two destinations for one loop is one too many.
                The page still exists and this is how it is reached. */}
            <Link
              href="/review"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            >
              <RotateCcw className="size-4" />
              {dict.nav.items.review.label}
            </Link>
            <SubjectFilterSelect subjects={subjects} />
            <CreateFlashcardDialog subjects={subjects} defaultSubjectId={subject} />
          </>
        }
      />

      <ReviewSession cards={dueCards} />

      <TtSection
        title={dict.flashcards.allFlashcards}
        count={totalCount}
        /* Grounded: measured 42 cards on this account, which is the length
           `.tt-ground` exists for. */
        ground
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
          <TtEmpty>{dict.flashcards.noFlashcardsYet}</TtEmpty>
        ) : (
          managementList.map((c) => (
            /* TWO BADGES CAME OFF EVERY ROW, which on this account is
               eighty-four of them over forty-two cards.
            
               `DifficultyBadge` was the agent's guess, repeated down the list.
               `FlashcardStatusBadge` is derived from reviewCount, and measured
               27 of the 42 have never been shown once — so it printed "New"
               twenty-seven times. What is left is the one fact that differs
               between rows and matters: how many times this card has actually
               come back. */
            <TtRow key={c.id}>
              <span className="tt-n tt-latin">
                {c.reviewCount > 0 ? c.reviewCount : ""}
              </span>
              <span className="tt-label min-w-0">
                {/* The card's own front, in whatever language it was written
                    in. This list is where "Loading dose formula?" rendered as
                    "?Loading dose formula" before anything set a direction. */}
                <ContentText>{c.front}</ContentText>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tt-meta flex items-center gap-1.5 tabular-nums">
                  {/* Where it came from stays. The list is unfiltered by
                      default and the cards span two courses, so a row without
                      its origin is a question the student cannot answer from
                      the screen. */}
                  <OriginLink
                    lecture={c.lecture}
                    subject={{ id: c.subject.id, name: c.subject.name, color: c.subject.color }}
                  />
                  <span aria-hidden>·</span>
                  <span>
                    {c.reviewCount === 0
                      ? dict.subject.neverSeen
                      : formatDate(c.nextReviewDate, locale)}
                  </span>
                </span>
                <DeleteThing kind="flashcard" id={c.id} name={c.front} />
              </span>
            </TtRow>
          ))
        )}
      </TtSection>
    </div>
  );
}
