"use client";

import Link from "next/link";
import { Plus, Timer, Layers, CalendarDays } from "lucide-react";
import { useQuickCapture } from "@/components/shared/quick-capture-context";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * Four real entry points — one dialog trigger (Quick Capture) plus three
 * routes that already exist. No AI/scan/"ask" tiles: only functionality
 * this app actually has today.
 */
export function QuickActions({ dict }: { dict: Dictionary }) {
  const { setOpen } = useQuickCapture();
  const qa = dict.dashboard.quickActions;

  const tileClass =
    "hover-elevate flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-elevated/80 p-3 text-start";

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{qa.title}</h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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
    </div>
  );
}
