"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Paperclip,
  Mic,
  Square,
  CornerDownLeft,
  Camera,
  Video,
  Images,
  FolderOpen,
  Link2,
  X,
  FileText,
  Music,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/components/shared/i18n-provider";
import { Orb, type OrbState } from "@/components/inbox/orb";
import { useVoiceRecorder } from "@/components/inbox/use-voice-recorder";
import { captureText, captureFiles, organizeWithAI, discardCapture } from "@/app/actions/capture";
import type { AgentRunResult } from "@/lib/ai/agent/types";
import { describeFile, isBlocked, FILE_ACCEPT_ATTRIBUTE, type FileCapability } from "@/lib/capture-kinds";
import { AgentAsk } from "@/components/inbox/agent-ask";
import { AgentResult, type AgentOutcome } from "@/components/inbox/agent-result";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

/**
 * A real thumbnail, not a generic icon — the whole point of a preview.
 *
 * The object URL is created and revoked inside the same effect on purpose:
 * Strict Mode's dev double-invoke runs an effect, its cleanup, then the
 * effect again, and a URL created outside that cycle (e.g. in a `useMemo`)
 * gets revoked by the first cleanup while the second invocation never
 * recreates it — leaving an `<img>` pointing at a dead blob. Owning both
 * halves in one effect is what makes it survive that.
 */
