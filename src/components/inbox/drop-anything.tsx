"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, CornerDownLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/shared/i18n-provider";
import { Orb, type OrbState } from "@/components/inbox/orb";
import { UnderstandingSteps, type StepId, type StepState } from "@/components/inbox/understanding-steps";
import { InsightCard } from "@/components/inbox/insight-card";
import { captureText, captureFiles, requestAnalysis, acceptProposal } from "@/app/actions/capture";
import type { CaptureAnalysis } from "@/lib/ai/types";
import type { InboxItem } from "@/lib/inbox";

type Phase = "idle" | "composing" | "working" | "result";

const IDLE_STEPS: Record<StepId, StepState> = {
  received: "pending",
  reading: "pending",
  understanding: "pending",
  connecting: "pending",
  placing: "pending",
};

/**
 * The gateway into the product.
 *
 * One entry point, several ways in: drag a file onto the page, paste a
 * screenshot, click the orb and type. Which of those the student used is not
 * something the interface asks about — they all end in the same place, which
 * is the entire premise of "drop anything".
 *
 * The phases are driven by real work rather than a script. `working` lasts
 * exactly as long as the upload and the model call actually take, and the
 * step list underneath reports where that work has got to; when it ends, the
 * insight card carries what the analysis genuinely returned. If no provider
 * is configured the same flow runs and stops honestly at "saved, not
 * analysed" — the orb is not a costume over an empty box.
 */
