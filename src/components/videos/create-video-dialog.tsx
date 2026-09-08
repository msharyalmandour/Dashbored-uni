"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createVideo } from "@/app/actions/videos";
import { useI18n } from "@/components/shared/i18n-provider";
import type { VideoPlatform } from "@prisma/client";

export function CreateVideoDialog({ subjects }: { subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  const { dict } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [platform, setPlatform] = React.useState<VideoPlatform>("YOUTUBE" as VideoPlatform);
  const [subjectId, setSubjectId] = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createVideo({ title, url, platform, subjectId: subjectId || undefined });
      toast.success(dict.forms.videoAdded);
      setOpen(false);
      setTitle("");
      setUrl("");
      router.refresh();
    } catch {
      toast.error(dict.forms.couldNotSave);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> {dict.videos.newVideo}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.videos.newVideo}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>{dict.common.title}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.videos.url}</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{dict.videos.platform}</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as VideoPlatform)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="YOUTUBE">YouTube</SelectItem>
                  <SelectItem value="VIMEO">Vimeo</SelectItem>
                  <SelectItem value="UNIVERSITY_PORTAL">{dict.forms.universityPortal}</SelectItem>
                  <SelectItem value="OTHER">{dict.forms.other}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.common.subject}</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder={dict.forms.noneOption} /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={saving || !title || !url}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {dict.common.save}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
