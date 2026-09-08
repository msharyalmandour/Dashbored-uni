"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Loader2, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/shared/i18n-provider";
import { captureText, captureFiles, requestAnalysis } from "@/app/actions/capture";
import { cn } from "@/lib/utils";

/**
 * "Drop anything here."
 *
 * One surface that accepts every way a student already has of getting
 * something out of their head and into the app: dragging a file onto the page,
 * pasting a screenshot straight from the clipboard, picking a file, or just
 * typing. All four end in the same place — a row in the inbox — because
 * deciding *what* the thing is comes later, and asking first is the friction
 * this replaces.
 *
 * Paste is bound to the window rather than the textarea. A student who has
 * just taken a screenshot arrives with it on the clipboard and no idea which
 * element they are supposed to click first; requiring focus would make the
 * fastest input the least discoverable one.
 */
export function DropZone({ aiConfigured }: { aiConfigured: boolean }) {
  const router = useRouter();
  const { dict } = useI18n();
  const t = dict.inbox;

  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");
  const fileInput = React.useRef<HTMLInputElement>(null);

  /**
   * Analysis runs after the row exists, not before it. The drop is already
   * saved by the time this starts, so a slow or failing provider costs the
   * student nothing — worst case the item sits in the inbox unanalysed, which
   * is exactly what it does when no provider is configured at all.
   */
  const analyzeInBackground = React.useCallback(
    async (ids: { id: string }[]) => {
      if (!aiConfigured) return;
      await Promise.allSettled(ids.map(({ id }) => requestAnalysis(id)));
      router.refresh();
    },
    [aiConfigured, router]
  );

  const submitFiles = React.useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setBusy(true);
      try {
        const formData = new FormData();
        for (const file of files) formData.append("files", file);
        const created = await captureFiles(formData);
        toast.success(t.dropped);
        router.refresh();
        void analyzeInBackground(created);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.dropFailed);
      } finally {
        setBusy(false);
      }
    },
    [analyzeInBackground, router, t.dropFailed, t.dropped]
  );

  async function submitNote() {
    const content = note.trim();
    if (!content) return;
    setBusy(true);
    try {
      const created = await captureText(content);
      setNote("");
      toast.success(t.dropped);
      router.refresh();
      void analyzeInBackground([created]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.dropFailed);
    } finally {
      setBusy(false);
    }
  }

  // Window-level paste. Ignored when the clipboard carries no file, so pasting
  // text into the note box still behaves like pasting text.
  React.useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      void submitFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [submitFiles]);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void submitFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "rounded-2xl border-2 border-dashed p-6 transition-colors duration-200 sm:p-8",
        dragging ? "border-primary bg-primary/5" : "border-border-subtle bg-surface-secondary"
      )}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary/12 text-primary">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
        </span>
        <h2 className="font-display text-xl font-semibold tracking-tight">{t.dropHeading}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t.dropHint}</p>

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
        <Button className="mt-2" disabled={busy} onClick={() => fileInput.current?.click()}>
          {t.dropCta}
        </Button>
        <p className="text-xs text-muted-foreground">{t.pasteHint}</p>
      </div>

      <div className="mt-6">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.textPlaceholder}
          rows={3}
          className="resize-none bg-surface-primary"
          onKeyDown={(e) => {
            // Cmd/Ctrl+Enter submits. Plain Enter stays a newline: a captured
            // thought is often more than one line, and losing the rest of it
            // to an over-eager shortcut would defeat the point.
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void submitNote();
            }
          }}
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="outline" disabled={busy || note.trim().length === 0} onClick={submitNote}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CornerDownLeft className="size-3.5" />}
            {busy ? t.dropping : t.saveNote}
          </Button>
        </div>
      </div>
    </div>
  );
}