export function DropAnything({
  aiConfigured,
  subjects,
}: {
  aiConfigured: boolean;
  subjects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { dict, format } = useI18n();
  const t = dict.inbox;

  const [phase, setPhase] = React.useState<Phase>("idle");
  const [dragging, setDragging] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [steps, setSteps] = React.useState(IDLE_STEPS);
  const [stepDetail, setStepDetail] = React.useState<Partial<Record<StepId, string>>>({});
  const [result, setResult] = React.useState<{ item: InboxItem; analysis: CaptureAnalysis } | null>(null);
  const [accepting, setAccepting] = React.useState(false);

  const fileInput = React.useRef<HTMLInputElement>(null);
  const textarea = React.useRef<HTMLTextAreaElement>(null);

  function setStep(id: StepId, state: StepState, detail?: string) {
    setSteps((s) => ({ ...s, [id]: state }));
    if (detail !== undefined) setStepDetail((d) => ({ ...d, [id]: detail }));
  }

  function reset() {
    setPhase("idle");
    setSteps(IDLE_STEPS);
    setStepDetail({});
    setResult(null);
    setNote("");
  }

  /**
   * The one path everything takes once something has been captured.
   *
   * `create` returns the new row; from there the stages are real awaits, and
   * the last two report what the analysis actually contained rather than
   * ticking regardless.
   */
  const run = React.useCallback(
    async (create: () => Promise<{ id: string }>, kind: "TEXT" | "FILE", displayName: string) => {
      setPhase("working");
      setSteps({ ...IDLE_STEPS, received: "running" });
      setStepDetail({});

      let captureId: string;
      try {
        const created = await create();
        captureId = created.id;
        setStep("received", "done", displayName);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.dropFailed);
        reset();
        return;
      }

      router.refresh();

      // A typed note is its own text, already in hand. A file's text does not
      // exist until the document pipeline has extracted it, which does not
      // happen inside this request — so this step reports that honestly
      // instead of pretending to have read something it has not.
      if (kind === "TEXT") {
        setStep("reading", "done");
      } else {
        setStep("reading", "empty", t.fileStillReading);
      }

      if (!aiConfigured) {
        setStep("understanding", "empty", t.aiOffTitle);
        setStep("connecting", "empty");
        setStep("placing", "empty", t.stepOutcome.noPlacement);
        toast.success(t.dropped);
        window.setTimeout(reset, 2600);
        return;
      }

      setStep("understanding", "running");
      const analysis = await requestAnalysis(captureId).catch(() => null);

      if (!analysis?.analysis) {
        setStep("understanding", "empty", analysis?.error ?? t.statusUnprocessed);
        setStep("connecting", "empty");
        setStep("placing", "empty", t.stepOutcome.noPlacement);
        toast.success(t.dropped);
        window.setTimeout(reset, 3200);
        return;
      }

      const a = analysis.analysis;
      setStep("understanding", "done");

      const subjectName = subjects.find((s) => s.id === a.subjectId)?.name ?? null;
      if (subjectName) {
        setStep("connecting", "done", format(t.stepOutcome.connected, { subject: subjectName }));
      } else {
        setStep("connecting", "empty", t.stepOutcome.noConnections);
      }
      setStep("placing", "done");

      setResult({
        item: {
          id: captureId,
          kind,
          status: "NEEDS_REVIEW",
          text: kind === "TEXT" ? displayName : null,
          fileName: kind === "FILE" ? displayName : null,
          mimeType: null,
          documentStatus: null,
          pageCount: null,
          analysis: a,
          analyzedBy: analysis.analyzedBy,
          error: null,
          createdAt: new Date(),
        },
        analysis: a,
      });
      setPhase("result");
      router.refresh();
    },
    [aiConfigured, format, router, subjects, t]
  );

  const submitFiles = React.useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const formData = new FormData();
      for (const file of files) formData.append("files", file);
      const name = files.length === 1 ? files[0].name : `${files.length} files`;
      await run(
        async () => {
          const created = await captureFiles(formData);
          return created[0];
        },
        "FILE",
        name
      );
    },
    [run]
  );

  async function submitNote() {
    const content = note.trim();
    if (!content) return;
    const preview = content.length > 90 ? `${content.slice(0, 90)}…` : content;
    await run(() => captureText(content), "TEXT", preview);
  }

  async function accept() {
    if (!result) return;
    setAccepting(true);
    try {
      await acceptProposal(result.item.id);
      toast.success(t.filed);
      router.refresh();
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.organizeFailed);
    } finally {
      setAccepting(false);
    }
  }

  // Window-level paste, so a freshly-taken screenshot goes in without the
  // student first hunting for the right box to focus.
  React.useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (phase === "working") return;
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      void submitFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [phase, submitFiles]);

  const orbState: OrbState =
    phase === "working" ? "processing" : dragging ? "drag" : phase === "result" ? "done" : "idle";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (phase !== "working") setDragging(true);
      }}
      onDragLeave={(e) => {
        // Only clear when the pointer actually leaves this element, not when
        // it crosses onto a child — otherwise the orb flickers as you move.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void submitFiles(Array.from(e.dataTransfer.files));
      }}
      className="relative flex flex-col items-center"
    >
      <input
        ref={fileInput}
        type="file"
        multiple
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          void submitFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      <Orb
        state={orbState}
        onActivate={() => {
          if (phase === "idle") {
            setPhase("composing");
            // Focused after the panel has mounted, so the caret lands in it
            // rather than being set on an element that is not there yet.
            window.setTimeout(() => textarea.current?.focus(), 60);
          }
        }}
      />

      {/* The words. Below the sphere rather than across it, so the liquid is
          never dimmed to make room for them, and staggered so the orb is seen
          first and the label resolves after it — the object, then its name. */}
      <div className="mt-7 flex flex-col items-center gap-2 text-center">
        <h2 className="font-display text-[clamp(2rem,5.6vw,3.25rem)] font-semibold leading-[1.02] tracking-tight">
          {(() => {
            const words = t.dropAnything.split(" ");
            return words.map((word, i) => (
              <span
                key={word}
                className="orb-word inline-block"
                style={{ animationDelay: `${420 + i * 260}ms` }}
              >
                {word}
                {/* Every word but the last carries its own separator. The
                    separator has to live inside the animated span or the
                    inline-block boxes butt together — and it must not be tied
                    to the first word only: the Arabic title is three words,
                    and that spelled it "أسقط أيشيء". */}
                {i < words.length - 1 ? "\u00A0" : ""}
              </span>
            ));
          })()}
        </h2>
        <p
          className="orb-word max-w-md text-balance text-sm leading-relaxed text-muted-foreground"
          style={{ animationDelay: "980ms" }}
        >
          {dragging ? t.releaseToDrop : t.dropSubtitle}
        </p>
      </div>

      {/* Everything below occupies one column of the same width, so the
          composer, the steps and the card all appear to come out of the orb. */}
      <div className="mt-7 w-full max-w-lg">
        {phase === "composing" && (
          <div className="orb-emerge rounded-2xl border border-border-subtle bg-surface-elevated/90 p-4 shadow-elevated backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{t.typeHere}</p>
              <Button size="icon" variant="ghost" onClick={reset} aria-label={t.cancel}>
                <X className="size-4" />
              </Button>
            </div>
            <Textarea
              ref={textarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.typePlaceholder}
              rows={3}
              className="mt-2 resize-none bg-surface-primary"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void submitNote();
                }
              }}
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                {t.dropCta}
              </Button>
              <Button size="sm" disabled={note.trim().length === 0} onClick={submitNote}>
                <CornerDownLeft className="size-3.5" />
                {t.send}
              </Button>
            </div>
          </div>
        )}

        {phase === "working" && (
          <div className="orb-emerge rounded-2xl border border-border-subtle bg-surface-elevated/90 p-5 shadow-elevated backdrop-blur-sm">
            <UnderstandingSteps states={steps} detail={stepDetail} />
          </div>
        )}

        {phase === "result" && result && (
          <InsightCard
            item={result.item}
            analysis={result.analysis}
            subjectName={subjects.find((s) => s.id === result.analysis.subjectId)?.name ?? null}
            busy={accepting}
            onAccept={accept}
            onEdit={() => {
              // Editing happens on the item's own row in the queue below,
              // which already has the full form — rather than a second,
              // divergent copy of it inside this card.
              reset();
              router.refresh();
              document.getElementById(`capture-${result.item.id}`)?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        )}

      </div>

      {phase === "working" && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          {t.analyzing}
        </p>
      )}
    </div>
  );
}
