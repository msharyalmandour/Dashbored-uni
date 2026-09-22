"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Compass, ArrowRight, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";
import { askWhatToDo, type HelpAnswer } from "@/app/actions/help";
import { cn } from "@/lib/utils";

const TIME_CHOICES = [15, 30, 60] as const;
const ENERGY_CHOICES = ["LOW", "NORMAL", "HIGH"] as const;

/**
 * The way out of being stuck.
 *
 * The audit's hardest failure was that a student with three assignments and
 * an exam opened the app, met fifteen destinations, and had no way to say "I
 * don't know where to start". This is that way: one press, at most two taps,
 * one answer.
 *
 * It asks about time and energy because those are the two things the system
 * genuinely cannot know — a free evening on a timetable is not a free evening
 * when someone is exhausted. Both are skippable, and neither is stored.
 */
export function WhatShouldIDo() {
  const { dict, format } = useI18n();
  const t = dict.help;

  const [open, setOpen] = React.useState(false);
  const [minutes, setMinutes] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [answer, setAnswer] = React.useState<HelpAnswer | null>(null);
  const [answered, setAnswered] = React.useState(false);

  const reset = React.useCallback(() => {
    setMinutes(null);
    setAnswer(null);
    setAnswered(false);
  }, []);

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function ask(mins: number | null, energy: (typeof ENERGY_CHOICES)[number] | null) {
    setBusy(true);
    try {
      const result = await askWhatToDo({ minutes: mins, energy });
      setAnswer(result);
      setAnswered(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.common.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="gap-1.5"
      >
        <Compass className="size-4" />
        <span className="hidden sm:inline">{t.trigger}</span>
      </Button>
    );
  }

  return (
    <>
      {/* Deliberately not a full-screen scrim: this is help, not an
          interruption, and the student's work stays visible behind it. */}
      <div
        className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl border border-border-subtle bg-surface-elevated p-4 shadow-elevated sm:bottom-8"
        role="region"
        aria-label={t.trigger}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold">{answered ? t.startHere : t.howLong}</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={dict.common.close}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {!answered && (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {TIME_CHOICES.map((choice) => (
                <Button
                  key={choice}
                  size="sm"
                  variant={minutes === choice ? "default" : "outline"}
                  onClick={() => setMinutes(choice)}
                  disabled={busy}
                >
                  {format(t.minutesChoice, { count: choice })}
                </Button>
              ))}
            </div>

            <p className="mt-4 text-sm font-medium">{t.howEnergy}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ENERGY_CHOICES.map((choice) => (
                <Button
                  key={choice}
                  size="sm"
                  variant="outline"
                  onClick={() => ask(minutes, choice)}
                  disabled={busy}
                >
                  {t.energy[choice]}
                </Button>
              ))}
            </div>

            {/* Both questions are skippable — being made to answer a form
                before getting help is the problem, not the solution. */}
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full"
              onClick={() => ask(minutes, null)}
              disabled={busy}
            >
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              {t.justTellMe}
            </Button>
          </>
        )}

        {answered && (
          <div className="mt-3">
            {answer ? (
              <>
                <p className="font-display text-lg font-semibold leading-snug">{answer.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {format(t.minutesChoice, { count: answer.minutes })}
                  {answer.subjectName ? ` · ${answer.subjectName}` : ""}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{answer.reason}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Button asChild size="sm" className="flex-1">
                    <Link href={answer.href} onClick={() => setOpen(false)}>
                      {t.start} <ArrowRight className="size-3.5 rtl:rotate-180" />
                    </Link>
                  </Button>
                  {answer.alternatives > 0 && (
                    <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
                      <RotateCcw className="size-3.5" />
                      {t.somethingElse}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              // Nothing outstanding is a real answer, and a good one.
              <p className="text-sm text-muted-foreground">{t.nothingPressing}</p>
            )}
          </div>
        )}
      </div>

      {/* Catches an outside press without darkening or blocking the page. */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={() => setOpen(false)}
        className={cn("fixed inset-0 z-40 cursor-default bg-transparent")}
      />
    </>
  );
}
