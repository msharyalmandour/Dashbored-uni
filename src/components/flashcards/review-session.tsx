"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCw, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { gradeFlashcardAction } from "@/app/actions/review";
import type { ReviewGrade } from "@/lib/spaced-repetition";
import { useI18n } from "@/components/shared/i18n-provider";

export interface ReviewCard {
  id: string;
  front: string;
  back: string;
  difficulty: string;
  subjectName: string;
  subjectColor: string;
}

const GRADE_BUTTONS: { grade: ReviewGrade; labelKey: "again" | "goodHard" | "good" | "easyGrade"; className: string }[] = [
  { grade: "AGAIN", labelKey: "again", className: "bg-destructive/10 text-destructive hover:bg-destructive/20" },
  { grade: "HARD", labelKey: "goodHard", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20" },
  { grade: "GOOD", labelKey: "good", className: "bg-primary/10 text-primary hover:bg-primary/20" },
  { grade: "EASY", labelKey: "easyGrade", className: "bg-success/10 text-success hover:bg-success/20" },
];

export function ReviewSession({ cards }: { cards: ReviewCard[] }) {
  const router = useRouter();
  const { dict, format } = useI18n();
  const [index, setIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [stats, setStats] = React.useState({ reviewed: 0, correct: 0 });
  const [grading, setGrading] = React.useState(false);

  const total = cards.length;
  const current = cards[index];

  async function grade(g: ReviewGrade) {
    if (!current || grading) return;
    setGrading(true);
    const result = await gradeFlashcardAction(current.id, g);
    setStats((s) => ({ reviewed: s.reviewed + 1, correct: s.correct + (result.wasCorrect ? 1 : 0) }));
    setGrading(false);
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  if (total === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-10 text-center">
        <PartyPopper className="size-8 text-primary" />
        <p className="font-medium">{dict.flashcards.nothingDue}</p>
        <p className="text-sm text-muted-foreground">{dict.flashcards.fullyCaughtUpSrs}</p>
      </Card>
    );
  }

  if (index >= total) {
    const accuracy = stats.reviewed > 0 ? Math.round((stats.correct / stats.reviewed) * 100) : 0;
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <PartyPopper className="size-10 text-primary" />
        <p className="font-display text-xl font-semibold">{dict.flashcards.sessionComplete}</p>
        <p className="text-sm text-muted-foreground">
          {stats.reviewed} · {accuracy}% {dict.status.problem.CORRECT}
        </p>
        <Button
          onClick={() => {
            router.refresh();
          }}
        >
          {dict.flashcards.doneReviewing}
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-xl">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{format(dict.flashcards.cardOf, { current: index + 1, total })}</span>
          <span
            className="rounded-full px-2 py-0.5"
            style={{ backgroundColor: `${current.subjectColor}22`, color: current.subjectColor }}
          >
            {current.subjectName}
          </span>
        </div>
        <Progress value={(index / total) * 100} />
      </div>

      <button
        onClick={() => setFlipped((f) => !f)}
        className="hover-elevate flex min-h-64 w-full max-w-xl flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-card"
      >
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {flipped ? dict.flashcards.answer : dict.flashcards.question}
        </span>
        <p className="text-lg font-medium leading-relaxed">{flipped ? current.back : current.front}</p>
        {!flipped && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <RotateCw className="size-3" /> {dict.flashcards.tapToReveal}
          </span>
        )}
      </button>

      <div className={cn("grid w-full max-w-xl grid-cols-4 gap-2", !flipped && "pointer-events-none opacity-40")}>
        {GRADE_BUTTONS.map((b) => (
          <button
            key={b.grade}
            disabled={!flipped || grading}
            onClick={() => grade(b.grade)}
            className={cn("rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", b.className)}
          >
            {dict.flashcards[b.labelKey]}
          </button>
        ))}
      </div>
    </div>
  );
}
