"use client";

import * as React from "react";
import { Brain, FileText, BookOpen, Dna, CalendarClock, Check, Pencil, AlertTriangle, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/shared/i18n-provider";
import { LOW_CONFIDENCE, type CaptureAnalysis } from "@/lib/ai/types";
import type { InboxItem } from "@/lib/inbox";

/**
 * What the system understood, presented for a one-tap yes.
 *
 * The brief for this product is that the student should never have to fill in
 * course, category and topic by hand — so the primary action here is a single
 * "Looks good", and everything else is secondary. Edit exists because the
 * proposal is a proposal; it is deliberately the quieter button.
 *
 * Two kinds of number appear on this card and they are not the same kind of
 * fact. The page count is counted by the PDF processor. The concept counts
 * are lengths of lists the model returned. Neither is invented, and the card
 * never shows a figure it does not have — a thought with no concepts simply
 * has no concepts row rather than a padded one.
 *
 * When confidence is low the card leads with that instead of burying it. A
 * system that is unsure and says so is worth more than one that is unsure and
 * sounds certain.
 */
export function InsightCard({
  item,
  analysis,
  subjectName,
  busy,
  onAccept,
  onEdit,
  onCreateSubject,
}: {
  item: InboxItem;
  analysis: CaptureAnalysis;
  subjectName: string | null;
  busy: boolean;
  onAccept: () => void;
  onEdit: () => void;
  /** Absent when the caller cannot create courses; the offer then stays hidden. */
  onCreateSubject?: () => void;
}) {
  const { dict, format } = useI18n();
  const t = dict.inbox;
  const unsure = analysis.confidence < LOW_CONFIDENCE;

  const facts: string[] = [];
  if (item.pageCount) facts.push(format(t.foundPages, { count: item.pageCount }));
  if (analysis.keyConcepts.length > 0) {
    facts.push(format(t.foundConcepts, { count: analysis.keyConcepts.length }));
  }
  if (analysis.demandingConcepts.length > 0) {
    facts.push(format(t.foundDemanding, { count: analysis.demandingConcepts.length }));
  }

  return (
    <div className="orb-emerge w-full rounded-2xl border border-border-subtle bg-surface-elevated/90 p-5 shadow-elevated backdrop-blur-sm">
      {unsure ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-warning/25 bg-warning/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium">{t.unsureHeading}</p>
            <p className="text-xs text-muted-foreground">{t.unsureBody}</p>
          </div>
        </div>
      ) : (
        <p className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Brain className="size-4 text-primary" />
          {t.understood}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        <Line icon={FileText} value={t.contentTypes[analysis.contentType]} strong />
        <Line icon={BookOpen} value={subjectName ?? t.noSubjectDetected} muted={!subjectName} />
        {analysis.topics.length > 0 && <Line icon={Dna} value={analysis.topics.join(" · ")} />}
      </div>

      <p className="mt-4 break-words text-sm text-foreground/85">{analysis.title}</p>

      {facts.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.iFound}</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {facts.map((fact) => (
              <li key={fact} className="flex items-center gap-2 text-sm text-foreground/80">
                <span className="size-1 rounded-full bg-primary" />
                {fact}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Only ever rendered when the content genuinely stated a date, and it
          shows the student the words it read that from. */}
      {analysis.detectedEvent && (
        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="size-4 text-primary" />
            {t.detectedEventLabel}
            {analysis.detectedEvent.date && (
              <Badge variant="outline">{analysis.detectedEvent.date}</Badge>
            )}
          </p>
          <p className="mt-1 text-sm text-foreground/85">{analysis.detectedEvent.title}</p>
          {analysis.detectedEvent.evidence && (
            <p className="mt-1 text-xs italic text-muted-foreground">
              {format(t.fromYourWords, { evidence: analysis.detectedEvent.evidence })}
            </p>
          )}
        </div>
      )}

      {/* The course this belongs to does not exist yet. Offering to create it
          is what stops a new student's first drop from being filed into
          nothing — but it is an offer, because creating a course in someone's
          account is not something to do quietly on their behalf. */}
      {analysis.proposedSubjectName && onCreateSubject && (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <FolderPlus className="size-4 text-primary" />
            {format(t.newCourseFound, { course: analysis.proposedSubjectName })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t.newCourseBody}</p>
          <Button size="sm" className="mt-2.5" onClick={onCreateSubject} disabled={busy}>
            <Check className="size-3.5" />
            {format(t.createCourse, { course: analysis.proposedSubjectName })}
          </Button>
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        <Button
          onClick={onAccept}
          disabled={busy}
          className="flex-1"
          variant={analysis.proposedSubjectName ? "outline" : "default"}
        >
          <Check className="size-4" />
          {busy ? t.filing : analysis.proposedSubjectName ? t.justSaveIt : t.looksGood}
        </Button>
        <Button variant="ghost" onClick={onEdit} disabled={busy}>
          <Pencil className="size-4" />
          {t.edit}
        </Button>
      </div>
    </div>
  );
}

function Line({
  icon: Icon,
  value,
  strong,
  muted,
}: {
  icon: typeof FileText;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <p className="flex items-center gap-2.5 text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className={strong ? "font-medium" : muted ? "text-muted-foreground" : ""}>{value}</span>
    </p>
  );
}
