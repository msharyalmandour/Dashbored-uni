"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CalendarPlus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/components/shared/i18n-provider";
import type { TaskType, TaskPriority } from "@prisma/client";

export interface TaskRowData {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  deadline: string;
  subjectName: string | null;
  subjectColor: string | null;
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

const PRIORITY_VARIANT: Record<string, "destructive" | "warning" | "secondary" | "muted"> = {
  URGENT: "destructive",
  HIGH: "warning",
  MEDIUM: "secondary",
  LOW: "muted",
};

export function TaskRow({ task }: { task: TaskRowData }) {
  const router = useRouter();
  const { dict, locale } = useI18n();
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

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          onClick={complete}
          disabled={pending}
          className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
            done ? "border-success bg-success text-success-foreground" : "border-muted-foreground/40 hover:border-primary"
          }`}
        >
          {done && <Check className="size-3" />}
        </button>
        <div className="min-w-0">
          <p className={`truncate text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>{task.title}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {task.subjectName && <span style={{ color: task.subjectColor ?? undefined }}>{task.subjectName}</span>}
            <span>· {dict.status.taskType[task.type as TaskType] ?? task.type}</span>
            <span>· {formatDate(task.deadline, locale)}</span>
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={PRIORITY_VARIANT[task.priority] ?? "muted"}>
          {dict.status.taskPriority[task.priority as TaskPriority] ?? task.priority}
        </Badge>
        {!done && (
          <span className={`text-xs font-medium ${urgency.colorClass}`}>
            {urgency.emoji} {urgency.label}
          </span>
        )}
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
      </div>

      {/* Said once the same task has been moved several times. It states what
          happened and offers to change the approach — it never names a
          reason, because the data cannot know one. Boring, badly explained,
          too big, or colliding with a shift at work all look identical here
          and need completely different help. */}
      {!done && task.postponements >= 3 && (
        <div className="flex w-full flex-wrap items-center gap-2 border-t border-border-subtle pt-2.5">
          <p className="text-xs text-muted-foreground">
            {format(dict.tasks.keepsMoving, { count: task.postponements })}
          </p>
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
        </div>
      )}
    </div>
  );
}
