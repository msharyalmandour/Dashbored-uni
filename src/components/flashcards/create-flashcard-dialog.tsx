"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createQuickCapture } from "@/app/actions/quick-capture";
import { useI18n } from "@/components/shared/i18n-provider";
import type { Difficulty } from "@prisma/client";

export function CreateFlashcardDialog({
  subjects,
  defaultSubjectId,
}: {
  subjects: { id: string; name: string }[];
  defaultSubjectId?: string;
}) {
  const router = useRouter();
  const { dict } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [subjectId, setSubjectId] = React.useState(defaultSubjectId ?? "");
  const [front, setFront] = React.useState("");
  const [back, setBack] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<Difficulty>("MEDIUM" as Difficulty);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createQuickCapture({
        type: "FLASHCARD",
        subjectId,
        fields: { front, back, difficulty },
      });
      toast.success(dict.forms.flashcardCreated);
      setOpen(false);
      setFront("");
      setBack("");
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
        <Button size="sm" variant="secondary">
          <Plus className="size-4" /> {dict.forms.newFlashcard}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.forms.newFlashcard}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>{dict.common.subject}</Label>
            <Select value={subjectId} onValueChange={setSubjectId} required>
              <SelectTrigger><SelectValue placeholder={dict.common.chooseSubject} /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{dict.forms.front}</Label>
            <Textarea value={front} onChange={(e) => setFront(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.forms.back}</Label>
            <Textarea value={back} onChange={(e) => setBack(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.common.difficulty}</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EASY">{dict.common.easy}</SelectItem>
                <SelectItem value="MEDIUM">{dict.common.medium}</SelectItem>
                <SelectItem value="HARD">{dict.common.hard}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={saving || !subjectId || !front || !back}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {dict.common.create}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
