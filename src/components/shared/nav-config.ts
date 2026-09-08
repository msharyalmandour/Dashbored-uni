import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  GraduationCap,
  Lightbulb,
  Layers,
  RotateCcw,
  PencilLine,
  AlertTriangle,
  Stethoscope,
  Video,
  CheckSquare,
  CalendarDays,
  Timer,
  BarChart3,
} from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type NavItemKey = keyof Dictionary["nav"]["items"];
export type NavSectionKey = keyof Dictionary["nav"]["sections"];

export interface NavItem {
  key: NavItemKey;
  href: string;
  icon: LucideIcon;
}

export type ModuleAccent = "academics" | "learn" | "clinical" | "planning" | "intelligence";

export interface NavSection {
  key: NavSectionKey;
  items: NavItem[];
  /** Strategic module-identity accent for this section's active state — omitted for Home, which keeps the app's primary color. */
  accent?: ModuleAccent;
}

/**
 * Grouped by what the student is actually doing, not by database table.
 * Every route the app has stays reachable here — the grouping changed, the
 * surface area did not — so "Learn" gathers the practice loop (recall,
 * scheduled review, the gaps feeding it, and focused study) that was
 * previously scattered through a flat list.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    key: "commandCenter",
    items: [{ key: "dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    key: "academics",
    accent: "academics",
    items: [
      { key: "academics", href: "/academics", icon: GraduationCap },
      { key: "calendar", href: "/calendar", icon: CalendarDays },
      { key: "tasks", href: "/tasks", icon: CheckSquare },
    ],
  },
  {
    key: "learn",
    accent: "learn",
    items: [
      { key: "flashcards", href: "/flashcards", icon: Layers },
      { key: "review", href: "/review", icon: RotateCcw },
      { key: "knowledgeGaps", href: "/knowledge-gaps", icon: Lightbulb },
      { key: "problems", href: "/problems", icon: PencilLine },
      { key: "mistakes", href: "/mistakes", icon: AlertTriangle },
      { key: "focus", href: "/focus", icon: Timer },
    ],
  },
  {
    key: "clinical",
    accent: "clinical",
    items: [
      { key: "clinical", href: "/clinical", icon: Stethoscope },
      { key: "videos", href: "/videos", icon: Video },
    ],
  },
  {
    key: "insight",
    accent: "intelligence",
    items: [{ key: "analytics", href: "/analytics", icon: BarChart3 }],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
