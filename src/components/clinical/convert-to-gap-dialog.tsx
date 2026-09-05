"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lightbulb, Loader2 } from "lucide-react";
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
import { createKnowledgeGap } from "@/app/actions/knowledge-gap";

export function ConvertToGapDialog({
  trainingId,
  suggestedTitle,
  subjects,
}: {
  trainingId: string;
  suggestedTitle: string;
  subjects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [subjectId, setSubjectId] = React.useState("");
  const [title, setTitle] = React.useState(suggestedTitle.slice(0, 80));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createKnowledgeGap({
        subjectId,
        clinicalTrainingId: trainingId,
        title,
        description: suggestedTitle,
        difficulty: "MEDIUM",
        source: "CLINICAL_TRAINING",
      });
      toast.success("Knowledge gap created from this rotation");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Lightbulb className="size-3.5" /> Turn into Knowledge Gap
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Turn into Knowledge Gap</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId} required>
              <SelectTrigger><SelectValue placeholder="Which subject is this?" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={saving || !subjectId || !title}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Create Knowledge Gap
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
