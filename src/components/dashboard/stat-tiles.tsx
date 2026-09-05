import { CheckSquare, RotateCcw, Lightbulb, GraduationCap } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * Four compact, colored icon tiles — the "at a glance" row beneath the
 * greeting. Each color is a real module identity (planning/learn/academics),
 * not decoration: the fourth tile additionally turns urgent (destructive)
 * when an exam is within three days, since that's a real signal, not a
 * fixed theme. All four numbers come straight from getDashboardData.
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
    { icon: CheckSquare, value: tasksDueToday, label: t.tasksDue, accent: "module-planning" as const },
    { icon: RotateCcw, value: reviewsDueToday, label: t.reviewsDue, accent: "module-learn" as const },
    { icon: Lightbulb, value: unresolvedGaps, label: t.knowledgeGaps, accent: "module-academics" as const },
    {
      icon: GraduationCap,
      value: daysToExam ?? "—",
      label: daysToExam === null ? t.noExam : t.daysToExam,
      accent: examUrgent ? ("destructive" as const) : ("module-academics" as const),
    },
  ];

  const ACCENT_CLASS: Record<string, string> = {
    "module-planning": "bg-module-planning/15 text-module-planning",
    "module-learn": "bg-module-learn/15 text-module-learn",
    "module-academics": "bg-module-academics/15 text-module-academics",
    destructive: "bg-destructive/15 text-destructive",
  };

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface-elevated/80 px-3 py-2.5"
        >
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", ACCENT_CLASS[tile.accent])}>
            <tile.icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold leading-none">{tile.value}</p>
            <p className="truncate text-[11px] text-muted-foreground">{tile.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
