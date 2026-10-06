import { pageTitle } from "@/lib/i18n/page-title";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { OSPageHeader, StateLine } from "@/components/shared/os-page-header";
import { TtSection, TtRow, TtEmpty } from "@/components/shared/tt";
import { ContentText } from "@/components/ui/content-text";
import { ReviewList, type ReviewRow } from "@/components/review/review-list";
import { formatDate } from "@/lib/utils";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { dueFlashcardsWhere, dueReviewItemsWhere } from "@/lib/review-due";
import { batchSize, batchCaption } from "@/lib/follow-through";

export const generateMetadata = pageTitle((dict) => dict.nav.items.review.label);
export const dynamic = "force-dynamic";

type ReviewType = ReviewRow["type"];

/**
 * The five kinds of review, in the order a student meets them.
 *
 * The per-section icon and accent colour are gone with the panel they sat on.
 * In the timetable language a section is a rule and a name; an icon and a
 * colour per heading were two more things to read on a page whose whole job is
 * to be startable, and they said nothing the heading did not.
 *
 * `ReviewType` has had five members since the schema was written, every one of
 * them populated, and the page rendered all of them as one undifferentiated
 * list with the kind repeated as a badge on each row. With sixty-nine items due
 * that is a wall: no way to see that sixty-one of them are lectures and four are
 * mistakes, and no way to do the mistakes first. Lectures lead because they are
 * the bulk of it; mistakes come last because they are the ones worth arriving at
 * unhurried.
 *
 * The colours come from the week palette rather than new ones, so a lecture is
 * the same colour here as it is in the week grid.
 */
const SECTIONS: { type: ReviewType }[] = [
  { type: "LECTURE" },
  { type: "TOPIC" },
  { type: "FLASHCARD" },
  { type: "KNOWLEDGE_GAP" },
  { type: "MISTAKE" },
];

function itemTitle(
  item: {
    type: string;
    lecture: { title: string } | null;
    topic: { name: string } | null;
    flashcard: { front: string } | null;
    knowledgeGap: { title: string } | null;
    mistake: { whyIGotItWrong: string | null } | null;
  },
  dict: Dictionary
) {
  switch (item.type) {
    case "LECTURE":
      return item.lecture?.title ?? dict.common.reviewFallbackLecture;
    case "TOPIC":
      return item.topic?.name ?? dict.common.reviewFallbackTopic;
    case "FLASHCARD":
      return item.flashcard?.front ?? dict.common.reviewFallbackFlashcard;
    case "KNOWLEDGE_GAP":
      return item.knowledgeGap?.title ?? dict.common.reviewFallbackGap;
    case "MISTAKE":
      return item.mistake?.whyIGotItWrong ?? dict.common.reviewFallbackMistake;
    default:
      return dict.common.reviewFallbackOther;
  }
}

function itemHref(item: {
  type: string;
  subjectId: string;
  lectureId: string | null;
  knowledgeGapId: string | null;
}) {
  if (item.type === "LECTURE" && item.lectureId) return `/lectures/${item.lectureId}`;
  if (item.type === "KNOWLEDGE_GAP" && item.knowledgeGapId)
    return `/knowledge-gaps?gap=${item.knowledgeGapId}`;
  if (item.type === "MISTAKE") return `/mistakes`;
  if (item.type === "TOPIC") return `/subjects/${item.subjectId}?tab=material`;
  return `/flashcards?subject=${item.subjectId}`;
}

