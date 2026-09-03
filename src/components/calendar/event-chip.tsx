import Link from "next/link";
import type { CalendarEvent } from "@/lib/calendar";

export function EventChip({ event }: { event: CalendarEvent }) {
  return (
    <Link
      href={event.href}
      className="block truncate rounded px-1.5 py-0.5 text-[11px] font-medium hover:opacity-80"
      style={{ backgroundColor: `${event.color}22`, color: event.color }}
      title={event.title}
    >
      {event.title}
    </Link>
  );
}

export const LEGEND: { type: CalendarEvent["type"]; label: string; color: string }[] = [
  { type: "TASK", label: "Deadlines & Exams", color: "#ef4444" },
  { type: "STUDY", label: "Study Sessions", color: "#0ea5e9" },
  { type: "CLINICAL", label: "Clinical Training", color: "#10b981" },
  { type: "REVIEW", label: "Reviews", color: "#8b5cf6" },
];

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {LEGEND.map((l) => (
        <span key={l.type} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
          {l.label}
        </span>
      ))}
    </div>
  );
}
