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
import { useI18n } from "@/components/shared/i18n-provider";

export interface AttemptProblem {
  id: string;
  question: string;
  correctAnswer: string;
  difficulty: string;
  subjectName: string;
}

const MISTAKE_TYPES: MistakeType[] = [
  "KNOWLEDGE_GAP",
  "MISUNDERSTANDING",
  "MEMORY_ERROR",
  "CARELESS_MISTAKE",
  "QUESTION_MISINTERPRETATION",
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
  const { dict } = useI18n();
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
        outcome === "CORRECT" ? dict.problems.markedCorrect : outcome === "INCORRECT" ? dict.problems.mistakeLogged : dict.problems.askAgainSoon
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
            <DifficultyBadge difficulty={problem.difficulty} dict={dict} />
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium leading-relaxed">{problem.question}</p>

          <div className="space-y-1.5">
            <Label>{dict.problems.yourAnswer}</Label>
            <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={dict.problems.answerPlaceholder} />
          </div>

          {!revealed ? (
            <Button variant="secondary" onClick={() => setRevealed(true)}>
              <Eye className="size-4" /> {dict.problems.revealAnswer}
            </Button>
          ) : (
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{dict.problems.correctAnswer}</p>
              {problem.correctAnswer}
            </div>
          )}

          {revealed && !showMistakeForm && (
            <div className="grid grid-cols-3 gap-2">
              <Button variant="secondary" className="bg-success/10 text-success hover:bg-success/20" onClick={() => submit("CORRECT")} disabled={saving}>
                {dict.problems.correct}
              </Button>
              <Button variant="secondary" className="bg-destructive/10 text-destructive hover:bg-destructive/20" onClick={() => submit("INCORRECT")} disabled={saving}>
                {dict.problems.incorrect}
              </Button>
              <Button variant="secondary" onClick={() => submit("NEEDS_RETRY")} disabled={saving}>
                {dict.problems.retryLater}
              </Button>
            </div>
          )}

          {showMistakeForm && (
            <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3.5">
              <p className="text-xs font-semibold text-destructive">{dict.problems.logMistake}</p>
              <div className="space-y-1.5">
                <Label>{dict.problems.mistakeType}</Label>
                <Select value={mistakeType} onValueChange={(v) => setMistakeType(v as MistakeType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MISTAKE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{dict.status.mistakeType[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{dict.problems.whyWrong}</Label>
                <Textarea value={why} onChange={(e) => setWhy(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.problems.correctConcept}</Label>
                <Textarea value={concept} onChange={(e) => setConcept(e.target.value)} placeholder={dict.problems.optionalField} />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.problems.whatToReview}</Label>
                <Textarea value={toReview} onChange={(e) => setToReview(e.target.value)} placeholder={dict.problems.optionalField} />
              </div>
              <Button onClick={() => submit("INCORRECT")} disabled={saving || !why}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {dict.problems.saveMistake}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
