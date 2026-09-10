"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Info,
  BookOpen,
  CalendarDays,
  ListTodo,
  HelpCircle,
  Layers,
  XCircle,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";
import type { AgentAction, AgentRunResult } from "@/lib/ai/agent/types";
import { UndoDrop } from "@/components/inbox/undo-drop";
import { ReviewNotes } from "@/components/inbox/review-notes";
import type { ReviewFinding } from "@/lib/ai/agent/review";

/**
 * The one outcome the client can produce that the agent itself never returns:
 * an item that was stored but never read — an unsupported format, or no
 * provider configured. It is a separate ending from a failure, because telling
 * someone "I understood it" when nothing was read would be the same quiet lie
 * in the other direction.
 */
export type AgentOutcome =
  | AgentRunResult
  | { status: "NOT_READ"; reason: string; canRetry: boolean };

/**
 * One line per thing that actually happened, each pointing at the row it made.
 *
 * The link is the part that matters. A student who is told "I created 3
 * knowledge gaps" has been given a claim; one who can tap through to them has
 * been given something checkable, and the difference is what stops this from
 * being a feature people quietly learn not to trust.
 */
function useActionLine() {
  const { dict, format, locale } = useI18n();
  const t = dict.inbox;

  return React.useCallback(
    (action: AgentAction): { icon: React.ReactNode; text: string; href: string } => {
      switch (action.kind) {
        case "COURSE":
          return {
            icon: <BookOpen className="size-3.5" />,
            text: format(t.actionCourse, { name: action.name }),
            href: "/academics",
          };
        case "TIMETABLE":
          return {
            icon: <CalendarDays className="size-3.5" />,
            text: format(t.actionTimetable, {
              classes: action.classesAdded,
              courses: action.coursesCreated,
            }),
            href: "/calendar",
          };
        case "TASK": {
          const due = new Date(action.deadline);
          const when = Number.isNaN(due.getTime())
            ? ""
            : due.toLocaleDateString(locale, { month: "short", day: "numeric" });
          return {
            icon: <ListTodo className="size-3.5" />,
            text: when
              ? format(t.actionTaskWithDate, { title: action.title, date: when })
              : format(t.actionTask, { title: action.title }),
            href: "/tasks",
          };
        }
        case "GAP":
          return {
            icon: <HelpCircle className="size-3.5" />,
            text: format(t.actionGap, { title: action.title, course: action.subjectName }),
            href: "/knowledge-gaps",
          };
        case "LECTURE":
          return {
            icon: <BookOpen className="size-3.5" />,
            text: format(t.actionLecture, { title: action.title, course: action.subjectName }),
            href: "/academics",
          };
        case "FLASHCARDS":
          return {
            icon: <Layers className="size-3.5" />,
            text: format(t.actionFlashcards, { count: action.count, course: action.subjectName }),
            href: "/flashcards",
          };
        case "MISTAKE":
          return {
            icon: <XCircle className="size-3.5" />,
            text: format(t.actionMistake, { course: action.subjectName }),
            href: "/mistakes",
          };
        case "FILED":
          return {
            icon: <Inbox className="size-3.5" />,
            text: action.subjectName
              ? format(t.actionFiledUnder, { title: action.title, course: action.subjectName })
              : format(t.actionFiled, { title: action.title }),
            href: "/academics",
          };
      }
    },
    [t, format, locale]
  );
}

