"use client";

import Link from "next/link";
import { Plus, Timer, Layers, CalendarDays, Stethoscope } from "lucide-react";
import { useQuickCapture } from "@/components/shared/quick-capture-context";
import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * Five real entry points — one dialog trigger (Quick Capture) plus four
 * routes that already exist. Deliberately no AI, scan or "ask" tiles: those
 * appear in the design reference but have no implementation behind them, and
 * a button that goes nowhere is worse than an absent one.
 */
export function QuickActions({ dict }: { dict: Dictionary }) {
  const { setOpen } = useQuickCapture();
  const qa = dict.dashboard.quickActions;

  /* Rows inside one surface, not five surfaces.

     These were five free-standing tiles on `bg-surface-elevated/80` with their
     own border — a sixth card material on a page that already had five, and
     the same shape as the four stat tiles a screen above, which are `.panel`.
     Nine near-identical tiles in two different materials is what "everything
     looks the same but nothing matches" is made of.

     So the card is the object and these are its contents: no border, no fill
     until you point at one. What they are — five ways out of Home — is said by
     the heading, not by each of them being drawn as a thing. */
  const tileClass =
    "flex items-center gap-3 rounded-lg p-3 text-start transition-colors hover:bg-[oklch(100%_0_0_/_5%)]";

  return (
    <Card variant="quiet" className="flex flex-col gap-3 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{qa.title}</h2>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-5">
        <button type="button" onClick={() => setOpen(true)} className={tileClass}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Plus className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{dict.shell.quickCapture}</span>
            <span className="block truncate text-xs text-muted-foreground">{qa.captureSubtitle}</span>
          </span>
        </button>

        <Link href="/focus" className={cn(tileClass)}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-module-planning/15 text-module-planning">
            <Timer className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{dict.nav.items.focus.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{qa.focusSubtitle}</span>
          </span>
        </Link>

        <Link href="/flashcards" className={cn(tileClass)}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-module-learn/15 text-module-learn">
            <Layers className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{dict.nav.items.flashcards.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{qa.flashcardsSubtitle}</span>
          </span>
        </Link>

        <Link href="/clinical" className={cn(tileClass)}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-module-clinical/15 text-module-clinical">
            <Stethoscope className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{dict.nav.items.clinical.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{qa.clinicalSubtitle}</span>
          </span>
        </Link>

        <Link href="/calendar" className={cn(tileClass)}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-module-academics/15 text-module-academics">
            <CalendarDays className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{dict.nav.items.calendar.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{qa.calendarSubtitle}</span>
          </span>
        </Link>
      </div>
    </Card>
  );
}
