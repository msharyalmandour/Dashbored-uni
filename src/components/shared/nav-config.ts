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
  CalendarClock,
  Timer,
  BarChart3,
  Inbox,
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
/**
 * Four concepts, not twelve destinations.
 *
 * The previous grouping still mirrored the database — a link per table — which
 * left the student deciding which of a dozen tools a thought belonged in
 * before they could act on it. These four answer questions instead: what
 * should I do now, what am I studying, how am I practising it, when is it
 * due. Every existing route is still reachable; nothing was removed, the
 * questions were just put in front of the tables.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    key: "today",
    items: [
      { key: "dashboard", href: "/", icon: LayoutDashboard },
      // Second, not buried: the inbox is where anything dropped waits, so it
      // has to be visible from the same place the student starts their day.
      { key: "inbox", href: "/inbox", icon: Inbox },
      // Sits with Today because it answers a today question — how much time
      // is actually left — rather than being a settings screen.
      { key: "time", href: "/time", icon: CalendarClock },
      { key: "analytics", href: "/analytics", icon: BarChart3 },
    ],
  },
  {
    key: "academics",
    accent: "academics",
    items: [
      { key: "academics", href: "/academics", icon: GraduationCap },
      { key: "clinical", href: "/clinical", icon: Stethoscope },
      { key: "videos", href: "/videos", icon: Video },
    ],
  },
  {
    // The practice loop: recall, the schedule that spaces it, the gaps it
    // exposes, and the work that closes them. These were five separate
    // destinations; they are one activity.
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
    key: "plan",
    accent: "planning",
    items: [
      { key: "calendar", href: "/calendar", icon: CalendarDays },
      { key: "tasks", href: "/tasks", icon: CheckSquare },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
