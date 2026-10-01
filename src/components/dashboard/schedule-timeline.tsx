import Link from "next/link";
import { BookOpen, Layers, Lightbulb, AlertTriangle, CheckSquare, CalendarClock, Stethoscope, Clock, MapPin, ArrowRight } from "lucide-react";
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
export interface TodayClass {
  id: string;
  title: string;
  type: string;
  startsAt: Date;
  /** Null when the event carries no end time. Never guessed. */
  minutes: number | null;
  location: string | null;
  subjectName: string | null;
  subjectColor: string | null;
  lectureId: string | null;
}

export function ScheduleTimeline({
  dict,
  locale,
  tasks,
  reviews,
  classes,
  now,
}: {
  dict: Dictionary;
  locale: Locale;
  tasks: (Task & { subject: Subject | null })[];
  reviews: ReviewWithRelations[];
  /* The student's actual timetable. Until this existed the panel called
     "Today" showed tasks and reviews while eleven imported classes — with real
     times, real durations and a location on the clinicals — were nowhere on
     the page that is supposed to show the day. */
  classes: TodayClass[];
  now: Date;
}) {
  const clock = (d: Date) =>
    d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
  const todayTasks = tasks.filter(
    (t) =>
      t.deadline.getFullYear() === now.getFullYear() &&
      t.deadline.getMonth() === now.getMonth() &&
      t.deadline.getDate() === now.getDate()
  );

  const entries = [
    ...classes.map((c) => ({
      id: `class-${c.id}`,
      title: c.title,
      subtitle: [c.subjectName, dict.dashboard.eventType[c.type as keyof typeof dict.dashboard.eventType]]
        .filter(Boolean)
        .join(" \u00b7 "),
      subjectName: c.subjectName ?? undefined,
      subjectColor: c.subjectColor ?? undefined,
      href: c.lectureId ? `/lectures/${c.lectureId}` : "/time",
      icon: c.type === "CLINICAL" ? Stethoscope : CalendarClock,
      sortAt: c.startsAt.getTime(),
      at: clock(c.startsAt),
      minutes: c.minutes,
      location: c.location,
      /* A class already finished is dimmed, not hidden: it is still part of
         what today was, and removing it would make a morning of lectures
         vanish by lunchtime. */
      past: c.startsAt.getTime() < now.getTime(),
      overdue: false,
    })),
    ...todayTasks.map((t) => ({
      id: `task-${t.id}`,
      title: t.title,
      subjectName: t.subject?.name,
      subjectColor: t.subject?.color,
      href: `/tasks?task=${t.id}`,
      icon: CheckSquare,
      subtitle: t.subject?.name ?? "",
      sortAt: t.deadline.getTime(),
      at: clock(t.deadline),
      minutes: null as number | null,
      location: null as string | null,
      past: false,
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
        subtitle: r.subject.name,
        sortAt: r.scheduledDate.getTime(),
        at: urgency.label,
        minutes: null as number | null,
        location: null as string | null,
        past: false,
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
    /* A TIME GUTTER, a rail, and cards — the reference's shape.
    
       This was a thin line with 14px dots and a bare title beside it, which is
       a list that happens to have a line drawn through it. The reference
       separates three jobs: the hour lives in its own column on the left, the
       rail with its dot marks the moment, and the event itself is a card with
       edges. That separation is what lets the eye scan the hours down one
       column without reading any of the titles — which is how somebody
       actually checks a day.
    
       `grid-cols-[auto_auto_1fr]` rather than absolute positioning: the gutter
       then sizes itself to the widest time, so a 24-hour locale and a 12-hour
       one both get exactly the width they need with no magic number. */
    <ol className="flex flex-col">
      {entries.map((entry, i) => {
        const last = i === entries.length - 1;
        return (
          <li key={entry.id} className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-3">
            {/* The hour. `tabular-nums` so 08:00 and 11:00 line up on the
                colon instead of drifting, which is the whole point of a
                column of times. */}
            <span
              className={cn(
                "pt-3.5 text-xs tabular-nums",
                entry.past ? "text-muted-foreground/50" : "text-muted-foreground"
              )}
            >
              {entry.at}
            </span>

            {/* The rail. The line is a sibling of the dot rather than a
                container border, so the last entry can stop it short and the
                day does not appear to continue past its final class. */}
            <span aria-hidden className="relative flex w-3 justify-center">
              <span
                className={cn(
                  "absolute top-4 size-2.5 rounded-full ring-4 ring-[color:var(--background)]",
                  entry.overdue
                    ? "bg-[color:var(--destructive)]"
                    : entry.past
                      ? "bg-[color:var(--border-active)]"
                      : "bg-[color:var(--primary)]"
                )}
              />
              {!last && <span className="mt-6 w-px flex-1 bg-[color:var(--border)]" />}
            </span>

            <Link
              href={entry.href}
              className={cn(
                "group my-1 flex items-center gap-3 rounded-[var(--radius-lg)] border px-3 py-3 transition-colors",
                "border-[color:var(--border)] bg-[color:var(--card)] hover:border-[color:var(--border-active)]",
                // Dimmed, not hidden. A finished class is still part of today.
                entry.past && "opacity-55"
              )}
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[color:var(--surface-elevated)] text-muted-foreground"
                style={entry.subjectColor ? { color: entry.subjectColor } : undefined}
              >
                <entry.icon className="size-[18px]" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{entry.title}</span>
                {entry.subtitle && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {entry.subtitle}
                  </span>
                )}
              </span>

              {/* Chips, and only the ones that are true. A lecture on this
                  timetable has no room recorded, so it gets no room chip —
                  rather than an em dash standing in for a fact nobody has. */}
              <span className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
                {entry.minutes !== null && entry.minutes > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    <span className="tabular-nums">{formatDuration(entry.minutes)}</span>
                  </span>
                )}
                {entry.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    <span className="max-w-[10ch] truncate">{entry.location}</span>
                  </span>
                )}
              </span>

              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full transition-colors",
                  entry.past
                    ? "text-muted-foreground"
                    : "bg-[color:var(--accent)] text-[color:var(--primary)] group-hover:bg-[color:var(--primary)] group-hover:text-[color:var(--primary-foreground)]"
                )}
              >
                <ArrowRight className="size-4 rtl:rotate-180" />
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * "2h", "50m", "4h 50m" — never "290 minutes".
 *
 * The real durations on this timetable run from fifty minutes to two hundred
 * and ninety, and a raw minute count past about ninety stops being something
 * anyone reads as a length of time.
 */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
