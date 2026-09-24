import Link from "next/link";
import { CheckSquare, GraduationCap } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * What is true about TODAY, specifically.
 *
 * This row used to carry four tiles: tasks due, reviews due, unresolved gaps,
 * days to exam. Home now opens with an academic snapshot that states the
 * standing totals — active courses, open tasks, reviews due, things to
 * revisit — and two of these four said the same thing a screen later, at the
 * same size, in the same shape. A student reading "42" twice on one page does
 * not learn it twice; they learn that the page repeats itself.
 *
 * So the row keeps only what the snapshot cannot say, because the snapshot is
 * about the semester and this is about today:
 *
 *   - tasks due TODAY (3), against the snapshot's total open (22)
 *   - days until the next exam, which is a date rather than a count
 *
 * Both link to the module that owns the number, so a figure that looks wrong
 * is one click from the screen that explains it. Both come straight from
 * getDashboardData. Nothing here is synthesised.
 */
export function StatTiles({
  dict,
  tasksDueToday,
  daysToExam,
}: {
  dict: Dictionary;
  tasksDueToday: number;
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
      icon: GraduationCap,
      value: daysToExam ?? "—",
      label: daysToExam === null ? t.noExam : t.daysToExam,
      href: "/calendar",
      accent: examUrgent ? ("urgent" as const) : ("academics" as const),
    },
  ];

  // Held as whole class strings so Tailwind's scanner can see them.
  const ACCENT: Record<string, { tile: string; glow: string }> = {
    planning: {
      tile: "bg-module-planning/15 text-module-planning",
      glow: "group-hover:shadow-[0_0_24px_-6px_var(--color-module-planning)]",
    },
    learn: {
      tile: "bg-module-learn/15 text-module-learn",
      glow: "group-hover:shadow-[0_0_24px_-6px_var(--color-module-learn)]",
    },
    academics: {
      tile: "bg-module-academics/15 text-module-academics",
      glow: "group-hover:shadow-[0_0_24px_-6px_var(--color-module-academics)]",
    },
    urgent: {
      tile: "bg-destructive/15 text-destructive",
      glow: "group-hover:shadow-[0_0_24px_-6px_var(--color-destructive)]",
    },
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((tile) => {
        const a = ACCENT[tile.accent];
        return (
          <Link
            key={tile.label}
            href={tile.href}
            /* On the panel material, and tilting.

               These were a hairline border over a flat fill, which over the
               forest read as four grey rectangles — the exact "ordinary" the
               redesign is answering. They are now the same slab as every other
               surface, and because they are the one thing on the page you
               actually click through, they get the depth response too. */
            className={cn(
              "panel panel-3d group relative flex items-center gap-3 px-3.5 py-3"
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
            {/* Label near the icon, number pushed to the far end.

               Stacked beside the icon, the pair sat against one edge and left
               most of the tile empty — four tiles, each more than half dead
               space, which is what made the row read as unfinished. Spanning
               the full width gives the number somewhere to be big and gives the
               tile a reason to be as wide as it is. */}
            <span className="min-w-0 flex-1 text-[11px] leading-tight text-muted-foreground">
              {tile.label}
            </span>
            {/* Lifted off the face, so when the tile tilts the number moves
                with a parallax of its own instead of being painted on. */}
            <span className="panel-raise-sm shrink-0 font-display text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums">
              {tile.value}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
