import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { ReviewList, type ReviewRow } from "@/components/review/review-list";
import { RotateCcw, Clock, CalendarClock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";

export const metadata = { title: "Review" };
export const dynamic = "force-dynamic";

function itemTitle(item: {
  type: string;
  lecture: { title: string } | null;
  topic: { name: string } | null;
  flashcard: { front: string } | null;
  knowledgeGap: { title: string } | null;
  mistake: { whyIGotItWrong: string | null } | null;
}) {
  switch (item.type) {
    case "LECTURE":
      return item.lecture?.title ?? "Lecture review";
    case "TOPIC":
      return item.topic?.name ?? "Topic review";
    case "FLASHCARD":
      return item.flashcard?.front ?? "Flashcard review";
    case "KNOWLEDGE_GAP":
      return item.knowledgeGap?.title ?? "Knowledge gap review";
    case "MISTAKE":
      return item.mistake?.whyIGotItWrong ?? "Mistake review";
    default:
      return "Review";
  }
}

function itemHref(item: {
  type: string;
  subjectId: string;
  lectureId: string | null;
  knowledgeGapId: string | null;
}) {
  if (item.type === "LECTURE" && item.lectureId) return `/lectures/${item.lectureId}`;
  if (item.type === "KNOWLEDGE_GAP" && item.knowledgeGapId) return `/knowledge-gaps?gap=${item.knowledgeGapId}`;
  if (item.type === "MISTAKE") return `/mistakes`;
  if (item.type === "TOPIC") return `/subjects/${item.subjectId}?tab=topics`;
  return `/flashcards?subject=${item.subjectId}`;
}

export default async function ReviewPage() {
  const userId = await getCurrentUserId();
  const dict = getDictionary(await getLocale());
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000);

  const [dueItems, upcomingItems, completedToday] = await Promise.all([
    prisma.reviewItem.findMany({
      where: { userId, status: { in: ["SCHEDULED", "DUE"] }, scheduledDate: { lte: now } },
      include: { subject: true, lecture: true, topic: true, flashcard: true, knowledgeGap: true, mistake: true },
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
    prisma.reviewItem.count({
      where: { userId, status: "COMPLETED", completedAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
    }),
  ]);

  const rows: ReviewRow[] = dueItems.map((item) => ({
    id: item.id,
    type: item.type,
    title: itemTitle(item),
    href: itemHref(item),
    subjectName: item.subject.name,
    subjectColor: item.subject.color,
    scheduledDate: item.scheduledDate.toISOString(),
    reviewStage: item.reviewStage,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{dict.review.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.review.subtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={dict.review.dueNow} value={dueItems.length} icon={Clock} tone={dueItems.length > 0 ? "warning" : "default"} />
        <StatCard label={dict.review.completedToday} value={completedToday} icon={RotateCcw} tone="success" />
        <StatCard label={dict.review.upcoming7d} value={upcomingItems.length} icon={CalendarClock} />
      </div>

      <div>
        <h2 className="mb-3 font-display text-lg font-semibold">{dict.review.dueTodaySection}</h2>
        <ReviewList items={rows} />
      </div>

      {upcomingItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{dict.review.upcomingThisWeek}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {upcomingItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span>
                  {dict.review.typeLabels[item.type as keyof Dictionary["review"]["typeLabels"]]} · {item.subject.name}
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(item.scheduledDate)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
