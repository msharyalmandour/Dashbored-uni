"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DifficultyBadge } from "@/components/shared/status-badges";
import { submitProblemAttempt } from "@/app/actions/problems";
import type { MistakeType } from "@prisma/client";

export interface AttemptProblem {
  id: string;
  question: string;
  correctAnswer: string;
  difficulty: string;
  subjectName: string;
}

const MISTAKE_TYPES: { value: MistakeType; label: string }[] = [
  { value: "KNOWLEDGE_GAP", label: "Knowledge Gap" },
  { value: "MISUNDERSTANDING", label: "Misunderstanding" },
  { value: "MEMORY_ERROR", label: "Memory Error" },
  { value: "CARELESS_MISTAKE", label: "Careless Mistake" },
  { value: "QUESTION_MISINTERPRETATION", label: "Misread the Question" },
];

export function ProblemAttemptDialog({
  problem,
  open,
  onOpenChange,
}: {
  problem: AttemptProblem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [answer, setAnswer] = React.useState("");
  const [revealed, setRevealed] = React.useState(false);
  const [showMistakeForm, setShowMistakeForm] = React.useState(false);
  const [mistakeType, setMistakeType] = React.useState<MistakeType>("MISUNDERSTANDING" as MistakeType);
  const [why, setWhy] = React.useState("");
  const [concept, setConcept] = React.useState("");
  const [toReview, setToReview] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  if (!problem) return null;

  async function submit(outcome: "CORRECT" | "INCORRECT" | "NEEDS_RETRY") {
    if (!problem) return;
    if (outcome === "INCORRECT" && !showMistakeForm) {
      setShowMistakeForm(true);
      return;
    }
    setSaving(true);
    try {
      await submitProblemAttempt({
        problemId: problem.id,
        userAnswer: answer,
        outcome,
        mistake:
          outcome === "INCORRECT"
            ? { mistakeType, whyIGotItWrong: why, correctConcept: concept, whatIShouldReview: toReview }
            : undefined,
      });
      toast.success(
        outcome === "CORRECT" ? "Nice — marked correct" : outcome === "INCORRECT" ? "Mistake logged" : "We'll ask again soon"
      );
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {problem.subjectName}
            <DifficultyBadge difficulty={problem.difficulty} />
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium leading-relaxed">{problem.question}</p>

          <div className="space-y-1.5">
            <Label>Your answer</Label>
            <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer…" />
          </div>

          {!revealed ? (
            <Button variant="secondary" onClick={() => setRevealed(true)}>
              <Eye className="size-4" /> Reveal Answer
            </Button>
          ) : (
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Correct answer</p>
              {problem.correctAnswer}
            </div>
          )}

          {revealed && !showMistakeForm && (
            <div className="grid grid-cols-3 gap-2">
              <Button variant="secondary" className="bg-success/10 text-success hover:bg-success/20" onClick={() => submit("CORRECT")} disabled={saving}>
                Correct
              </Button>
              <Button variant="secondary" className="bg-destructive/10 text-destructive hover:bg-destructive/20" onClick={() => submit("INCORRECT")} disabled={saving}>
                Incorrect
              </Button>
              <Button variant="secondary" onClick={() => submit("NEEDS_RETRY")} disabled={saving}>
                Retry Later
              </Button>
            </div>
          )}

          {showMistakeForm && (
            <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3.5">
              <p className="text-xs font-semibold text-destructive">Log the mistake</p>
              <div className="space-y-1.5">
                <Label>Mistake type</Label>
                <Select value={mistakeType} onValueChange={(v) => setMistakeType(v as MistakeType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MISTAKE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Why did you get it wrong?</Label>
                <Textarea value={why} onChange={(e) => setWhy(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Correct concept</Label>
                <Textarea value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label>What should you review?</Label>
                <Textarea value={toReview} onChange={(e) => setToReview(e.target.value)} placeholder="Optional" />
              </div>
              <Button onClick={() => submit("INCORRECT")} disabled={saving || !why}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save Mistake
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
