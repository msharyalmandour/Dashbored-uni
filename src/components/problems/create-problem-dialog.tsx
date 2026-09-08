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
import { createProblem } from "@/app/actions/problems";
import { useI18n } from "@/components/shared/i18n-provider";
import type { Difficulty } from "@prisma/client";

export function CreateProblemDialog({
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
  const [question, setQuestion] = React.useState("");
  const [correctAnswer, setCorrectAnswer] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<Difficulty>("MEDIUM" as Difficulty);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createProblem({ subjectId, question, correctAnswer, difficulty });
      toast.success(dict.forms.problemAdded);
      setOpen(false);
      setQuestion("");
      setCorrectAnswer("");
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
          <Plus className="size-4" /> {dict.problems.newProblem}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.forms.newProblemTitle}</DialogTitle>
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
            <Label>{dict.forms.question}</Label>
            <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.problems.correctAnswer}</Label>
            <Textarea value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} required />
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
          <Button type="submit" disabled={saving || !subjectId || !question || !correctAnswer}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {dict.common.create}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
