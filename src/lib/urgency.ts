import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/dictionaries";

export type UrgencyLevel = "OVERDUE" | "TODAY" | "SOON" | "UPCOMING" | "FUTURE";

export interface UrgencyInfo {
  level: UrgencyLevel;
  label: string;
  emoji: string;
  colorClass: string;
  daysLeft: number;
}

/**
 * Automatic urgency logic:
 * overdue -> due today -> due within 3 days -> due within 7 days -> future
 */
export function getUrgency(deadline: Date, now: Date = new Date(), dict?: Dictionary): UrgencyInfo {
  const MS = 1000 * 60 * 60 * 24;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const daysLeft = Math.round((end.getTime() - start.getTime()) / MS);

  const dueInDays = (d: number) => (dict ? format(dict.common.dueInDays, { days: d }) : `Due in ${d}d`);

  if (daysLeft < 0)
    return {
      level: "OVERDUE",
      label: dict?.common.overdueLabel ?? "Overdue",
      emoji: "🔴",
      colorClass: "text-red-500",
      daysLeft,
    };
  if (daysLeft === 0)
    return {
      level: "TODAY",
      label: dict?.common.dueTodayLabel ?? "Due today",
      emoji: "🔴",
      colorClass: "text-red-500",
      daysLeft,
    };
  if (daysLeft <= 3)
    return {
      level: "SOON",
      label: dueInDays(daysLeft),
      emoji: "🟠",
      colorClass: "text-orange-500",
      daysLeft,
    };
  if (daysLeft <= 7)
    return {
      level: "UPCOMING",
      label: dueInDays(daysLeft),
      emoji: "🟡",
      colorClass: "text-yellow-500",
      daysLeft,
    };
  return { level: "FUTURE", label: dueInDays(daysLeft), emoji: "🟢", colorClass: "text-emerald-500", daysLeft };
}
