"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, StickyNote, AlertCircle, Trash2, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/components/shared/i18n-provider";
import { organizeWithAI, discardCapture } from "@/app/actions/capture";
import { VISION_MIME_TYPES } from "@/lib/capture-kinds";
import { AgentAsk } from "@/components/inbox/agent-ask";
import { AgentResult, type AgentOutcome } from "@/components/inbox/agent-result";
import type { InboxItem as InboxItemData } from "@/lib/inbox";
import type { Dictionary } from "@/lib/i18n/dictionaries";

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
 * One thing that did not get sorted out on the way in.
 *
 * This used to be a form: a title field, a subject dropdown, a "file it as"
 * dropdown, a notes box and a save button — the student doing the filing by
 * hand, which is the exact work this product exists to remove. Anything
 * reaching this list has already failed to be handled automatically, so the
 * only useful answers here are "try again", "answer the question it asked",
 * and "bin it".
 *
 * The agent still decides where things go. There is nowhere in this component
 * to choose a course or a destination, on purpose.
 */
export function InboxItem({ item, aiConfigured }: { item: InboxItemData; aiConfigured: boolean }) {
  const router = useRouter();
  const { dict } = useI18n();
  const t = dict.inbox;

  const [busy, setBusy] = React.useState(false);
  const [outcome, setOutcome] = React.useState<AgentOutcome | null>(null);

  /**
   * Hands the item back to the agent.
   *
   * `answer` carries a reply to a question a previous run asked, which the
   * server folds into a fresh run rather than resuming a stored conversation.
   */
  async function organize(answer?: string) {
    setBusy(true);
    try {
      setOutcome(await organizeWithAI(item.id, answer));
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

  // Text extraction is a precondition for reading a PDF and irrelevant to a
  // photograph: the model looks at the picture itself, so a screenshot whose
  // extraction is still queued is not waiting on anything. Saying otherwise
  // told the student to come back later for a file that was ready the moment
  // they dropped it.
  const fileStillReading =
    item.kind === "FILE" &&
    !(item.mimeType && VISION_MIME_TYPES.has(item.mimeType)) &&
    item.documentStatus === "PROCESSING";

  // A question the agent left on the row survives a page reload, so an item
  // waiting on an answer still shows what it is waiting for.
  //
  // A run that was cut off part way lands in the same state with something to
  // say, so the two are told apart by `error`: a question carries none, and a
  // cut-off run carries the reason it stopped. Without that, "I ran out of
  // time" would be presented to the student as a question to answer.
  const pendingQuestion =
    !outcome && item.status === "NEEDS_REVIEW" && item.agentSummary && !item.error
      ? item.agentSummary
      : null;

  // What the agent already did, from an earlier run, so a reload does not hide
  // rows that exist. Only shown while nothing newer is on screen.
  const priorActions = !outcome && item.agentActions.length > 0 ? item.agentActions : null;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{item.kind === "FILE" ? t.fileLabel : t.noteLabel}</Badge>
            <Badge variant={item.status === "FAILED" ? "destructive" : "outline"}>
              {t[STATUS_LABEL[item.status]]}
            </Badge>
          </div>

          <p className="mt-2 break-words text-sm font-medium">
            {item.fileName ?? item.text ?? item.analysis?.title}
          </p>

          {/* The stored error is the provider's own words — an HTTP status, a
              model name — written for whoever deploys this, never translated,
              and nothing a student can act on. It stays on the row for
              diagnosis; here they get their own language. It also stands down
              the moment the agent has said something of its own, since both
              render from this one card. */}
          {item.error && !outcome && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {t.agentCouldNotRead}
            </p>
          )}
          {fileStillReading && <p className="mt-1 text-xs text-muted-foreground">{t.fileStillReading}</p>}
        </div>

        <Button size="icon" variant="ghost" disabled={busy} onClick={discard} aria-label={t.discard}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* One action: let the agent have another go. Hidden entirely when no
          provider is configured, since there is nothing to try again with. */}
      {!outcome && !pendingQuestion && aiConfigured && (
        <Button size="sm" className="mt-3" onClick={() => organize()} disabled={busy}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {t.organizeIt}
        </Button>
      )}

      {(pendingQuestion || outcome?.status === "ASKED") && (
        <AgentAsk
          question={pendingQuestion ?? (outcome?.status === "ASKED" ? outcome.question : "")}
          busy={busy}
          onAnswer={(answer) => organize(answer)}
          onSkip={discard}
        />
      )}

      {outcome && outcome.status !== "ASKED" && (
        <AgentResult outcome={outcome} busy={busy} onRetry={() => organize()} />
      )}

      {/* Rows an earlier run created, redrawn after a reload. Presented as
          what it managed rather than as a finished job, because this item is
          still in the inbox precisely because the run did not finish. */}
      {priorActions && !pendingQuestion && (
        <AgentResult
          outcome={{ status: "PARTIAL", actions: priorActions, summary: "", reason: item.error ?? "" }}
          busy={busy}
          onRetry={() => organize()}
        />
      )}
    </Card>
  );
}
