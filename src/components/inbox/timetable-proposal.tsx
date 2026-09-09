"use client";

import * as React from "react";
import { CalendarRange, Check, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";
import type { CaptureAnalysis } from "@/lib/ai/types";

type Entry = NonNullable<CaptureAnalysis["detectedTimetable"]>["entries"][number];

/**
 * What the system read off a timetable, shown before anything is created.
 *
 * This is the payoff the product is built around — one photo of a schedule
 * and the student's week exists — so the temptation is to just create it all
 * and show a triumphant result. It deliberately does not: creating courses
 * and weekly commitments in someone's account off a single OCR pass is
 * exactly the kind of high-impact write that has to be confirmed. The student
 * sees every row that was read, and only then says yes.
 *
 * Rows are grouped by day because that is how a student holds a timetable in
 * their head, not as a flat list of thirty entries.
 */
export function TimetableProposal({
  entries,
  busy,
  onConfirm,
}: {
  entries: Entry[];
  busy: boolean;
  onConfirm: () => void;
}) {
  const { dict, format } = useI18n();
  const t = dict.inbox;

  const courses = new Set(entries.map((e) => e.courseName.trim().toLowerCase()));

  const byDay = React.useMemo(() => {
    const map = new Map<number, Entry[]>();
    for (const entry of entries) {
      const list = map.get(entry.weekday) ?? [];
      list.push(entry);
      map.set(entry.weekday, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [entries]);

  return (
    <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <CalendarRange className="size-4 text-primary" />
        {t.timetableFound}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {format(t.timetableSummary, { courses: courses.size, classes: entries.length })}
      </p>

      <div className="mt-3 flex max-h-64 flex-col gap-3 overflow-y-auto">
        {byDay.map(([weekday, dayEntries]) => (
          <div key={weekday}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {dict.time.weekdays[weekday]}
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {dayEntries.map((entry, i) => (
                <li
                  key={`${entry.courseName}-${entry.startTime}-${i}`}
                  className="flex items-center gap-2 rounded-lg bg-surface-secondary px-2.5 py-1.5 text-xs"
                >
                  <span className="shrink-0 font-mono text-muted-foreground">
                    {entry.startTime}–{entry.endTime}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{entry.courseName}</span>
                  {entry.location && (
                    <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                      <MapPin className="size-3" />
                      {entry.location}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Button className="mt-3 w-full" onClick={onConfirm} disabled={busy}>
        <Check className="size-4" />
        {busy ? t.filing : t.timetableConfirm}
      </Button>
      <p className="mt-1.5 text-center text-xs text-muted-foreground">{t.timetableNote}</p>
    </div>
  );
}
