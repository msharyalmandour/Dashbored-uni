import { CALENDAR_TYPE_COLOR, CALENDAR_CHIP } from "@/lib/week-palette";
import Link from "next/link";
import type { CalendarEvent } from "@/lib/calendar";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function EventChip({ event }: { event: CalendarEvent }) {
  const chip = CALENDAR_CHIP[event.type];
  return (
    <Link
      href={event.href}
      dir="auto"
      className="block truncate rounded px-1.5 py-0.5 text-[11px] font-medium hover:brightness-125 [unicode-bidi:isolate]"
      /* Opaque, not a tint over whatever happens to be behind. The month view
         sits on the same photograph as everything else, and a 13%-alpha chip
         there is a word on a tree. */
      style={{ backgroundColor: chip.bg, color: chip.ink }}
      title={event.title}
    >
      {event.title}
    </Link>
  );
}

// Classes lead, because for most students most days that is the whole of what
// is on — the other four are what they add on top of it.
export const LEGEND: { type: CalendarEvent["type"]; labelKey: keyof Dictionary["calendar"]["legend"]; color: string }[] = [
  { type: "CLASS", labelKey: "classes", color: CALENDAR_TYPE_COLOR.CLASS },
  { type: "TASK", labelKey: "deadlines", color: CALENDAR_TYPE_COLOR.TASK },
  { type: "STUDY", labelKey: "study", color: CALENDAR_TYPE_COLOR.STUDY },
  { type: "CLINICAL", labelKey: "clinical", color: CALENDAR_TYPE_COLOR.CLINICAL },
  { type: "REVIEW", labelKey: "reviews", color: CALENDAR_TYPE_COLOR.REVIEW },
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
