"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Paperclip,
  Mic,
  Square,
  CornerDownLeft,
  Info,
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
import { UnderstandingSteps, INITIAL_STEPS, type StepId, type StepState } from "@/components/inbox/understanding-steps";
import { InsightCard } from "@/components/inbox/insight-card";
import { TimetableProposal } from "@/components/inbox/timetable-proposal";
import { useVoiceRecorder } from "@/components/inbox/use-voice-recorder";
import {
  captureText,
  captureFiles,
  requestAnalysis,
  acceptProposal,
  acceptProposedSubject,
  acceptDetectedTimetable,
} from "@/app/actions/capture";
import { describeFile, isBlocked, FILE_ACCEPT_ATTRIBUTE, type FileCapability } from "@/lib/capture-kinds";
import type { CaptureAnalysis } from "@/lib/ai/types";
import type { InboxItem } from "@/lib/inbox";
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
  subjects,
  compact = false,
  onFiled,
}: {
  aiConfigured: boolean;
  subjects: { id: string; name: string }[];
  /** The floating panel is tight on space; the page is not. */
  compact?: boolean;
  onFiled?: () => void;
}) {
  const router = useRouter();
  const { dict, format } = useI18n();
  const t = dict.inbox;

  const [phase, setPhase] = React.useState<Phase>("idle");
  const [dragging, setDragging] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [steps, setSteps] = React.useState(INITIAL_STEPS);
  const [stepDetail, setStepDetail] = React.useState<Partial<Record<StepId, string>>>({});
  const [result, setResult] = React.useState<{ item: InboxItem; analysis: CaptureAnalysis } | null>(null);
  const [accepting, setAccepting] = React.useState(false);
  /** What the last drop was, and how far reading it can go. Shown, not hidden. */
  const [capability, setCapability] = React.useState<{ cap: FileCapability; name: string } | null>(null);

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

  function setStep(id: StepId, state: StepState, detail?: string) {
    setSteps((s) => ({ ...s, [id]: state }));
    if (detail !== undefined) setStepDetail((d) => ({ ...d, [id]: detail }));
  }

  const reset = React.useCallback(() => {
    setPhase("idle");
    setSteps(INITIAL_STEPS);
    setStepDetail({});
    setResult(null);
    setNote("");
    setStaged([]);
    setLinkOpen(false);
    setLinkValue("");
  }, []);

  const run = React.useCallback(
    async (
      create: () => Promise<{ id: string }>,
      kind: "TEXT" | "FILE",
      displayName: string,
      cap: FileCapability | null
    ) => {
      setPhase("working");
      setSteps({ ...INITIAL_STEPS, received: "running" });
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

      // Genuinely known at this point, without asking anything: the capability
      // registry already decided what this is and how far reading it can go.
      const level = cap?.level ?? "TEXT";
      const capabilityNote = !cap
        ? undefined
        : level === "TEXT"
          ? t.capability.text
          : level === "VISION"
            ? t.capability.vision
            : cap.category === "VIDEO"
              ? t.capability.video
              : cap.category === "AUDIO"
                ? t.capability.audio
                : cap.category === "DOCUMENT"
                  ? t.capability.document
                  : t.capability.other;

      setStep("identifying", "done", capabilityNote);

      // Nothing downstream can read inside this, so the run stops here and
      // says why. Storing it is still a real outcome — it is in the Library.
      if (level === "STORED") {
        setStep("understanding", "empty", t.notAnalyzed);
        setStep("course", "empty");
        setStep("dates", "empty");
        setStep("connecting", "empty", t.stepOutcome.noPlacement);
        toast.success(t.dropped);
        window.setTimeout(reset, 4200);
        return;
      }

      if (!aiConfigured) {
        setStep("understanding", "empty", t.aiOffTitle);
        setStep("course", "empty");
        setStep("dates", "empty");
        setStep("connecting", "empty", t.stepOutcome.noPlacement);
        toast.success(t.dropped);
        window.setTimeout(reset, 3000);
        return;
      }

      setStep("understanding", "running");
      const analysis = await requestAnalysis(captureId).catch(() => null);

      if (!analysis?.analysis) {
        setStep("understanding", "empty", analysis?.error ?? t.statusUnprocessed);
        setStep("course", "empty");
        setStep("dates", "empty");
        setStep("connecting", "empty", t.stepOutcome.noPlacement);
        toast.success(t.dropped);
        window.setTimeout(reset, 3600);
        return;
      }

      const a = analysis.analysis;
      setStep("understanding", "done");

      // The last three report what came back, not that something ran.
      const subjectName = subjects.find((s) => s.id === a.subjectId)?.name ?? null;
      if (subjectName) {
        setStep("course", "done", format(t.stepOutcome.connected, { subject: subjectName }));
      } else {
        setStep("course", "empty", t.stepOutcome.noConnections);
      }

      if (a.detectedEvent) {
        setStep("dates", "done", a.detectedEvent.date ?? a.detectedEvent.title);
      } else {
        setStep("dates", "empty");
      }

      setStep("connecting", "done");

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
    [aiConfigured, format, reset, router, subjects, t]
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
      setCapability({ cap, name: first.name });

      const formData = new FormData();
      for (const file of files) formData.append("files", file);
      const name = files.length === 1 ? first.name : format(t.itemCount, { count: files.length });

      await run(
        async () => {
          const created = await captureFiles(formData);
          return created[0];
        },
        "FILE",
        name,
        cap
      );
    },
    [format, run, t]
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
    const preview = content.length > 90 ? `${content.slice(0, 90)}…` : content;
    setCapability(null);
    await run(() => captureText(content), "TEXT", preview, null);
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
   * Say yes to the course the system spotted.
   *
   * This is the day-one path: with no subjects yet, nothing could ever be
   * connected, so the first drop used to end as a saved file and nothing
   * more. Creating the course turns that same drop into the student's world
   * starting to exist.
   */
  async function createProposedSubject() {
    if (!result) return;
    setAccepting(true);
    try {
      const { subjectName } = await acceptProposedSubject(result.item.id);
      toast.success(format(t.courseCreated, { course: subjectName }));
      router.refresh();
      reset();
      onFiled?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.organizeFailed);
    } finally {
      setAccepting(false);
    }
  }

  /**
   * Say yes to the timetable that was read. This is the moment one photo
   * becomes the student's courses and week.
   */
  async function confirmTimetable() {
    if (!result) return;
    setAccepting(true);
    try {
      const { coursesCreated, eventsCreated, skipped } = await acceptDetectedTimetable(result.item.id);
      toast.success(format(t.timetableDone, { courses: coursesCreated || eventsCreated }));
      // Rows that could not be read are reported rather than quietly dropped.
      if (skipped > 0) toast.message(format(t.timetableSkipped, { count: skipped }));
      router.refresh();
      reset();
      onFiled?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.organizeFailed);
    } finally {
      setAccepting(false);
    }
  }

  async function accept() {
    if (!result) return;
    setAccepting(true);
    try {
      await acceptProposal(result.item.id);
      toast.success(t.filed);
      router.refresh();
      reset();
      onFiled?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.organizeFailed);
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

        {phase === "working" && (
          <div className="orb-emerge rounded-2xl border border-border-subtle bg-surface-elevated/90 p-5 shadow-elevated backdrop-blur-sm">
            <UnderstandingSteps states={steps} detail={stepDetail} />

            {/* Said while it is happening, not discovered afterwards. */}
            {capability && capability.cap.level === "STORED" && (
              <p className="mt-4 flex items-start gap-2 rounded-lg border border-border-subtle bg-surface-secondary p-2.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                {t.capability.storedTitle}
              </p>
            )}
          </div>
        )}

        {/* A timetable is not "an item that was filed" — it is the student's
            week. When one was read it leads, and the ordinary insight card
            sits underneath as the fallback. */}
        {phase === "result" && result?.analysis.detectedTimetable && (
          <TimetableProposal
            entries={result.analysis.detectedTimetable.entries}
            busy={accepting}
            onConfirm={confirmTimetable}
          />
        )}

        {phase === "result" && result && !result.analysis.detectedTimetable && (
          <InsightCard
            item={result.item}
            analysis={result.analysis}
            subjectName={subjects.find((s) => s.id === result.analysis.subjectId)?.name ?? null}
            busy={accepting}
            onAccept={accept}
            onCreateSubject={result.analysis.proposedSubjectName ? createProposedSubject : undefined}
            onEdit={() => {
              // Editing happens on the item's own row in the queue, which
              // already has the full form — rather than a second, divergent
              // copy of it inside this card.
              const id = result.item.id;
              reset();
              router.refresh();
              onFiled?.();
              window.setTimeout(
                () => document.getElementById(`capture-${id}`)?.scrollIntoView({ behavior: "smooth" }),
                120
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
