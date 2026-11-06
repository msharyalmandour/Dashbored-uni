"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCw, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ContentText } from "@/components/ui/content-text";
import { gradeFlashcardAction } from "@/app/actions/review";
import { previewGrades, returnBucket, type ReviewGrade } from "@/lib/spaced-repetition";
import { pick, pluralForm } from "@/lib/i18n/plural";
import { useI18n } from "@/components/shared/i18n-provider";

export interface ReviewCard {
  id: string;
  front: string;
  back: string;
  difficulty: string;
  subjectName: string;
  subjectColor: string;
  /* The card's own schedule, so each button can say what it would do. Sent
     down with the card rather than fetched per press: the four answers have
     to be on screen BEFORE he chooses, which is the whole point. */
  intervalDays: number;
  easeFactor: number;
  reviewCount: number;
}

/* Fully opaque, with no alpha at all.
   These four are the most-pressed controls in the app and they sit directly on
   the environment photograph. They were `/10` once, which made them invisible;
   raising them to `/85` made them visible and still let fifteen percent of a
   forest through the thing you are about to tap. A button is either a surface
   or it is not, and the one you press hundreds of times a week is not the place
   to spend translucency. */
const GRADE_BUTTONS: { grade: ReviewGrade; labelKey: "again" | "goodHard" | "good" | "easyGrade"; className: string }[] = [
  { grade: "AGAIN", labelKey: "again", className: "bg-destructive text-white hover:brightness-110" },
  { grade: "HARD", labelKey: "goodHard", className: "bg-amber-500 text-black hover:brightness-110" },
  /* `text-black`, not `text-primary-foreground`. MEASURED: the token's
     foreground on the primary fill is 4.24:1 — under the 4.5 floor, on the
     button pressed more than any other control in the app, and it was that
     way before the return dates were added. Black on this orange measures
     the same way the amber and green buttons beside it do. */
  { grade: "GOOD", labelKey: "good", className: "bg-primary text-black hover:brightness-110" },
  { grade: "EASY", labelKey: "easyGrade", className: "bg-success text-black hover:brightness-110" },
];

export function ReviewSession({ cards }: { cards: ReviewCard[] }) {
  const router = useRouter();
  const { dict, format, locale } = useI18n();
  const [index, setIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [stats, setStats] = React.useState({ reviewed: 0, correct: 0 });
  const [grading, setGrading] = React.useState(false);

  const total = cards.length;
  const current = cards[index];

  /* Recomputed when the card changes and not on every render: the clock is
     read inside, so a render a minute later would otherwise shift the dates
     under his hand while he is deciding. */
  const preview = React.useMemo(
    () => (current ? previewGrades(current) : null),
    [current]
  );

  function backLabel(g: ReviewGrade): string {
    if (!preview) return "";
    const bucket = returnBucket(preview[g].intervalDays);
    const f = dict.flashcards;
    if (bucket.unit === "today") return f.backToday;
    if (bucket.unit === "tomorrow") return f.backTomorrow;
    const bag = bucket.unit === "days" ? f.backDays : f.backMonths;
    return pick(bag, pluralForm(locale, bucket.count)).replace("{count}", String(bucket.count));
  }

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

      {/* THE CARD TURNS OVER, it does not swap its text.
      
          Both faces are in the DOM at once and the container rotates; the
          back is pre-rotated 180° so it reads the right way round when it
          arrives. A text swap is the same information and a different
          object — the turn is what says "this is the other side of the card
          you were just looking at" rather than "here is a new card".
      
          `aria-live` on a region holding both faces would read the answer
          out while the question is still showing, so the faces are
          `aria-hidden` by turn and the button's own label carries the state.
          Under prefers-reduced-motion the rotation is instant; see
          globals.css. */}
      <button
        onClick={() => setFlipped((f) => !f)}
        aria-pressed={flipped}
        aria-label={flipped ? dict.flashcards.answer : dict.flashcards.question}
        className="fc-card w-full max-w-xl"
      >
        <span className="fc-inner" data-flipped={flipped}>
          <span className="fc-face panel" aria-hidden={flipped}>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {dict.flashcards.question}
            </span>
            <ContentText as="p" className="text-lg font-medium leading-relaxed">
              {current.front}
            </ContentText>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <RotateCw className="size-3" /> {dict.flashcards.tapToFlip}
            </span>
          </span>
          <span className="fc-face fc-back panel" aria-hidden={!flipped}>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {dict.flashcards.answer}
            </span>
            <ContentText as="p" className="text-lg font-medium leading-relaxed">
              {current.back}
            </ContentText>
          </span>
        </span>
      </button>

      {/* Dimmed until the answer is showing, because grading a card you have not
          looked at is the one thing this screen must not make easy.

          At `opacity-40` the labels measured 2.2:1 against the page — the row
          did not read as "not yet", it read as broken, which is a different
          message entirely. 60% is the first step that clears 3:1 for a disabled
          control on every one of the four fills while still being obviously
          quieter than the live state. `disabled` and `pointer-events-none` are
          what actually prevent the click; the opacity only has to say so. */}
      {/* EACH BUTTON SAYS WHEN THE CARD COMES BACK.
      
          Four buttons with four words on them ask a student to guess what
          the scheduler will do, and he cannot — so he presses the middle one
          every time. The dates come from `previewGrades`, which calls the
          same function the press calls, so the label cannot drift from the
          outcome. Building this is also what exposed that three of the four
          used to produce the identical interval; see
          scripts/verify-grade-preview.ts. */}
      <div className={cn("grid w-full max-w-xl grid-cols-4 gap-2", !flipped && "pointer-events-none opacity-60")}>
        {GRADE_BUTTONS.map((b) => (
          <button
            key={b.grade}
            disabled={!flipped || grading}
            onClick={() => grade(b.grade)}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-sm font-semibold shadow-sm transition-colors",
              b.className
            )}
          >
            <span>{dict.flashcards[b.labelKey]}</span>
            {/* NOT dimmed. At `opacity-80` the return date measured 3.40 on
                the red fill — the half of the button that carries the
                information he is choosing with, printed fainter than the
                word he already knows. */}
            <span className="text-[11px] font-medium">{backLabel(b.grade)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
