import Link from "next/link";
import { BookOpen, Layers, Lightbulb, AlertTriangle, CheckSquare, CalendarClock } from "lucide-react";
import { getUrgency } from "@/lib/urgency";
import type { Task, Subject, ReviewItem, Lecture, Topic, Flashcard, KnowledgeGap, Mistake } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

type ReviewWithRelations = ReviewItem & {
  subject: Subject;
  lecture: Lecture | null;
  topic: Topic | null;
  flashcard: Flashcard | null;
  knowledgeGap: KnowledgeGap | null;
  mistake: Mistake | null;
};

const REVIEW_ICON = {
  LECTURE: BookOpen,
  TOPIC: Layers,
  FLASHCARD: Layers,
  KNOWLEDGE_GAP: Lightbulb,
  MISTAKE: AlertTriangle,
} as const;

function reviewTitle(item: ReviewWithRelations, dict: Dictionary) {
  switch (item.type) {
    case "LECTURE":
      return item.lecture?.title ?? dict.review.typeLabels.LECTURE;
    case "TOPIC":
      return item.topic?.name ?? dict.review.typeLabels.TOPIC;
    case "FLASHCARD":
      return item.flashcard?.front ?? dict.review.typeLabels.FLASHCARD;
    case "KNOWLEDGE_GAP":
      return item.knowledgeGap?.title ?? dict.review.typeLabels.KNOWLEDGE_GAP;
    case "MISTAKE":
      return item.mistake?.whyIGotItWrong ?? dict.review.typeLabels.MISTAKE;
  }
}

/**
 * "Today's schedule" as an actual timeline — a connecting line with dots,
 * not another stack of bordered rows. Merges two real, already-fetched
 * sources (tasks due today, reviews due today) into one chronological
 * list; nothing here is fabricated.
 */
export function ScheduleTimeline({
  dict,
  locale,
  tasks,
  reviews,
  now,
}: {
  dict: Dictionary;
  locale: Locale;
  tasks: (Task & { subject: Subject | null })[];
  reviews: ReviewWithRelations[];
  now: Date;
}) {
  const todayTasks = tasks.filter(
    (t) =>
      t.deadline.getFullYear() === now.getFullYear() &&
      t.deadline.getMonth() === now.getMonth() &&
      t.deadline.getDate() === now.getDate()
  );

  const entries = [
    ...todayTasks.map((t) => ({
      id: `task-${t.id}`,
      title: t.title,
      subjectName: t.subject?.name,
      subjectColor: t.subject?.color,
      href: `/tasks?task=${t.id}`,
      icon: CheckSquare,
      sortAt: t.deadline.getTime(),
      meta: t.deadline.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }),
      overdue: false,
    })),
    ...reviews.map((r) => {
      const urgency = getUrgency(r.scheduledDate, now, dict);
      return {
        id: `review-${r.id}`,
        title: reviewTitle(r, dict),
        subjectName: r.subject.name,
        subjectColor: r.subject.color,
        href: "/review",
        icon: REVIEW_ICON[r.type],
        sortAt: r.scheduledDate.getTime(),
        meta: urgency.label,
        overdue: urgency.level === "OVERDUE",
      };
    }),
  ].sort((a, b) => a.sortAt - b.sortAt);

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
        <CalendarClock className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{dict.dashboard.nothingScheduledToday}</p>
      </div>
    );
  }

  return (
    <ol className="relative flex flex-col gap-4 ps-1">
      <div className="absolute inset-y-1 start-[7px] w-px bg-border-subtle" aria-hidden />
      {entries.map((entry) => (
        <li key={entry.id} className="relative flex items-start gap-3 ps-6">
          <span
            className={cn(
              "absolute start-0 top-1 flex size-3.5 items-center justify-center rounded-full border-2 border-surface-primary",
              entry.overdue ? "bg-destructive" : "bg-primary"
            )}
            aria-hidden
          />
          <Link href={entry.href} className="group min-w-0 flex-1">
            <p className="truncate text-sm font-medium group-hover:text-primary">{entry.title}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {entry.subjectName && (
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: entry.subjectColor }} />
                  {entry.subjectName}
                </span>
              )}
              <span className={entry.overdue ? "text-destructive" : undefined}>{entry.meta}</span>
            </p>
          </Link>
        </li>
      ))}
    </ol>
  );
}
