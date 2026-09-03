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

export interface ReviewCard {
  id: string;
  front: string;
  back: string;
  difficulty: string;
  subjectName: string;
  subjectColor: string;
}

const GRADE_BUTTONS: { grade: ReviewGrade; label: string; className: string }[] = [
  { grade: "AGAIN", label: "Again", className: "bg-destructive/10 text-destructive hover:bg-destructive/20" },
  { grade: "HARD", label: "Hard", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20" },
  { grade: "GOOD", label: "Good", className: "bg-primary/10 text-primary hover:bg-primary/20" },
  { grade: "EASY", label: "Easy", className: "bg-success/10 text-success hover:bg-success/20" },
];

export function ReviewSession({ cards }: { cards: ReviewCard[] }) {
  const router = useRouter();
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
        <p className="font-medium">Nothing due right now</p>
        <p className="text-sm text-muted-foreground">Spaced repetition is fully caught up.</p>
      </Card>
    );
  }

  if (index >= total) {
    const accuracy = stats.reviewed > 0 ? Math.round((stats.correct / stats.reviewed) * 100) : 0;
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <PartyPopper className="size-10 text-primary" />
        <p className="font-display text-xl font-semibold">Session complete</p>
        <p className="text-sm text-muted-foreground">
          Reviewed {stats.reviewed} card{stats.reviewed === 1 ? "" : "s"} · {accuracy}% correct
        </p>
        <Button
          onClick={() => {
            router.refresh();
          }}
        >
          Done
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-xl">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Card {index + 1} of {total}
          </span>
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
        className="flex min-h-64 w-full max-w-xl flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm transition-transform hover:-translate-y-0.5"
      >
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {flipped ? "Answer" : "Question"}
        </span>
        <p className="text-lg font-medium leading-relaxed">{flipped ? current.back : current.front}</p>
        {!flipped && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <RotateCw className="size-3" /> Tap to reveal
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
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
