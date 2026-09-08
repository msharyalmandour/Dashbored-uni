"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, StickyNote, Loader2, Sparkles, AlertCircle, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/components/shared/i18n-provider";
import { requestAnalysis, organizeCapture, discardCapture, type OrganizeDecision } from "@/app/actions/capture";
import { LOW_CONFIDENCE } from "@/lib/ai/types";
import type { InboxItem as InboxItemData } from "@/lib/inbox";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Destination = OrganizeDecision["destination"];

/** Only the flat string keys — the dictionary section also holds nested groups. */
type InboxStringKey = {
  [K in keyof Dictionary["inbox"]]: Dictionary["inbox"][K] extends string ? K : never;
}[keyof Dictionary["inbox"]];

const STATUS_LABEL: Record<InboxItemData["status"], InboxStringKey> = {
  PENDING: "statusPending",
  ANALYZING: "statusAnalyzing",
  NEEDS_REVIEW: "statusNeedsReview",
  ORGANIZED: "statusOrganized",
  FAILED: "statusFailed",
  UNPROCESSED: "statusUnprocessed",
};

/**
 * One thing waiting in the inbox, with everything needed to deal with it.
 *
 * The form is always fully editable and always shows the student's own choice
 * as the value that will be saved — the proposal only ever pre-fills it. That
 * is the difference between a suggestion and an automation, and it is why a
 * wrong classification here costs a correction rather than a cleanup.
 */
export function InboxItem({
  item,
  subjects,
  aiConfigured,
}: {
  item: InboxItemData;
  subjects: { id: string; name: string }[];
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const { dict, format } = useI18n();
  const t = dict.inbox;

  const analysis = item.analysis;
  const unsure = !analysis || analysis.confidence < LOW_CONFIDENCE;

  const fallbackTitle = item.fileName ?? item.text?.slice(0, 80) ?? "";

  const [title, setTitle] = React.useState(analysis?.title ?? fallbackTitle);
  const [subjectId, setSubjectId] = React.useState(analysis?.subjectId ?? "");
  const [destination, setDestination] = React.useState<Destination>("NONE");
  const [notes, setNotes] = React.useState(analysis?.summary ?? "");
  const [deadline, setDeadline] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function analyze() {
    setBusy(true);
    try {
      const result = await requestAnalysis(item.id);
      if (result.analysis) {
        setTitle(result.analysis.title);
        setSubjectId(result.analysis.subjectId ?? "");
        setNotes(result.analysis.summary);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.dropFailed);
    } finally {
      setBusy(false);
    }
  }

  async function file() {
    setBusy(true);
    try {
      await organizeCapture({
        captureId: item.id,
        subjectId: subjectId || null,
        destination,
        title,
        notes: notes || undefined,
        deadline: deadline || undefined,
      });
      toast.success(t.filed);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.organizeFailed);
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    setBusy(true);
    try {
      await discardCapture(item.id);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.discardFailed);
    } finally {
      setBusy(false);
    }
  }

  const Icon = item.kind === "FILE" ? FileText : StickyNote;
  const fileStillReading =
    item.kind === "FILE" && (item.documentStatus === "QUEUED" || item.documentStatus === "PROCESSING");

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{item.kind === "FILE" ? t.fileLabel : t.noteLabel}</Badge>
            <Badge variant={item.status === "FAILED" ? "destructive" : "outline"}>{t[STATUS_LABEL[item.status]]}</Badge>
            {analysis && (
              <Badge variant={unsure ? "warning" : "success"}>
                {unsure ? t.confidenceLow : t.confidenceHigh}
              </Badge>
            )}
          </div>

          <p className="mt-2 break-words text-sm font-medium">{item.fileName ?? item.text}</p>

          {item.error && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {item.error}
            </p>
          )}
          {fileStillReading && <p className="mt-1 text-xs text-muted-foreground">{t.fileStillReading}</p>}
        </div>

        <Button size="icon" variant="ghost" disabled={busy} onClick={discard} aria-label={t.discard}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* The proposal, shown as something a machine said — attributed, and
          explicitly not yet saved anywhere. */}
      {analysis && (
        <div className="mt-3 rounded-lg border border-border-subtle bg-surface-secondary p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" />
            {format(t.proposedBy, { provider: item.analyzedBy ?? "AI" })}
          </p>
          {analysis.summary && <p className="mt-1.5 text-sm text-foreground/85">{analysis.summary}</p>}
          {analysis.topics.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {analysis.topics.map((topic) => (
                <Badge key={topic} variant="outline">
                  {topic}
                </Badge>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t.proposalNote}</p>
        </div>
      )}

      {aiConfigured && !analysis && !fileStillReading && (
        <Button size="sm" variant="outline" className="mt-3" disabled={busy} onClick={analyze}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {busy ? t.analyzing : item.status === "FAILED" ? t.analyzeAgain : t.analyze}
        </Button>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`title-${item.id}`}>{t.titleLabel}</Label>
          <Input id={`title-${item.id}`} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
        </div>

        <div>
          <Label htmlFor={`subject-${item.id}`}>{t.detectedSubject}</Label>
          <Select value={subjectId || "none"} onValueChange={(v) => setSubjectId(v === "none" ? "" : v)}>
            <SelectTrigger id={`subject-${item.id}`} className="mt-1">
              <SelectValue placeholder={t.chooseSubject} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t.noSubject}</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={`destination-${item.id}`}>{t.fileAs}</Label>
          <Select value={destination} onValueChange={(v) => setDestination(v as Destination)}>
            <SelectTrigger id={`destination-${item.id}`} className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">{t.destinations.none}</SelectItem>
              <SelectItem value="KNOWLEDGE_GAP">{t.destinations.knowledgeGap}</SelectItem>
              <SelectItem value="TASK">{t.destinations.task}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {destination === "TASK" && (
          <div>
            <Label htmlFor={`deadline-${item.id}`}>{t.deadlineLabel}</Label>
            <Input
              id={`deadline-${item.id}`}
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1"
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <Label htmlFor={`notes-${item.id}`}>{t.notesLabel}</Label>
          <Textarea
            id={`notes-${item.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 resize-none"
          />
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {destination === "NONE"
          ? t.destinationHint.none
          : destination === "KNOWLEDGE_GAP"
            ? t.destinationHint.knowledgeGap
            : t.destinationHint.task}
      </p>

      <div className="mt-3 flex justify-end">
        <Button size="sm" disabled={busy || title.trim().length === 0} onClick={file}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          {busy ? t.filing : t.confirm}
        </Button>
      </div>
    </Card>
  );
}