function ImageThumb({ file }: { file: File }) {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizing with a real external resource (the browser's blob registry), whose lifetime must match this effect's, not a derived value.
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return <Images className="size-3.5 shrink-0 text-muted-foreground" />;
  // eslint-disable-next-line @next/next/no-img-element -- a transient local blob: URL, not a served asset.
  return <img src={url} alt="" className="size-4 shrink-0 rounded-sm object-cover" />;
}

type Phase = "idle" | "working" | "result";

/**
 * The universal entry point.
 *
 * One field, several ways in: drag a file onto it, paste a screenshot, attach
 * from disk, record a voice note, or just type. Which one the student used is
 * never asked about — they all end in the same place, which is the whole
 * premise. The controls are small and sit inside the field rather than
 * becoming a row of large buttons, because a grid of buttons is the "which
 * section does this go in?" question wearing a different hat.
 *
 * The phases are driven by real work. `working` lasts exactly as long as the
 * upload and the model call take, and the step list reports where that has
 * got to. Where the system cannot do something — a video it cannot transcribe,
 * a format it cannot read inside — it says so on the spot instead of storing
 * the file and letting the student assume it was understood.
 */
export function DropAnything({
  aiConfigured,
  compact = false,
  onFiled,
}: {
  aiConfigured: boolean;
  /** The floating panel is tight on space; the page is not. */
  compact?: boolean;
  onFiled?: () => void;
}) {
  const router = useRouter();
  const { dict } = useI18n();
  const t = dict.inbox;

  const [phase, setPhase] = React.useState<Phase>("idle");
  const [dragging, setDragging] = React.useState(false);
  const [note, setNote] = React.useState("");
  /**
   * Two words, not six rows. The student does not need our pipeline stages
   * named at them — the orb already says "working", and the only distinction
   * worth making out loud is reading it versus acting on it.
   */
  const [stage, setStage] = React.useState<"reading" | "organizing">("reading");
  /** What the agent decided and did, once understanding finishes. */
  const [outcome, setOutcome] = React.useState<AgentOutcome | null>(null);
  /** The capture the current outcome is for — needed by the ask-flow's Yes/No
   *  and by retry, both of which act on the same row understanding produced. */
  const [captureId, setCaptureId] = React.useState<string | null>(null);
  const [accepting, setAccepting] = React.useState(false);
  /**
   * Whatever has been attached but not yet sent — from any entry point
   * (camera, gallery, file browser, voice, drag, paste). Shown as chips so a
   * mixed batch (a slide deck plus a few screenshots) is reviewable and
   * editable before it becomes a real capture, rather than firing on the
   * first file selected.
   */
  const [staged, setStaged] = React.useState<File[]>([]);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkValue, setLinkValue] = React.useState("");

  const photoInput = React.useRef<HTMLInputElement>(null);
  const videoInput = React.useRef<HTMLInputElement>(null);
  const galleryInput = React.useRef<HTMLInputElement>(null);
  const filesInput = React.useRef<HTMLInputElement>(null);
  const linkFieldRef = React.useRef<HTMLInputElement>(null);

  const reset = React.useCallback(() => {
    setPhase("idle");
    setStage("reading");
    setOutcome(null);
    setCaptureId(null);
    setNote("");
    setStaged([]);
    setLinkOpen(false);
    setLinkValue("");
  }, []);

  const run = React.useCallback(
    async (create: () => Promise<{ id: string }>, cap: FileCapability | null) => {
      setPhase("working");
      setStage("reading");

      let captureId: string;
      try {
        const created = await create();
        captureId = created.id;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.dropFailed);
        reset();
        return;
      }

      setCaptureId(captureId);
      router.refresh();

      // The capability registry already knows what this is and how far
      // reading it can go — no request needed. When it cannot be read at
      // all, the run stops here and says which limit it hit. Storing it is
      // still a real outcome: it is in the Library, and saying so beats a
      // success message for something nobody looked inside.
      const level = cap?.level ?? "TEXT";
      if (level === "STORED") {
        const reason =
          cap?.category === "VIDEO"
            ? t.capability.video
            : cap?.category === "AUDIO"
              ? t.capability.audio
              : cap?.category === "DOCUMENT"
                ? t.capability.document
                : t.capability.other;
        setOutcome({ status: "NOT_READ", reason, canRetry: false });
        setPhase("result");
        return;
      }

      if (!aiConfigured) {
        setOutcome({ status: "NOT_READ", reason: t.aiOffBody, canRetry: false });
        setPhase("result");
        return;
      }

      // One call now, where there used to be two. The agent reads the item and
      // does the work in the same run — there is no longer a point between
      // "understood" and "acted on" for the interface to sit in, because the
      // model reaches the writes itself rather than handing a classification
      // to code that decides what it was allowed to mean.
      setStage("organizing");
      const execution = await organizeWithAI(captureId).catch(
        (err): AgentRunResult => ({
          status: "FAILED",
          actions: [],
          message: err instanceof Error ? err.message : t.organizeFailed,
        })
      );

      setOutcome(execution);
      setPhase("result");
      router.refresh();

      // The panel clears itself only when the work is finished and nothing is
      // waiting on the student. A question, a failure, or a run that stopped
      // part way all stay on screen until they deal with it.
      if (execution.status === "DONE") {
        onFiled?.();
        window.setTimeout(reset, 8000);
      }
    },
    [aiConfigured, onFiled, reset, router, t]
  );

  const submitFiles = React.useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const rejected = files.find((f) => isBlocked(f.name));
      if (rejected) {
        toast.error(`${rejected.name}: ${t.unsupportedFile}`);
        return;
      }

      const first = files[0];
      const cap = describeFile(first.name, first.type);

      const formData = new FormData();
      for (const file of files) formData.append("files", file);

      await run(async () => {
        const created = await captureFiles(formData);
        return created[0];
      }, cap);
    },
    [run, t]
  );

  /**
   * The single entry point every attach method funnels through: camera,
   * gallery, file browser, drag, paste, and a stopped voice recording. Blocked
   * files are refused here, at the moment they are added, rather than at
   * submit time — a mixed batch should not silently lose the files that were
   * fine because one of them was not.
   */
  const addToStaged = React.useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const accepted: File[] = [];
      for (const file of files) {
        if (isBlocked(file.name)) {
          toast.error(`${file.name}: ${t.unsupportedFile}`);
          continue;
        }
        accepted.push(file);
      }
      if (accepted.length > 0) setStaged((prev) => [...prev, ...accepted]);
    },
    [t]
  );

  const removeStaged = React.useCallback((index: number) => {
    setStaged((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const recorder = useVoiceRecorder(React.useCallback((file: File) => addToStaged([file]), [addToStaged]));

  async function submitNote() {
    const content = note.trim();
    if (!content) return;
    await run(() => captureText(content), null);
  }

  /**
   * The one send action. Staged files win when there are any — they are the
   * explicit, reviewed thing the student built up. A typed note stays in the
   * field afterwards rather than being silently dropped, since a single
   * capture can only be one kind (text or file) without a schema change; the
   * student can send it as its own drop right after.
   */
  async function submit() {
    if (staged.length > 0) {
      const files = staged;
      setStaged([]);
      await submitFiles(files);
      return;
    }
    await submitNote();
  }

  function confirmLink() {
    const url = linkValue.trim();
    if (!url) return;
    setNote((prev) => (prev ? `${prev}\n${url}` : url));
    setLinkValue("");
    setLinkOpen(false);
  }

  /**
   * Runs the agent again on the item already created.
   *
   * Used both for a retry and for answering a question it asked — they are
   * the same operation, because the answer is context for a fresh run rather
   * than a reply into a conversation being held open. Retrying never asks the
   * student to re-drop anything: the row and its file already exist.
   */
  async function rerun(answer?: string) {
    if (!captureId) return;
    setAccepting(true);
    try {
      const execution = await organizeWithAI(captureId, answer);
      setOutcome(execution);
      router.refresh();
      if (execution.status === "DONE") {
        onFiled?.();
        window.setTimeout(reset, 8000);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.organizeFailed);
    } finally {
      setAccepting(false);
    }
  }

  /**
   * Declining to answer.
   *
   * The item goes rather than sitting in the inbox as a question nobody
   * intends to answer — the student already decided it was not worth their
   * attention by skipping, and leaving it behind would only ask again later.
   */
  async function skipQuestion() {
    if (!captureId) return;
    setAccepting(true);
    try {
      await discardCapture(captureId);
      router.refresh();
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.discardFailed);
    } finally {
      setAccepting(false);
    }
  }

  React.useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (phase === "working") return;
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      addToStaged(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [phase, addToStaged]);

  React.useEffect(() => {
    if (recorder.state === "denied") toast.error(t.micDenied);
    if (recorder.state === "unsupported") toast.error(t.micUnsupported);
  }, [recorder.state, t]);

  React.useEffect(() => {
    if (linkOpen) linkFieldRef.current?.focus();
  }, [linkOpen]);

  const orbState: OrbState =
    phase === "working" ? "processing" : dragging ? "drag" : phase === "result" ? "done" : "idle";

  const recording = recorder.state === "recording";
  const canSend = staged.length > 0 || note.trim().length > 0;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (phase !== "working") setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (phase === "working") return;
        addToStaged(Array.from(e.dataTransfer.files));
      }}
      className="relative flex w-full flex-col items-center"
    >
      {/*
       * Four inputs, not one, because the `capture` attribute and `accept`
       * together are what let a mobile browser open the exact native surface
       * (camera vs. video camera vs. gallery vs. general file browser) — a
       * single input can only ever offer one of those at a time.
       */}
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addToStaged(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addToStaged(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <input
        ref={galleryInput}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          addToStaged(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <input
        ref={filesInput}
        type="file"
        multiple
        accept={FILE_ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(e) => {
          addToStaged(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      <Orb state={orbState} className={compact ? "w-[13rem]" : undefined} />

      <div className={cn("flex flex-col items-center gap-2 text-center", compact ? "mt-4" : "mt-7")}>
        <h2
          className={cn(
            "font-display font-semibold leading-[1.02] tracking-tight",
            compact ? "text-2xl" : "text-[clamp(2rem,5.6vw,3.25rem)]"
          )}
        >
          {(() => {
            const words = t.dropAnything.split(" ");
            return words.map((word, i) => (
              <span
                key={word}
                className="orb-word inline-block"
                style={{ animationDelay: `${420 + i * 260}ms` }}
              >
                {word}
                {/* The separator lives inside the animated span or the
                    inline-block boxes butt together — and it must not be tied
                    to the first word only: the Arabic title is three words,
                    and that spelled it "أسقط أيشيء". */}
                {i < words.length - 1 ? " " : ""}
              </span>
            ));
          })()}
        </h2>
        <p
          className={cn(
            "orb-word max-w-md text-balance leading-relaxed text-muted-foreground",
            compact ? "text-xs" : "text-sm"
          )}
          style={{ animationDelay: "980ms" }}
        >
          {dragging ? t.releaseToDrop : t.dropSubtitle}
        </p>
      </div>

      <div className={cn("w-full", compact ? "mt-4 max-w-none" : "mt-7 max-w-lg")}>
        {phase === "idle" && (
          <div
            className={cn(
              "orb-word rounded-2xl border bg-surface-elevated/80 p-2 shadow-elevated backdrop-blur-sm transition-colors duration-200",
              dragging ? "border-primary/60" : "border-border-subtle"
            )}
            style={{ animationDelay: "1120ms" }}
          >
            {recording ? (
              <div className="flex items-center gap-3 px-2 py-3">
                <span className="size-2.5 animate-pulse rounded-full bg-destructive" />
                <span className="flex-1 text-sm">
                  {t.recording} · {Math.floor(recorder.seconds / 60)}:
                  {String(recorder.seconds % 60).padStart(2, "0")}
                </span>
                <Button size="sm" variant="ghost" onClick={recorder.cancel}>
                  {t.cancelRecording}
                </Button>
                <Button size="sm" onClick={recorder.stop}>
                  <Square className="size-3.5" />
                  {t.stopRecording}
                </Button>
              </div>
            ) : (
              <>
                {staged.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-1 pb-2 pt-1">
                    {staged.map((file, i) => {
                      const category = describeFile(file.name, file.type).category;
                      const Icon =
                        category === "IMAGE" ? Images : category === "VIDEO" ? Video : category === "AUDIO" ? Music : FileText;
                      const isImage = category === "IMAGE";
                      return (
                        <span
                          key={`${file.name}-${file.lastModified}-${i}`}
                          className="group flex max-w-[12rem] items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-secondary py-1 ps-1.5 pe-1 text-xs"
                        >
                          {isImage ? (
                            <ImageThumb file={file} />
                          ) : (
                            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{file.name}</span>
                          <span className="shrink-0 text-muted-foreground/70">{formatBytes(file.size)}</span>
                          <button
                            type="button"
                            onClick={() => removeStaged(i)}
                            aria-label={t.removeAttachment}
                            title={t.removeAttachment}
                            className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {linkOpen && (
                  <div className="flex items-center gap-1.5 px-1 pb-2">
                    <Input
                      ref={linkFieldRef}
                      value={linkValue}
                      onChange={(e) => setLinkValue(e.target.value)}
                      placeholder={t.linkPlaceholder}
                      className="h-8"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          confirmLink();
                        }
                        if (e.key === "Escape") {
                          setLinkOpen(false);
                          setLinkValue("");
                        }
                      }}
                    />
                    <Button size="sm" onClick={confirmLink} disabled={!linkValue.trim()}>
                      {t.addLink}
                    </Button>
                  </div>
                )}

                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t.inputPlaceholder}
                  rows={compact ? 2 : 3}
                  className="resize-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                />
                <div className="flex items-center gap-1 px-1 pb-0.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label={t.attachFiles} title={t.attachFiles}>
                        <Paperclip className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onSelect={() => photoInput.current?.click()}>
                        <Camera className="size-4" /> {t.attachMenu.photo}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => videoInput.current?.click()}>
                        <Video className="size-4" /> {t.attachMenu.video}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => galleryInput.current?.click()}>
                        <Images className="size-4" /> {t.attachMenu.gallery}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => filesInput.current?.click()}>
                        <FolderOpen className="size-4" /> {t.attachMenu.files}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => recorder.start()}>
                        <Mic className="size-4" /> {t.attachMenu.voice}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setLinkOpen(true)}>
                        <Link2 className="size-4" /> {t.attachMenu.link}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={recorder.start}
                    disabled={recorder.state === "requesting"}
                    aria-label={t.recordVoice}
                    title={t.recordVoice}
                  >
                    <Mic className="size-4" />
                  </Button>
                  <span className="flex-1" />
                  <Button size="sm" disabled={!canSend} onClick={submit}>
                    <CornerDownLeft className="size-3.5" />
                    {t.send}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* One word while it works. The orb is already saying "working" —
            a six-row checklist of our own pipeline stages told the student
            nothing they could use, and turned a wait into a progress log. */}
        {phase === "working" && (
          <p className="orb-emerge py-4 text-center text-sm text-muted-foreground">
            {stage === "reading" ? t.workingReading : t.workingOrganizing}
          </p>
        )}

        {/* The work already ran — this shows what happened, not a form asking
            what to do. The one exception is a question the agent could not
            answer for itself, which comes with a line to answer it on. */}
        {phase === "result" && outcome?.status === "ASKED" && (
          <AgentAsk
            question={outcome.question}
            busy={accepting}
            onAnswer={(answer) => rerun(answer)}
            onSkip={skipQuestion}
          />
        )}

        {phase === "result" && outcome && outcome.status !== "ASKED" && (
          <AgentResult outcome={outcome} busy={accepting} onRetry={() => rerun()} />
        )}
      </div>
    </div>
  );
}
