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

export interface NavSection {
  key: NavSectionKey;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    key: "commandCenter",
    items: [{ key: "dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    key: "learn",
    items: [
      { key: "academics", href: "/academics", icon: GraduationCap },
      { key: "knowledgeGaps", href: "/knowledge-gaps", icon: Lightbulb },
      { key: "flashcards", href: "/flashcards", icon: Layers },
      { key: "review", href: "/review", icon: RotateCcw },
    ],
  },
  {
    key: "practice",
    items: [
      { key: "problems", href: "/problems", icon: PencilLine },
      { key: "mistakes", href: "/mistakes", icon: AlertTriangle },
      { key: "clinical", href: "/clinical", icon: Stethoscope },
      { key: "videos", href: "/videos", icon: Video },
    ],
  },
  {
    key: "plan",
    items: [
      { key: "tasks", href: "/tasks", icon: CheckSquare },
      { key: "calendar", href: "/calendar", icon: CalendarDays },
      { key: "focus", href: "/focus", icon: Timer },
    ],
  },
  {
    key: "insight",
    items: [{ key: "analytics", href: "/analytics", icon: BarChart3 }],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
