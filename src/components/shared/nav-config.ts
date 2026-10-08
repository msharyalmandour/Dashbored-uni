import type { LucideIcon } from "lucide-react";
import {
  GraduationCap,
  Lightbulb,
  Layers,
  Stethoscope,
  CheckSquare,
  CalendarClock,
  Sparkles,
  BookOpen,
} from "lucide-react";
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
   * Flashcards, scheduled review, the gaps and focus are things a student
   * *does* inside studying, not destinations they set out for.
   *
   * These used to sit behind a "More tools" disclosure. The reference design
   * has no disclosure and no caret — one flat column of rows, all the same
   * shape — so the disclosure is gone and these are simply the rows below the
   * rule. They are still marked because Home is meant to carry them (#174),
   * and when it does, this flag is what says which rows can leave.
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
      /* THE ORDER IS THE REFERENCE'S ORDER, and it is a claim about the day.
      
         Home, then the week, then the courses, then the place you actually
         read in, then clinical, then what is due. It runs from "where am I"
         to "what is in front of me" to "what do I owe", which is the order a
         student asks those questions in on opening the app — not the order
         the tables were written in.
      
         The reference lists eight. Two of them, Research and Resources, have
         no route yet, so they are not here: a sidebar row that 404s is worse
         than a missing one, and they arrive with their pages. */
      { key: "home", href: "/", icon: Sparkles },
      /* The weekly schedule. Kept, and nearly removed by mistake: the table
         behind it (TimeCommitment, 11 rows, last touched a month ago) reads
         like an abandoned feature, but the PAGE is the week — `/calendar` was
         retired into it — and a weekly schedule is one of this product's
         required modules. The commitments are its raw material, not its
         purpose. */
      { key: "time", href: "/time", icon: CalendarClock },
      { key: "academics", href: "/academics", icon: GraduationCap },
      { key: "studio", href: "/studio", icon: BookOpen },
      { key: "clinical", href: "/clinical", icon: Stethoscope },
      { key: "tasks", href: "/tasks", icon: CheckSquare },

      /* Below the rule: the practice loop.
      
         THIS LIST WAS FIVE AND IS NOW TWO, and the note it replaces said
         exactly when that was allowed: "they stay in the sidebar until Home
         carries them... removing the rows before Home is ready would strand
         four pages to win a screenshot." Home now carries the day — جرعة
         اليوم names the lectures to study and the pile that is building — so
         the condition is met rather than ignored.
      
         What was measured before each one went, because "nobody uses it" is
         an opinion until it is counted. On this account on 2026-10-08:
      
           review      0 rows. A whole sidebar row for an empty table, beside
                       `flashcards`, which is the same loop with 42 rows. One
                       row now, and `/review` is a button on it.
           focus       10 sessions, 2 of which recorded a single minute. Eight
                       were opened and closed having done nothing, which is
                       what a timer reached from the wrong place looks like.
                       It belongs beside the lecture being studied.
           inbox       17 items, 9 of them FAILED. That is a diagnostic
                       surface, not a destination — a student should be told a
                       file did not land, not go to a page to find out.
      
         Every route still exists and still works. What went is the standing
         claim on the student's attention that a sidebar row makes. */
      { key: "flashcards", href: "/flashcards", icon: Layers, secondary: true },
      { key: "knowledgeGaps", href: "/knowledge-gaps", icon: Lightbulb, secondary: true },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
