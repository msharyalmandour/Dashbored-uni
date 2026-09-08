"use client";

import { Check, Loader2, Minus } from "lucide-react";
import { useI18n } from "@/components/shared/i18n-provider";
import { cn } from "@/lib/utils";

export type StepId = "received" | "identifying" | "understanding" | "course" | "dates" | "connecting";
export type StepState = "pending" | "running" | "done" | "empty";

export const INITIAL_STEPS: Record<StepId, StepState> = {
  received: "pending",
  identifying: "pending",
  understanding: "pending",
  course: "pending",
  dates: "pending",
  connecting: "pending",
};

/**
 * What the system is actually doing, shown as it happens.
 *
 * Every line is anchored to something real. `received` lights when the row
 * exists. `identifying` is genuinely known at that moment — the capability
 * registry has already decided what the file is and how far reading it can
 * go. `understanding` runs while the model call is in flight. The last three
 * report what the returned analysis actually contains, so `course` ticks only
 * if a real course was matched and `dates` shows a dash when the content
 * carried no date.
 *
 * A dash is not a failure state and is not styled as one. "I looked and there
 * was nothing" is information; a list that ticks every row regardless is
 * decoration, and worse, it teaches a student to trust rows that mean nothing.
 */
export function UnderstandingSteps({
  states,
  detail,
}: {
  states: Record<StepId, StepState>;
  detail?: Partial<Record<StepId, string>>;
}) {
  const { dict } = useI18n();
  const t = dict.inbox;

  const rows: { id: StepId; label: string }[] = [
    { id: "received", label: t.steps.received },
    { id: "identifying", label: t.steps2.identifying },
    { id: "understanding", label: t.steps2.topic },
    { id: "course", label: t.steps2.course },
    { id: "dates", label: t.steps2.dates },
    { id: "connecting", label: t.steps2.connecting },
  ];

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const state = states[row.id];
        return (
          <li
            key={row.id}
            className={cn(
              "flex items-start gap-2.5 text-sm transition-colors duration-300",
              state === "pending" && "text-muted-foreground/45",
              state === "running" && "text-foreground",
              state === "done" && "text-foreground/80",
              state === "empty" && "text-muted-foreground"
            )}
          >
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
              {state === "done" && <Check className="size-4 text-primary" />}
              {state === "running" && <Loader2 className="size-4 animate-spin text-primary" />}
              {state === "empty" && <Minus className="size-4" />}
              {state === "pending" && <span className="size-1.5 rounded-full bg-current opacity-50" />}
            </span>
            <span className="min-w-0">
              {row.label}
              {detail?.[row.id] && <span className="block text-xs text-muted-foreground">{detail[row.id]}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
