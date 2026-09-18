import { pageTitle } from "@/lib/i18n/page-title";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { OSPageHeader, StateLine } from "@/components/shared/os-page-header";
import { OSSection, OSEmptyState } from "@/components/shared/os-section";
import { ContentText } from "@/components/ui/content-text";
import { ReviewList, type ReviewRow } from "@/components/review/review-list";
import { RotateCcw, CalendarClock, BookOpen, Layers, Lightbulb, AlertTriangle, Boxes } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { SPAN_STYLE, POINT_STYLE, markerFor } from "@/lib/week-palette";

export const generateMetadata = pageTitle((dict) => dict.nav.items.review.label);
export const dynamic = "force-dynamic";

type ReviewType = ReviewRow["type"];

/**
 * The five kinds of review, in the order a student meets them.
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
const SECTIONS: { type: ReviewType; icon: typeof BookOpen; accent: string }[] = [
  { type: "LECTURE", icon: BookOpen, accent: markerFor("CLASS") },
  { type: "TOPIC", icon: Boxes, accent: SPAN_STYLE.TUTORIAL.glow },
  { type: "FLASHCARD", icon: Layers, accent: POINT_STYLE.REVIEW },
  { type: "KNOWLEDGE_GAP", icon: Lightbulb, accent: POINT_STYLE.DEADLINE },
  { type: "MISTAKE", icon: AlertTriangle, accent: markerFor("CLINICAL") },
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
  if (item.type === "TOPIC") return `/subjects/${item.subjectId}?tab=topics`;
  return `/flashcards?subject=${item.subjectId}`;
}

export default async function ReviewPage() {
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000);

  const [dueItems, upcomingItems] = await Promise.all([
    prisma.reviewItem.findMany({
      where: { userId, status: { in: ["SCHEDULED", "DUE"] }, scheduledDate: { lte: now } },
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
  ]);

  const rows: ReviewRow[] = dueItems.map((item) => ({
    id: item.id,
    type: item.type as ReviewType,
    title: itemTitle(item, dict),
    href: itemHref(item),
    subjectName: item.subject.name,
    subjectColor: item.subject.color,
    scheduledDate: item.scheduledDate.toISOString(),
    reviewStage: item.reviewStage,
  }));

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
            template={dueItems.length > 0 ? dict.review.stateLine : dict.review.stateLineClear}
            values={{ due: dueItems.length, upcoming: upcomingItems.length }}
            tones={{ due: "due" }}
          />
        }
      />

      {present.length === 0 ? (
        <OSSection title={dict.review.dueTodaySection}>
          <OSEmptyState
            icon={RotateCcw}
            title={dict.review.allCaughtUp}
            hint={dict.review.noReviewsDue}
          />
        </OSSection>
      ) : (
        present.map(({ type, icon, accent }) => (
          <OSSection
            key={type}
            title={dict.review.typeLabels[type]}
            count={byType.get(type)!.length}
            icon={icon}
            accent={accent}
          >
            <ReviewList items={byType.get(type)!} />
          </OSSection>
        ))
      )}

      {upcomingItems.length > 0 && (
        <OSSection
          title={dict.review.upcomingThisWeek}
          count={upcomingItems.length}
          icon={CalendarClock}
        >
          <div className="flex flex-col gap-2 px-4 py-3">
            {upcomingItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0">
                    {dict.review.typeLabels[item.type as ReviewType]}
                  </span>
                  <span aria-hidden className="text-muted-foreground">
                    ·
                  </span>
                  <ContentText className="truncate text-muted-foreground">
                    {item.subject.name}
                  </ContentText>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(item.scheduledDate, locale)}
                </span>
              </div>
            ))}
          </div>
        </OSSection>
      )}
    </div>
  );
}
