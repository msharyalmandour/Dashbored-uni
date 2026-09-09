"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, RotateCcw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";
import type { AutoExecuteResult } from "@/app/actions/capture";

/**
 * The one extra outcome the client can produce that the server's own type
 * doesn't need to know about: "yes" to the subject question routes through
 * `acceptProposedSubject` (which already existed for the day-one flow), and
 * its result is reshaped into this same family so one component renders
 * every ending.
 */
export type AgentOutcome =
  | AutoExecuteResult
  | { status: "EXECUTED"; kind: "SUBJECT"; subjectName: string }
  /**
   * Saved, but never read — an unsupported format, no AI provider, or an
   * analysis that failed outright. This is a separate ending from FAILED
   * (which means it *was* understood and the write is what broke), because
   * telling someone "I understood it" when nothing was read would be the
   * same quiet lie in the other direction. `canRetry` is false when trying
   * again cannot possibly help, e.g. a video nothing here can transcribe.
   */
  | { status: "NOT_READ"; reason: string; canRetry: boolean };

/**
 * What actually happened, shown as simply as the spec asks for: a mark, a
 * short line, at most one number, one way to go see it.
 *
 * The FAILED branch is the one that matters most to get right. It exists
 * because "the model understood this" and "this is now in your calendar" are
 * different facts, and collapsing them into one green checkmark would be the
 * exact kind of quiet lie this product is built to refuse.
 */
export function AgentResult({
  outcome,
  busy,
  onRetry,
}: {
  outcome: AgentOutcome;
  busy: boolean;
  onRetry: () => void;
}) {
  const { dict, format, locale } = useI18n();
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
        <Button size="sm" variant="outline" onClick={onRetry} disabled={busy} className="self-start">
          <RotateCcw className="size-3.5" />
          {t.agentRetry}
        </Button>
      </div>
    );
  }

  if (outcome.status !== "EXECUTED") return null;

  let heading = t.agentDone;
  let detail: string | null = null;
  let cta: { href: string; label: string } | null = null;

  switch (outcome.kind) {
    case "TIMETABLE": {
      heading = t.agentTimetableDone;
      detail = format(t.agentTimetableStats, { courses: outcome.coursesCreated, events: outcome.eventsCreated });
      cta = { href: "/calendar", label: t.openCalendar };
      break;
    }
    case "TASK": {
      heading = t.agentTaskDone;
      const due = new Date(outcome.deadline);
      detail = Number.isNaN(due.getTime())
        ? outcome.title
        : `${outcome.title} · ${format(t.agentTaskDue, { date: due.toLocaleDateString(locale, { month: "short", day: "numeric" }) })}`;
      cta = { href: "/tasks", label: t.openTasks };
      break;
    }
    case "KNOWLEDGE_GAP": {
      heading = t.agentGapDone;
      detail = outcome.title;
      cta = { href: "/knowledge-gaps", label: t.openGap };
      break;
    }
    case "SUBJECT": {
      heading = format(t.agentSubjectDone, { course: outcome.subjectName });
      cta = { href: "/academics", label: t.openAcademics };
      break;
    }
    case "FILED": {
      heading = t.agentFiledOnly;
      break;
    }
  }

  return (
    <div className="orb-emerge mt-4 flex flex-col items-center gap-2 rounded-xl border border-success/25 bg-success/10 p-5 text-center">
      <CheckCircle2 className="size-6 text-success" />
      <p className="text-sm font-medium">{heading}</p>
      {/* A timetable's skip count rides its own line: the fact that some rows
          could not be read is worth saying, but not so loudly it competes
          with what did succeed. */}
      {outcome.kind === "TIMETABLE" && outcome.skipped > 0 && (
        <p className="text-xs text-muted-foreground">{format(t.agentTimetableSkipped, { count: outcome.skipped })}</p>
      )}
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      {cta && (
        <Button asChild size="sm" variant="outline" className="mt-1">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      )}
    </div>
  );
}
