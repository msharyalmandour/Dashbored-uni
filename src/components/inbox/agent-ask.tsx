"use client";

import * as React from "react";
import { HelpCircle, CornerDownLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/shared/i18n-provider";

/**
 * The agent's own question, and a line to answer it on.
 *
 * This used to be one hard-coded question with two buttons, because the flow
 * that produced it could only ever be uncertain about one thing: whether to
 * create a course it had recognised. An agent that decides for itself can be
 * uncertain about anything, so the question is its words and the answer is
 * free text — which is also the only shape that works across both languages
 * without the app having to anticipate what would be asked.
 *
 * It is still deliberately not a form. One line in, and the agent goes back to
 * work; there is nowhere here to pick a course or a destination, because doing
 * that filing by hand is the work this feature exists to remove.
 */
export function AgentAsk({
  question,
  busy,
  onAnswer,
  onSkip,
}: {
  question: string;
  busy: boolean;
  onAnswer: (answer: string) => void;
  onSkip: () => void;
}) {
  const { dict } = useI18n();
  const t = dict.inbox;
  const [answer, setAnswer] = React.useState("");

  const trimmed = answer.trim();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed || busy) return;
    onAnswer(trimmed);
  }

  return (
    <div className="orb-emerge mt-4 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-start gap-2 text-sm font-medium">
        <HelpCircle className="mt-0.5 size-4 shrink-0 text-primary" />
        {question}
      </p>
      <form onSubmit={submit} className="flex items-center gap-2">
        <Input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={t.answerPlaceholder}
          disabled={busy}
          autoFocus
          className="h-9"
        />
        <Button type="submit" size="sm" disabled={busy || !trimmed}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CornerDownLeft className="size-3.5" />}
          {t.answerSend}
        </Button>
      </form>
      {/* Answering is optional. Someone who does not want to engage with the
          question should not be stuck with an item that cannot move. */}
      <button
        type="button"
        onClick={onSkip}
        disabled={busy}
        className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
      >
        {t.answerSkip}
      </button>
    </div>
  );
}
