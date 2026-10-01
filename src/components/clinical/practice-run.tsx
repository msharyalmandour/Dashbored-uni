"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentText } from "@/components/ui/content-text";
import { useI18n } from "@/components/shared/i18n-provider";
import { recordAttempt } from "@/app/actions/procedure";
import { watchSteps, type Step, type StationResult } from "@/lib/ospe";

/**
 * One run through a procedure: tick what you missed.
 *
 * TICK WHAT YOU MISSED, not what you did. A twelve-step checklist where you
 * did eleven things right means eleven taps to record a good run and one to
 * record a bad one — which is the wrong way round, because the good run is the
 * common case and the app should cost nothing when things go well. Missing
 * nothing is the default state and submitting an empty list is a pass.
 *
 * No timer and no percentage. The result comes back as PASS, FAIL_CRITICAL or
 * FAIL_INCOMPLETE from ospe.ts, where an omitted critical step fails the
 * station regardless of the total — so this never renders "11/12" or a
 * percentage bar, because both of those are the wrong answer for a performed
 * exam and would quietly teach the student the wrong model of their own exam.
 */
export function PracticeRun({
  procedureId,
  steps,
  missCounts,
  canPractise,
}: {
  procedureId: string;
  steps: Step[];
  missCounts: Array<[string, number]>;
  canPractise: boolean;
}) {
  const { dict } = useI18n();
  const t = dict.clinical;
  const [missed, setMissed] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [outcome, setOutcome] = React.useState<StationResult | null>(null);

  const counts = React.useMemo(() => new Map(missCounts), [missCounts]);
  const watch = React.useMemo(() => watchSteps(steps, counts), [steps, counts]);

  function toggle(id: string) {
    setMissed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await recordAttempt(procedureId, [...missed]);
      if (!res.ok) {
        toast.error(res.reason === "NEEDS_SUBJECT" ? t.needsSubject : dict.common.somethingWentWrong);
        return;
      }
      setOutcome(res.result);
    } catch {
      toast.error(dict.common.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  }

  function again() {
    setMissed(new Set());
    setOutcome(null);
  }

  if (outcome) {
    return (
      <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[color:var(--border-active)] bg-[color:var(--card)] p-5">
        <div className="flex items-start gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] ${
              outcome === "PASS"
                ? "bg-[color:var(--accent)] text-[color:var(--primary)]"
                : "bg-[color:var(--destructive)]/10 text-[color:var(--destructive)]"
            }`}
          >
            {outcome === "PASS" ? <Check className="size-5" /> : <AlertTriangle className="size-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {outcome === "PASS"
                ? t.resultPass
                : outcome === "FAIL_CRITICAL"
                  ? t.resultFailCritical
                  : t.resultFailIncomplete}
            </p>
            {/* The explanation matters more than the verdict for the critical
                case: "you passed eleven of twelve and still failed" is the
                thing a quiz app would never tell them, and the only reason to
                practise this way at all. */}
            <p className="mt-1 text-xs text-muted-foreground">
              {outcome === "PASS"
                ? t.resultPassHint
                : outcome === "FAIL_CRITICAL"
                  ? t.resultFailCriticalHint
                  : t.resultFailIncompleteHint}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={again} className="self-start gap-1.5">
          <RotateCcw className="size-4" />
          {t.runAgain}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Shown before the run, not after, because it is only useful as a
          warning. Afterwards it is a told-you-so. */}
      {watch.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--primary)]">
            {t.watchOut}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {watch.map((s) => (
              <li key={s.id} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="shrink-0 tabular-nums">{s.order}.</span>
                <ContentText as="span" className="min-w-0">
                  {s.text}
                </ContentText>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="divide-y divide-[color:var(--border)] rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--card)]">
        {steps.map((s) => {
          const isMissed = missed.has(s.id);
          return (
            <li key={s.id}>
              <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  id={`step-${s.id}`}
                  checked={isMissed}
                  disabled={!canPractise}
                  onChange={() => toggle(s.id)}
                  className="mt-0.5 size-4 shrink-0 accent-[color:var(--destructive)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {s.order}.
                    </span>
                    <ContentText
                      as="span"
                      className={`min-w-0 text-sm ${isMissed ? "text-[color:var(--destructive)]" : ""}`}
                    >
                      {s.text}
                    </ContentText>
                  </span>
                  {/* The critical marker is shown always, not only when
                      missed. Knowing which steps end the station before you
                      start is the point of having the flag. */}
                  {s.critical && (
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[color:var(--destructive)]">
                      <AlertTriangle className="size-3" />
                      {t.criticalStep}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={busy || !canPractise}>
          {missed.size === 0 ? t.recordClean : t.recordWithMisses.replace("{count}", String(missed.size))}
        </Button>
        <p className="text-xs text-muted-foreground">{t.tickWhatYouMissed}</p>
      </div>
    </div>
  );
}
