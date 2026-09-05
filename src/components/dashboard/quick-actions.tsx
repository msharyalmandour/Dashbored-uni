import Link from "next/link";
import { Timer, Layers, Stethoscope, CalendarDays, BarChart3 } from "lucide-react";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Accent = "academics" | "clinical" | "planning" | "intelligence";

/**
 * Real, already-shipped destinations only — shortcuts to things this app
 * actually does, not placeholders for AI Assistant / Smart Capture. Each
 * tile reuses the same module-accent language as the sidebar so the
 * connection between "this icon" and "that part of the app" is immediate.
 */
const ACTIONS: { key: keyof Dictionary["nav"]["items"]; href: string; icon: typeof Timer; accent: Accent }[] = [
  { key: "focus", href: "/focus", icon: Timer, accent: "planning" },
  { key: "flashcards", href: "/flashcards", icon: Layers, accent: "academics" },
  { key: "clinical", href: "/clinical", icon: Stethoscope, accent: "clinical" },
  { key: "calendar", href: "/calendar", icon: CalendarDays, accent: "planning" },
  { key: "analytics", href: "/analytics", icon: BarChart3, accent: "intelligence" },
];

const ACCENT_ICON: Record<Accent, string> = {
  academics: "text-module-academics",
  clinical: "text-module-clinical",
  planning: "text-module-planning",
  intelligence: "text-module-intelligence",
};

export function QuickActions({ dict }: { dict: Dictionary }) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
      {ACTIONS.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={cn(
            cardVariants({ variant: "quiet" }),
            "hover-elevate flex flex-col items-center gap-2 px-3 py-4 text-center"
          )}
        >
          <action.icon className={cn("size-5", ACCENT_ICON[action.accent])} />
          <span className="text-xs font-medium">{dict.nav.items[action.key].label}</span>
        </Link>
      ))}
    </div>
  );
}
