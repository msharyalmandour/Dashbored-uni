import Link from "next/link";
import { CheckSquare, RotateCcw, Lightbulb, GraduationCap, ArrowUpRight } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * The "at a glance" row beneath the greeting.
 *
 * These are entry points, not read-only statistics: every tile links to the
 * module that owns the number, so a count that looks wrong is one click from
 * the screen that explains it. Each colour is a real module identity
 * (planning / learn / academics) rather than decoration, and the exam tile
 * additionally turns urgent when the exam is within three days — a genuine
 * signal derived from the data, not a fixed theme.
 *
 * All four numbers come straight from getDashboardData. Nothing here is
 * synthesised.
 */
export function StatTiles({
  dict,
  tasksDueToday,
  reviewsDueToday,
  unresolvedGaps,
  daysToExam,
}: {
  dict: Dictionary;
  tasksDueToday: number;
  reviewsDueToday: number;
  unresolvedGaps: number;
  daysToExam: number | null;
}) {
  const t = dict.dashboard.statTiles;
  const examUrgent = daysToExam !== null && daysToExam <= 3;

  const tiles = [
    {
      icon: CheckSquare,
      value: tasksDueToday,
      label: t.tasksDue,
      href: "/tasks",
      accent: "planning" as const,
    },
    {
      icon: RotateCcw,
      value: reviewsDueToday,
      label: t.reviewsDue,
      href: "/review",
      accent: "learn" as const,
    },
    {
      icon: Lightbulb,
      value: unresolvedGaps,
      label: t.knowledgeGaps,
      href: "/knowledge-gaps",
      accent: "academics" as const,
    },
    {
      icon: GraduationCap,
      value: daysToExam ?? "—",
      label: daysToExam === null ? t.noExam : t.daysToExam,
      href: "/calendar",
      accent: examUrgent ? ("urgent" as const) : ("academics" as const),
    },
  ];

  // Held as whole class strings so Tailwind's scanner can see them.
  const ACCENT: Record<string, { tile: string; ring: string; glow: string }> = {
    planning: {
      tile: "bg-module-planning/15 text-module-planning",
      ring: "hover:border-module-planning/40",
      glow: "group-hover:shadow-[0_0_24px_-6px_var(--color-module-planning)]",
    },
    learn: {
      tile: "bg-module-learn/15 text-module-learn",
      ring: "hover:border-module-learn/40",
      glow: "group-hover:shadow-[0_0_24px_-6px_var(--color-module-learn)]",
    },
    academics: {
      tile: "bg-module-academics/15 text-module-academics",
      ring: "hover:border-module-academics/40",
      glow: "group-hover:shadow-[0_0_24px_-6px_var(--color-module-academics)]",
    },
    urgent: {
      tile: "bg-destructive/15 text-destructive",
      ring: "hover:border-destructive/50",
      glow: "group-hover:shadow-[0_0_24px_-6px_var(--color-destructive)]",
    },
  };

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => {
        const a = ACCENT[tile.accent];
        return (
          <Link
            key={tile.label}
            href={tile.href}
            className={cn(
              "group relative flex items-center gap-3 overflow-hidden rounded-xl border border-border-subtle",
              "bg-surface-elevated/85 px-3.5 py-3 transition-colors duration-200",
              a.ring
            )}
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg transition-shadow duration-200",
                a.tile,
                a.glow
              )}
            >
              <tile.icon className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-2xl font-semibold leading-none tracking-tight">
                {tile.value}
              </span>
              <span className="mt-1 block text-[11px] leading-tight text-muted-foreground">{tile.label}</span>
            </span>
            {/* Hidden on small screens: at two tiles per row there is not
                enough width for both this and a readable label, and the label
                is what carries the meaning. */}
            <ArrowUpRight
              aria-hidden
              className="hidden size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:block"
            />
          </Link>
        );
      })}
    </div>
  );
}