export default async function ReviewPage() {
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000);

  /* Two schedules, and this page only ever asked one of them.
  
     A flashcard carries its own nextReviewDate, advanced by answering it, and
     that is what /flashcards reads. A ReviewItem is the five-stage chain created
     when a lecture is completed, a gap resolved or a problem answered wrong, and
     that is what this page read — exclusively.
  
     Nothing creates a ReviewItem when a flashcard is created. Measured on the
     real account: 42 cards due, ReviewItem empty, 0 rows ever. So the page
     called Review said "all caught up" while forty-two cards waited, and only
     thirteen of them had ever been answered. See src/lib/review-due.ts. */
  /* How many the student has actually been clearing lately, so the batch below
     is sized from behaviour rather than from a constant.
  
     There is no record of batches offered and cleared — that would be another
     table — so these two counts stand in for it, and they are real: cards
     answered in the last seven days, against cards that came due in the same
     window. Measured on the real account: 2 and 2. A perfect clear rate on a
     small offer, which earns a slightly larger one.
  
     The proxy is named rather than hidden because it is a proxy: "answered a
     card" is not identical to "cleared the batch it was in", and if batch
     history is ever recorded it should replace this. */
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  const [dueItems, dueCards, upcomingItems, recentlyCleared, recentlyOffered] = await Promise.all([
    prisma.reviewItem.findMany({
      where: { ...dueReviewItemsWhere(userId, now) },
      include: {
        subject: true,
        lecture: true,
        topic: true,
        flashcard: true,
        knowledgeGap: true,
        mistake: true,
      },
      orderBy: { scheduledDate: "asc" },
    }),
    prisma.flashcard.findMany({
      where: dueFlashcardsWhere(userId, now),
      include: { subject: true },
      orderBy: { nextReviewDate: "asc" },
      // The page shows what is waiting; it is not the place to page through
      // hundreds. The count in the header is the honest total either way.
      take: 60,
    }),
    prisma.reviewItem.findMany({
      where: {
        userId,
        status: { in: ["SCHEDULED", "DUE"] },
        scheduledDate: { gt: now, lte: in7Days },
      },
      include: { subject: true },
      orderBy: { scheduledDate: "asc" },
      take: 10,
    }),
    prisma.flashcard.count({
      where: { subject: { userId }, lastReviewed: { gte: sevenDaysAgo } },
    }),
    prisma.flashcard.count({
      where: { subject: { userId }, nextReviewDate: { gte: sevenDaysAgo, lte: now } },
    }),
  ]);

  const rows: ReviewRow[] = [
    ...dueItems.map((item) => ({
      id: item.id,
      type: item.type as ReviewType,
      title: itemTitle(item, dict),
      href: itemHref(item),
      subjectName: item.subject.name,
      subjectColor: item.subject.color,
      scheduledDate: item.scheduledDate.toISOString(),
      reviewStage: item.reviewStage,
    })),
    /* A due card, as a row of the same shape. It lands in the FLASHCARD section
       the page already had and never had anything to put in.
    
       `reviewCount` stands in for reviewStage, and is the truer number of the
       two: it is how many times this card has actually come back, counted from
       answering it, rather than which rung of a five-stage ladder a scheduler
       placed it on. */
    ...dueCards.map((card) => ({
      id: card.id,
      type: "FLASHCARD" as ReviewType,
      title: card.front,
      href: `/flashcards?subject=${card.subjectId}`,
      subjectName: card.subject.name,
      subjectColor: card.subject.color,
      scheduledDate: card.nextReviewDate.toISOString(),
      reviewStage: String(card.reviewCount),
    })),
  ];

  const byType = new Map<ReviewType, ReviewRow[]>();
  for (const row of rows) {
    const bucket = byType.get(row.type);
    if (bucket) bucket.push(row);
    else byType.set(row.type, [row]);
  }

  // A section with nothing in it is not news — it is five headings saying
  // "zero" above the one heading that matters.
  const present = SECTIONS.filter((s) => (byType.get(s.type)?.length ?? 0) > 0);

  return (
    <div className="flex flex-col gap-6">
      <OSPageHeader
        title={dict.review.title}
        state={
          <StateLine
            template={rows.length > 0 ? dict.review.stateLine : dict.review.stateLineClear}
            values={{ due: rows.length, upcoming: upcomingItems.length }}
            tones={{ due: "due" }}
          />
        }
      />

      {present.length === 0 ? (
        <TtSection title={dict.review.dueTodaySection}>
          <TtEmpty>{dict.review.allCaughtUp}</TtEmpty>
        </TtSection>
      ) : (
        present.map(({ type }) => {
          const all = byType.get(type)!;
          /* Three, not forty-two.
          
             Measured: 42 cards due and 27 of them never opened once. A counter
             reading 42 is a wall, and the proof that it is a wall is that two
             thirds of the pile has never been touched. Nobody clears 42;
             almost anybody clears 3.
          
             Per section rather than across the page, because the sections are
             different kinds of work — clearing three mistakes is not the same
             act as clearing three cards — and one overall cap would hide whole
             sections behind whichever one happened to be longest.
          
             The count in the heading stays the true total. The remainder is
             said out loud underneath: hiding it would be the app deciding what
             the student may know about their own backlog. */
          const shown = batchSize(all.length, recentlyCleared, recentlyOffered);
          const { waiting } = batchCaption(all.length, shown);
          return (
            <TtSection
              key={type}
              title={dict.review.typeLabels[type]}
              count={all.length}
              ground
            >
              <ReviewList items={all.slice(0, shown)} />
              {waiting > 0 && (
                <p className="pb-3 text-xs text-muted-foreground">
                  {dict.review.batchWaiting.replace("{waiting}", String(waiting))}
                </p>
              )}
            </TtSection>
          );
        })
      )}

      {upcomingItems.length > 0 && (
        <TtSection title={dict.review.upcomingThisWeek} count={upcomingItems.length}>
          {upcomingItems.map((item) => (
            <TtRow
              key={item.id}
              label={
                <>
                  <span>{dict.review.typeLabels[item.type as ReviewType]}</span>
                  <span aria-hidden className="text-muted-foreground"> · </span>
                  <ContentText className="text-muted-foreground">
                    {item.subject.name}
                  </ContentText>
                </>
              }
              note={formatDate(item.scheduledDate, locale)}
            />
          ))}
        </TtSection>
      )}
    </div>
  );
}
