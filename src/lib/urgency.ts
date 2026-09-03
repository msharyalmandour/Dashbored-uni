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
export function getUrgency(deadline: Date, now: Date = new Date()): UrgencyInfo {
  const MS = 1000 * 60 * 60 * 24;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const daysLeft = Math.round((end.getTime() - start.getTime()) / MS);

  if (daysLeft < 0)
    return { level: "OVERDUE", label: "Overdue", emoji: "🔴", colorClass: "text-red-500", daysLeft };
  if (daysLeft === 0)
    return { level: "TODAY", label: "Due today", emoji: "🔴", colorClass: "text-red-500", daysLeft };
  if (daysLeft <= 3)
    return {
      level: "SOON",
      label: `Due in ${daysLeft}d`,
      emoji: "🟠",
      colorClass: "text-orange-500",
      daysLeft,
    };
  if (daysLeft <= 7)
    return {
      level: "UPCOMING",
      label: `Due in ${daysLeft}d`,
      emoji: "🟡",
      colorClass: "text-yellow-500",
      daysLeft,
    };
  return { level: "FUTURE", label: `Due in ${daysLeft}d`, emoji: "🟢", colorClass: "text-emerald-500", daysLeft };
}
