import Link from "next/link";
import type { CalendarEvent } from "@/lib/calendar";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function EventChip({ event }: { event: CalendarEvent }) {
  return (
    <Link
      href={event.href}
      dir="auto"
      className="block truncate rounded px-1.5 py-0.5 text-[11px] font-medium hover:opacity-80 [unicode-bidi:isolate]"
      style={{ backgroundColor: `${event.color}22`, color: event.color }}
      title={event.title}
    >
      {event.title}
    </Link>
  );
}

// Classes lead, because for most students most days that is the whole of what
// is on — the other four are what they add on top of it.
export const LEGEND: { type: CalendarEvent["type"]; labelKey: keyof Dictionary["calendar"]["legend"]; color: string }[] = [
  { type: "CLASS", labelKey: "classes", color: "#D97B28" },
  { type: "TASK", labelKey: "deadlines", color: "#FF5C5C" },
  { type: "STUDY", labelKey: "study", color: "#FFC14D" },
  { type: "CLINICAL", labelKey: "clinical", color: "#B83A54" },
  { type: "REVIEW", labelKey: "reviews", color: "#D4FF3D" },
];

export function CalendarLegend({ dict }: { dict: Dictionary }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {LEGEND.map((l) => (
        <span key={l.type} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
          {dict.calendar.legend[l.labelKey]}
        </span>
      ))}
    </div>
  );
}
