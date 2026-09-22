import type { LucideIcon } from "lucide-react";
import {
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
  Inbox, Sparkles, BookOpen,} from "lucide-react";
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
    // One group, because five items are not four groups. The section label is
    // suppressed when there is only one; see app-shell.
    key: "today",
    items: [
      /* FIVE WORLDS.
         This was fifteen destinations in four labelled groups, which is a
         readable menu of the database and an unreadable map of a student's
         life. It made them decide which of a dozen tools a thought belonged in
         before they could act on it, and it put the two homes next to each
         other so the choice was unavoidable.
         What decides membership here is whether a student would say they are
         "in" it. You are in Studio; you are not in Flashcards, you are using
         them, inside a course, as part of studying something. */
      { key: "home", href: "/", icon: Sparkles },
      { key: "studio", href: "/studio", icon: BookOpen },
      { key: "academics", href: "/academics", icon: GraduationCap },
      { key: "clinical", href: "/clinical", icon: Stethoscope },
      { key: "time", href: "/time", icon: CalendarClock },

      /* Everything else, behind "More tools".
         NOTHING was deleted and nothing became unreachable — that would trade
         one problem for a worse one. Every page below is also linked from Home,
         which is where a student meets it in context: not "Review" as a place
         to visit, but "72 ready to go over again" as a thing to do.
         The disclosure opens itself when one of these is the current page, so
         the sidebar never stops saying where you are. */
      { key: "review", href: "/review", icon: RotateCcw, secondary: true },
      { key: "flashcards", href: "/flashcards", icon: Layers, secondary: true },
      { key: "knowledgeGaps", href: "/knowledge-gaps", icon: Lightbulb, secondary: true },
      { key: "problems", href: "/problems", icon: PencilLine, secondary: true },
      { key: "mistakes", href: "/mistakes", icon: AlertTriangle, secondary: true },
      { key: "focus", href: "/focus", icon: Timer, secondary: true },
      { key: "tasks", href: "/tasks", icon: CheckSquare, secondary: true },
      { key: "calendar", href: "/calendar", icon: CalendarDays, secondary: true },
      { key: "videos", href: "/videos", icon: Video, secondary: true },
      { key: "inbox", href: "/inbox", icon: Inbox, secondary: true },
      { key: "analytics", href: "/analytics", icon: BarChart3, secondary: true },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
