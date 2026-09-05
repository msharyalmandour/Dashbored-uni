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
import type { Difficulty } from "@prisma/client";

export function CreateProblemDialog({
  subjects,
  defaultSubjectId,
}: {
  subjects: { id: string; name: string }[];
  defaultSubjectId?: string;
}) {
  const router = useRouter();
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
      toast.success("Problem added");
      setOpen(false);
      setQuestion("");
      setCorrectAnswer("");
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
        <Button size="sm">
          <Plus className="size-4" /> New Problem
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Practice Problem</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId} required>
              <SelectTrigger><SelectValue placeholder="Choose a subject" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Question</Label>
            <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Correct answer</Label>
            <Textarea value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EASY">Easy</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HARD">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={saving || !subjectId || !question || !correctAnswer}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Create Problem
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
