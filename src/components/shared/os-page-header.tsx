import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * How a page says what it is.
 *
 * Fifteen pages had hand-rolled this, and seven of them had rolled exactly the
 * same thing: a 24px title, a grey subtitle, and a row of three flat stat
 * tiles. Opened side by side, Review, Flashcards, Mistakes, Problems, Tasks,
 * Clinical and Videos were indistinguishable above the fold — which is a
 * strange thing for seven different places to be.
 *
 * Two changes, and the second is the one that matters.
 *
 * **The title gets the display rank and sits on the environment.** No panel
 * behind it, no card, no border. The first thing on a screen is the thing the
 * screen is about, and it should be sitting in the room rather than inside a
 * box in the room.
 *
 * **The three tiles are replaced by one sentence.** The tiles were real counts
 * — they were never fabricated — but three numbers given equal size and equal
 * weight is a way of saying that none of them is more important than the
 * others, which was never true. "12 cards are due, 30 more this week" is the
 * same information, reads in one glance instead of three, and leaves the width
 * to the content. Where a number genuinely is the point of a page, `Count`
 * lifts it out of the sentence; where it is not, it stays in prose.
 *
 * `actions` is the page's primary action and nothing else. One per screen.
 */
export function OSPageHeader({
  title,
  eyebrow,
  state,
  actions,
  className,
}: {
  title: string;
  /** Where this page sits, when it is inside something — a course, a lecture. */
  eyebrow?: React.ReactNode;
  /** One sentence of true, current state. Replaces the row of stat tiles. */
  state?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="t-label on-env-quiet mb-1.5">{eyebrow}</div>}
        <h1 className="t-display on-env">{title}</h1>
        {state && <p className="t-meta on-env-quiet mt-1.5 max-w-prose">{state}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/**
 * A number inside the state sentence, when that number is the reason the
 * student opened the page.
 *
 * `tabular-nums` because these change as you work and a count that shifts the
 * words around it every time it ticks is a small, constant distraction.
 */
export function Count({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "due" | "calm";
}) {
  return (
    <strong
      className={cn(
        "font-semibold tabular-nums",
        tone === "due" && "text-primary",
        tone === "calm" && "text-muted-foreground",
        tone === "default" && "text-foreground"
      )}
      dir="ltr"
    >
      {children}
    </strong>
  );
}

/**
 * A state sentence with its numbers lifted out of it.
 *
 * `format()` returns a string, which is the right shape for almost everything
 * in the dictionary and the wrong shape here: the whole point of the state
 * line is that one or two numbers in it carry more weight than the words
 * around them, and a string cannot say that. This splits on the same `{name}`
 * placeholders `format()` uses — so the translations stay ordinary translated
 * sentences, with the words in whatever order the language wants them — and
 * wraps each substituted value in `Count`.
 *
 * Splitting rather than interpolating is also what keeps this correct in
 * Arabic: the number is a separate inline element with its own direction, so
 * it cannot drag a following full stop to the wrong end of the line.
 */
export function StateLine({
  template,
  values,
  tones,
}: {
  template: string;
  values: Record<string, string | number>;
  tones?: Record<string, "default" | "due" | "calm">;
}) {
  const parts = template.split(/(\{\w+\})/g);
  return (
    <>
      {parts.map((part, i) => {
        const name = part.match(/^\{(\w+)\}$/)?.[1];
        if (!name || !(name in values)) return <React.Fragment key={i}>{part}</React.Fragment>;
        return (
          <Count key={i} tone={tones?.[name]}>
            {values[name]}
          </Count>
        );
      })}
    </>
  );
}
