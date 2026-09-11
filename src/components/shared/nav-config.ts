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
  Inbox, Sparkles,} from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type NavItemKey = keyof Dictionary["nav"]["items"];
export type NavSectionKey = keyof Dictionary["nav"]["sections"];

export interface NavItem {
  key: NavItemKey;
  href: string;
  icon: LucideIcon;
  /**
   * A tool rather than a place.
   *
   * Flashcards, practice questions and the mistake log are things a student
   * *does* inside studying, not destinations they set out for — and listing
   * all of them made the sidebar a menu of our data model. Secondary items
   * stay fully reachable behind a disclosure; nothing was removed.
   */
  secondary?: boolean;
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
    // Where the day starts: what's happening, the one way in, and the honest
    // picture of the time there is.
    key: "today",
    items: [
      { key: "home", href: "/", icon: Sparkles },
      // The detailed picture of the day. Home is the question and the orb;
      // this is everything behind it, and both are worth their own entry
      // because they answer questions asked at different rates.
      { key: "dashboard", href: "/today", icon: LayoutDashboard },
      { key: "inbox", href: "/inbox", icon: Inbox },
      { key: "time", href: "/time", icon: CalendarClock },
    ],
  },
  {
    // Studying is one activity, so it is one section. Courses and the review
    // queue lead; the five tools that serve them are reachable but do not
    // each claim a line in the sidebar.
    key: "learn",
    accent: "learn",
    items: [
      { key: "academics", href: "/academics", icon: GraduationCap },
      { key: "review", href: "/review", icon: RotateCcw },
      { key: "flashcards", href: "/flashcards", icon: Layers, secondary: true },
      { key: "knowledgeGaps", href: "/knowledge-gaps", icon: Lightbulb, secondary: true },
      { key: "problems", href: "/problems", icon: PencilLine, secondary: true },
      { key: "mistakes", href: "/mistakes", icon: AlertTriangle, secondary: true },
      { key: "focus", href: "/focus", icon: Timer, secondary: true },
    ],
  },
  {
    key: "clinical",
    accent: "clinical",
    items: [
      { key: "clinical", href: "/clinical", icon: Stethoscope },
      { key: "videos", href: "/videos", icon: Video, secondary: true },
    ],
  },
  {
    key: "plan",
    accent: "planning",
    items: [
      { key: "calendar", href: "/calendar", icon: CalendarDays },
      { key: "tasks", href: "/tasks", icon: CheckSquare },
      { key: "analytics", href: "/analytics", icon: BarChart3, secondary: true },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
