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
import { uploadSlide } from "@/app/actions/slides";

export function SlideUploadDialog({ lectureId, addLabel, dict }: { lectureId: string; addLabel: string; dict: { title: string; titleLabel: string; fileLabel: string; hint: string; save: string } }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  async function run() {
    if (!file) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("title", title);
      await uploadSlide(lectureId, formData);
      setOpen(false);
      setTitle("");
      setFile(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
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
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lecture 4 — slides" />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.fileLabel}</Label>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40">
              <UploadCloud className="size-5" />
              <span>{file ? file.name : dict.hint}</span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <Button onClick={run} disabled={saving || !file}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {dict.save}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
