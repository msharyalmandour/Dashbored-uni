"use client";

import { Check, Loader2, Minus } from "lucide-react";
import { useI18n } from "@/components/shared/i18n-provider";
import { cn } from "@/lib/utils";

export type StepId = "received" | "reading" | "understanding" | "connecting" | "placing";
export type StepState = "pending" | "running" | "done" | "empty";

/**
 * What the system is actually doing, shown as it happens.
 *
 * Each line is tied to a real stage, not a timer: "received" lights up when
 * the row exists, "reading" when text is genuinely available (which for a
 * file means extraction has run), "understanding" while the model call is in
 * flight. The last two report what the returned analysis actually contains —
 * so "Finding academic connections" resolves to a tick only when a course was
 * really matched, and to a dash when none was.
 *
 * That distinction is the whole point. A progress list that advances on
 * setTimeout is set dressing; this one is the system telling the truth about
 * where it is, which is the only version worth showing to someone who is
 * about to trust it with their coursework.
 */
export function UnderstandingSteps({
  states,
  detail,
}: {
  states: Record<StepId, StepState>;
  detail?: Partial<Record<StepId, string>>;
}) {
  const { dict } = useI18n();
  const t = dict.inbox.steps;

  const rows: { id: StepId; label: string }[] = [
    { id: "received", label: t.received },
    { id: "reading", label: t.reading },
    { id: "understanding", label: t.understanding },
    { id: "connecting", label: t.connecting },
    { id: "placing", label: t.placing },
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
              {state === "pending" && (
                <span className="size-1.5 rounded-full bg-current opacity-50" />
              )}
            </span>
            <span className="min-w-0">
              {row.label}
              {detail?.[row.id] && (
                <span className="block text-xs text-muted-foreground">{detail[row.id]}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
