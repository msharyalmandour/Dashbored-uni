"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { uploadSlideDirect, type SlideUploadFailure } from "@/lib/upload-direct";

/**
 * Attaching a lecture.
 *
 * This used to hand the whole `File` to a Server Action, which is why it did
 * not work: a Server Action's request body is capped at 2MB by this app's
 * config and 4.5MB by the platform regardless, and a lecture deck is
 * essentially never under either. The request came back 413 with "Body
 * exceeded 2mb limit" before any application code ran, and because the
 * framework — not this app — produced that failure, there was no message to
 * show: the dialog stayed open, the spinner stopped, and nothing said why.
 *
 * The bytes go browser → Storage now (lib/upload-direct.ts), and two things
 * follow from that which matter as much as the fix:
 *
 *   - **The file is checked before it moves.** A PowerPoint is refused in the
 *     browser with an explanation, rather than after a fifteen-megabyte upload.
 *   - **Every failure has a sentence.** A production build withholds whatever a
 *     Server Action throws, so the uploader returns a *reason* rather than a
 *     message and this component renders it in the student's own language.
 */
export function SlideUploadDialog({
  lectureId,
  addLabel,
  dict,
}: {
  lectureId: string;
  addLabel: string;
  dict: {
    title: string;
    titleLabel: string;
    titlePlaceholder: string;
    fileLabel: string;
    hint: string;
    save: string;
    uploading: string;
    tooBig: string;
    notAnnotatable: string;
    uploadFailed: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  const REASONS: Record<SlideUploadFailure, string> = {
    TOO_BIG: dict.tooBig,
    NOT_ANNOTATABLE: dict.notAnnotatable,
    UPLOAD_FAILED: dict.uploadFailed,
  };

  async function run() {
    if (!file) return;
    setSaving(true);
    const result = await uploadSlideDirect({ lectureId, file, title });
    setSaving(false);

    if (!result.ok) {
      // Long enough to read: the PowerPoint explanation is two sentences and
      // tells the student where to go instead, which is useless at four
      // seconds.
      toast.error(REASONS[result.reason], { duration: 8000 });
      return;
    }

    setOpen(false);
    setTitle("");
    setFile(null);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Plus className="size-3.5" /> {addLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>{dict.titleLabel}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={dict.titlePlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.fileLabel}</Label>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40">
              <UploadCloud className="size-5" />
              <span>{file ? file.name : dict.hint}</span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,image/bmp"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <Button onClick={run} disabled={saving || !file}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? dict.uploading : dict.save}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
