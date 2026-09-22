"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { LifeBuoy, ArrowRight, Loader2, X, ShieldCheck, Info, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/shared/i18n-provider";
import { saveMyDay, type RescueResult } from "@/app/actions/recovery";

const TIME_CHOICES = [15, 30, 45, 60, 120] as const;
const ENERGY_CHOICES = ["LOW", "NORMAL", "HIGH"] as const;

/**
 * The way back from a day that went wrong.
 *
 * Deliberately never says what was missed. A student opening this already
 * knows the day went badly; counting it back to them is the behaviour of
 * every planner they have already abandoned. The only question here is what
 * the best move is from where they actually are.
 *
 * It asks one thing the system genuinely cannot know — how much time is
 * really left — because the stored timetable does not know the morning
 * disappeared. Energy is optional and skippable.
 */
export function SaveMyDay() {
  const { dict, format, locale } = useI18n();
  const t = dict.rescue;

  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [plan, setPlan] = React.useState<RescueResult | null>(null);
  const [minutes, setMinutes] = React.useState<number | null>(null);
  const [customOpen, setCustomOpen] = React.useState(false);
  const [custom, setCustom] = React.useState("");

  const reset = React.useCallback(() => {
    setPlan(null);
    setMinutes(null);
    setCustomOpen(false);
    setCustom("");
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function run(mins: number | null, energy: (typeof ENERGY_CHOICES)[number] | null) {
    setBusy(true);
    try {
      setPlan(await saveMyDay({ minutes: mins, energy }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.common.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <LifeBuoy className="size-4" />
        <span className="hidden md:inline">{t.trigger}</span>
      </Button>
    );
  }

  const heading =
    plan?.mode === "PROTECT_ONE_THING"
      ? t.protectHeading
      : plan?.mode === "NOTHING_PRESSING"
        ? t.nothingHeading
        : plan
          ? t.canStillWork
          : t.howMuchLeft;

  return (
    <>
      <div
        className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl border border-border-subtle bg-surface-elevated p-4 shadow-elevated sm:bottom-8"
        role="region"
        aria-label={t.trigger}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <LifeBuoy className="size-4 text-primary" />
            {heading}
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={dict.common.close}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {!plan && (
          <>
            <p className="mt-1 text-xs text-muted-foreground">{t.subtitle}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              {TIME_CHOICES.map((choice) => (
                <Button
                  key={choice}
                  size="sm"
                  variant={minutes === choice ? "default" : "outline"}
                  onClick={() => {
                    setMinutes(choice);
                    setCustomOpen(false);
                  }}
                  disabled={busy}
                >
                  {format(t.minutes, { count: choice })}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setCustomOpen(true)} disabled={busy}>
                {t.differentTime}
              </Button>
            </div>

            {customOpen && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={5}
                  max={600}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder={t.minutesPlaceholder}
                  className="h-8"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const value = Number(custom);
                    if (Number.isFinite(value) && value >= 5) setMinutes(Math.round(value));
                    setCustomOpen(false);
                  }}
                >
                  {dict.common.save}
                </Button>
              </div>
            )}

            <p className="mt-4 text-sm font-medium">{t.howEnergy}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ENERGY_CHOICES.map((choice) => (
                <Button
                  key={choice}
                  size="sm"
                  variant="outline"
                  onClick={() => run(minutes, choice)}
                  disabled={busy}
                >
                  {t.energy[choice]}
                </Button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full"
              onClick={() => run(minutes, null)}
              disabled={busy}
            >
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              {t.skipEnergy}
            </Button>
          </>
        )}

        {plan && (
          <div className="mt-2">
            {/* When the day is mostly gone, say so. Pretending the rest can
                still be finished is what makes students stop trusting a
                planner. */}
            {plan.mode === "PROTECT_ONE_THING" && (
              <p className="mb-3 rounded-lg bg-surface-secondary p-2.5 text-xs text-muted-foreground">
                {t.cantDoEverything}
              </p>
            )}

            {plan.primary ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.protectThis}
                </p>
                <p className="mt-1 font-display text-lg font-semibold leading-snug">
                  {plan.primary.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {format(t.minutes, { count: plan.primary.estimatedMinutes })}
                  {plan.primary.subjectName ? ` · ${plan.primary.subjectName}` : ""}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{plan.primary.reason}</p>

                <Button asChild size="sm" className="mt-3 w-full">
                  <Link href={plan.primary.href} onClick={() => setOpen(false)}>
                    {t.start} <ArrowRight className="size-3.5 rtl:rotate-180" />
                  </Link>
                </Button>

                {/* Only shown when the time genuinely allows it. */}
                {plan.secondary && (
                  <p className="mt-2.5 text-xs text-muted-foreground">
                    {format(t.ifTimeRemains, {
                      title: plan.secondary.title,
                      count: plan.secondary.estimatedMinutes,
                    })}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t.nothingBody}</p>
            )}

            {/* What happens to everything else — good news included. */}
            <div className="mt-4 border-t border-border-subtle pt-3">
              {plan.rest.status === "SAFE" && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
                  {t.restSafe}
                </p>
              )}

              {plan.rest.status === "UNKNOWN" && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  {plan.rest.unestimatedCount > 0 ? t.restUnknown : t.restUnknownNoWeek}
                </p>
              )}

              {plan.rest.status === "NEEDS_DECISION" && (
                <>
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-warning" />
                    {format(t.restNeedsDecision, { count: plan.rest.atRisk.length })}
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-0.5">
                    {plan.rest.atRisk.slice(0, 3).map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {new Date(item.deadline).toLocaleDateString(locale, {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {/* The student decides what moves. Nothing is rescheduled
                      on their behalf — and a university deadline is not ours
                      to move in the first place. */}
                  <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                    <Link href="/tasks" onClick={() => setOpen(false)}>
                      {t.decideWhatMoves}
                    </Link>
                  </Button>
                </>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="ghost" className="flex-1" onClick={reset} disabled={busy}>
                {t.lessTime}
              </Button>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 cursor-default bg-transparent"
      />
    </>
  );
}