function ActionList({ actions }: { actions: AgentAction[] }) {
  const line = useActionLine();
  if (actions.length === 0) return null;

  return (
    <ul className="flex w-full flex-col gap-1.5">
      {actions.map((action, i) => {
        const { icon, text, href } = line(action);
        return (
          <li key={i}>
            <Link
              href={href}
              className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm transition-colors hover:bg-surface-secondary"
            >
              <span className="mt-0.5 shrink-0 text-success">{icon}</span>
              <span className="min-w-0 flex-1">{text}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AgentResult({
  outcome,
  busy,
  onRetry,
  captureId,
  review,
}: {
  outcome: AgentOutcome;
  busy: boolean;
  onRetry: () => void;
  /**
   * Anything reading the rows back turned up. Shown beside what happened, while
   * the student still remembers what they dropped and can settle in a second
   * what the app cannot settle at all.
   */
  review?: ReviewFinding[];
  /**
   * The item this outcome came from, when there is exactly one.
   *
   * Undo needs it, and a batch has no single row — those items are each
   * undoable from the inbox, where they are listed individually.
   */
  captureId?: string | null;
}) {
  const { dict } = useI18n();
  const t = dict.inbox;

  if (outcome.status === "NOT_READ") {
    return (
      <div className="orb-emerge mt-4 flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-secondary p-4">
        <p className="flex items-start gap-2.5 text-sm font-medium">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            {t.agentSavedNotRead}
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{outcome.reason}</span>
          </span>
        </p>
        {outcome.canRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} disabled={busy} className="self-start">
            <RotateCcw className="size-3.5" />
            {t.agentRetry}
          </Button>
        )}
      </div>
    );
  }

  // A failure can still have written things before it failed. Those rows exist,
  // so they are listed under the failure rather than hidden by it — a student
  // told "nothing happened" drops the same item again and ends up with two.
  if (outcome.status === "FAILED") {
    return (
      <div className="orb-emerge mt-4 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
        <p className="flex items-start gap-2.5 text-sm font-medium">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            {t.agentFailedHeading}
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{t.agentFailedBody}</span>
          </span>
        </p>
        {outcome.actions.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground">{t.agentPartialSaved}</p>
            <ActionList actions={outcome.actions} />
          </>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onRetry} disabled={busy}>
            <RotateCcw className="size-3.5" />
            {t.agentRetry}
          </Button>
          {/* A failed run that wrote something leaves those rows behind. They
              are as undoable as a successful run's, and more likely to be
              unwanted. */}
          {captureId && outcome.actions.length > 0 && <UndoDrop captureId={captureId} />}
        </div>
      </div>
    );
  }

  if (outcome.status === "NOTHING_TO_DO") {
    return (
      <div className="orb-emerge mt-4 flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-secondary p-4">
        <p className="flex items-start gap-2.5 text-sm font-medium">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            {t.agentNothingToDo}
            {outcome.summary && (
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {outcome.summary}
              </span>
            )}
          </span>
        </p>
        <Button size="sm" variant="outline" onClick={onRetry} disabled={busy} className="self-start">
          <RotateCcw className="size-3.5" />
          {t.agentRetry}
        </Button>
      </div>
    );
  }

  // The question case is rendered by AgentAsk, which owns the reply box.
  if (outcome.status === "ASKED") return null;

  const partial = outcome.status === "PARTIAL";

  return (
    <div
      className={`orb-emerge mt-4 flex flex-col items-start gap-3 rounded-xl border p-4 ${
        partial ? "border-warning/30 bg-warning/10" : "border-success/25 bg-success/10"
      }`}
    >
      <p className="flex items-start gap-2.5 self-center text-sm font-medium">
        {partial ? (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        )}
        <span>{partial ? t.agentPartialHeading : t.agentDone}</span>
      </p>

      <ActionList actions={outcome.actions} />

      {/* The agent's own sentence sits below what it did, never above it: the
          list is the record, and this only ever explains it. */}
      {!partial && outcome.summary && (
        <p className="px-2 text-xs text-muted-foreground">{outcome.summary}</p>
      )}

      {review && review.length > 0 && <ReviewNotes findings={review} />}

      {/* Offered next to the list of what happened, while the student is
          looking at it and can still tell whether it was right. */}
      {captureId && outcome.actions.length > 0 && (
        <UndoDrop captureId={captureId} className="self-center text-muted-foreground" />
      )}
    </div>
  );
}
