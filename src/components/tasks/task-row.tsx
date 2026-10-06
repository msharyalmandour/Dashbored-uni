"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CalendarPlus, Loader2 } from "lucide-react";
import { getUrgency } from "@/lib/urgency";
import { updateTaskStatus, postponeTask } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/i18n/dictionaries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OriginLink } from "@/components/shared/origin-link";
import { ContentText } from "@/components/ui/content-text";
import { TtRow } from "@/components/shared/tt";
import { daysUntil } from "@/lib/exam-readiness";
import { useI18n } from "@/components/shared/i18n-provider";
import { DeleteThing } from "@/components/shared/delete-thing";
import type { TaskType } from "@prisma/client";

export interface TaskRowData {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  deadline: string;
  subjectName: string | null;
  subjectColor: string | null;
  /** So a task can lead to the course it belongs to. */
  subjectId?: string | null;
  /** How many times this deadline has already been moved later. */
  postponements: number;
  /** How many times the student said they were stuck while working on it. */
  stuckCount: number;
}

/**
 * The moves offered.
 *
 * Deliberately short. "Next month" is not rescheduling, it is avoidance with
 * a date on it, and offering it as a one-click option would make the app
 * complicit in that.
 */
const MOVE_OPTIONS = [1, 3, 7] as const;

/* THE PRIORITY BADGE WAS HERE, with a variant per level.
 
   Measured on the real account: all fifteen tasks are MEDIUM — the schema
   default, never once set. So the badge printed "Medium" fifteen times down
   the list, the same way the lecture page's five difficulty stars printed
   "medium" seven times. And it was answering the question the urgency label
   beside it already answers from the deadline, which is a real fact rather
   than an unset field. One of the two had to go, and it is the one nobody
   filled in. `TaskPriority` stays in the schema and in the create dialog. */

export function TaskRow({ task }: { task: TaskRowData }) {
  const router = useRouter();
  const { dict } = useI18n();
  const [pending, startTransition] = React.useTransition();
  const done = task.status === "COMPLETED";
  const urgency = getUrgency(new Date(task.deadline), new Date(), dict);

  function complete() {
    startTransition(async () => {
      await updateTaskStatus(task.id, done ? "NOT_STARTED" : "COMPLETED");
      router.refresh();
    });
  }

  function move(days: number) {
    startTransition(async () => {
      const next = new Date(task.deadline);
      next.setDate(next.getDate() + days);
      await postponeTask(task.id, next.toISOString());
      router.refresh();
    });
  }

  const days = daysUntil(new Date(task.deadline), new Date());

  return (
    <>
      <TtRow past={done}>
      {/* DAYS LEFT, in the figure column — the same unit and the same
          arithmetic the course page's deadline band uses, so a task reads the
          same wherever it appears. A completed task shows nothing there rather
          than a countdown to a date that no longer matters. */}
      <span className={`tt-n tt-latin ${!done ? urgency.colorClass : ""}`}>
        {done ? "" : days}
      </span>

      <span className="tt-label flex min-w-0 items-center gap-2.5">
        <button
          onClick={complete}
          disabled={pending}
          aria-label={dict.review.markReviewed}
          className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
            done ? "border-success bg-success text-success-foreground" : "border-muted-foreground/40 hover:border-primary"
          }`}
        >
          {done && <Check className="size-3" />}
        </button>
        <ContentText className={`truncate ${done ? "line-through" : ""}`}>
          {task.title}
        </ContentText>
      </span>

      <span className="flex shrink-0 items-center gap-2">
        <span className="tt-meta hidden items-center gap-1.5 sm:flex">
          {task.subjectName &&
            /* A task names a course; the course should be one tap away. */
            (task.subjectId ? (
              <OriginLink
                subject={{
                  id: task.subjectId,
                  name: task.subjectName,
                  color: task.subjectColor ?? undefined,
                }}
              />
            ) : (
              <ContentText style={{ color: task.subjectColor ?? undefined }}>
                {task.subjectName}
              </ContentText>
            ))}
          <span aria-hidden>·</span>
          <span>{dict.status.taskType[task.type as TaskType] ?? task.type}</span>
        </span>
        {/* Moving a date was impossible until now, which left a student whose
            week had changed choosing between a deadline that was wrong and
            ticking off something they had not done. Both corrupt the record
            everything else reasons from. */}
        {!done && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={pending} aria-label={dict.tasks.moveDeadline}>
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarPlus className="size-3.5" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {MOVE_OPTIONS.map((days) => (
                <DropdownMenuItem key={days} onClick={() => move(days)}>
                  {format(dict.tasks.moveByDays, { count: days })}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <DeleteThing kind="task" id={task.id} name={task.title} />
      </span>
      </TtRow>

      {/* Said once the same task has been moved several times. It states what
          happened and offers to change the approach — it never names a reason,
          because the data cannot know one. Boring, badly explained, too big,
          or colliding with a shift at work all look identical here and need
          completely different help.

          Its own row rather than a strip inside the first one: a row that
          sometimes grows a second storey breaks the one thing a timetable is
          for, which is that every line is the same height. */}
      {!done && task.postponements >= 3 && (
        <TtRow>
          <span className="tt-n" />
          <span className="col-span-2 flex flex-wrap items-center gap-2">
            <span className="tt-meta">
              {format(dict.tasks.keepsMoving, { count: task.postponements })}
            </span>
            {/* Two different problems wearing the same shape. A task that gets
                deferred needs a smaller first step; a task the student has
                actually got stuck inside needs explaining, and offering "ten
                more minutes" to someone who already tried and did not
                understand is the wrong help entirely. */}
            {task.stuckCount > 0 ? (
              <Button asChild variant="secondary" size="sm">
                <a href={`/knowledge-gaps?task=${task.id}`}>{dict.tasks.helpUnderstanding}</a>
              </Button>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <a
                  href={`/focus?do=${encodeURIComponent(task.title)}&minutes=10&task=${task.id}&why=${encodeURIComponent(
                    dict.tasks.justTenMinutesWhy
                  )}`}
                >
                  {dict.tasks.justTenMinutes}
                </a>
              </Button>
            )}
          </span>
        </TtRow>
      )}
    </>
  );
}
