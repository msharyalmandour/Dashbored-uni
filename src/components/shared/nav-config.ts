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

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Command Center",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard, description: "Today's priorities" },
    ],
  },
  {
    label: "Learn",
    items: [
      { label: "Academic Structure", href: "/academics", icon: GraduationCap, description: "Semesters & subjects" },
      { label: "Knowledge Gaps", href: "/knowledge-gaps", icon: Lightbulb, description: "What you don't understand yet" },
      { label: "Flashcards", href: "/flashcards", icon: Layers, description: "Spaced repetition" },
      { label: "Review", href: "/review", icon: RotateCcw, description: "Scheduled review queue" },
    ],
  },
  {
    label: "Practice",
    items: [
      { label: "Problems", href: "/problems", icon: PencilLine, description: "Practice questions" },
      { label: "Mistake Journal", href: "/mistakes", icon: AlertTriangle, description: "Repeated weaknesses" },
      { label: "Clinical Training", href: "/clinical", icon: Stethoscope, description: "Rotation log" },
      { label: "Video Library", href: "/videos", icon: Video, description: "Watch & connect" },
    ],
  },
  {
    label: "Plan",
    items: [
      { label: "Tasks & Deadlines", href: "/tasks", icon: CheckSquare, description: "Assignments & exams" },
      { label: "Calendar", href: "/calendar", icon: CalendarDays, description: "Everything on one timeline" },
      { label: "Focus Mode", href: "/focus", icon: Timer, description: "Distraction-free study" },
    ],
  },
  {
    label: "Insight",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3, description: "Decisions, not vanity metrics" },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
