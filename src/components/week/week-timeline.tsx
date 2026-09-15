"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { WeekMap, WeekSpan, WeekPoint } from "@/lib/week-map";

/**
 * The week, drawn.
 *
 * Seven columns, one per day, each a strip of real time: a class that runs two
 * hours is twice the block of one that runs one, because that is the fact a
 * student is trying to see. A deadline is a line across the column rather than
 * a block, since crossing it takes no time at all.
 *
 * The grid is CSS grid with percentage offsets inside each day, not absolute
 * pixels, so the same component is a readable week on a phone and a wall chart
 * on a tablet without a second layout.
 */

const SPAN_STYLE: Record<WeekSpan["kind"], { fill: string; glow: string; text: string }> = {
  CLASS: { fill: "linear-gradient(150deg,#4A3BD8,#241682)", glow: "#8E7BFF", text: "#EDEBFF" },
  CLINICAL: { fill: "linear-gradient(150deg,#0E6E5A,#063B30)", glow: "#3FD9AE", text: "#DFFBF3" },
  COMMITMENT: { fill: "linear-gradient(150deg,#26262C,#141418)", glow: "#5A5A66", text: "#C9C9D2" },
};

const POINT_STYLE: Record<WeekPoint["kind"], string> = {
  DEADLINE: "#FFA04D",
  EXAM: "#FF5C5C",
  REVIEW: "#D4FF3D",
};

function clock(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function WeekTimeline({
  map,
  dayNames,
  labels,
}: {
  map: WeekMap;
  /** Seven short day names, already in the reader's language, Saturday first. */
  dayNames: string[];
  labels: { now: string; nothing: string; unplaced: string; noEstimate: string; overdue: string };
}) {
  const { window: win } = map;
  const total = Math.max(1, win.endMinute - win.startMinute);

  /** Where a minute sits down the column, as a percentage of the drawn window. */
  const offset = (minute: number) => ((minute - win.startMinute) / total) * 100;

  // One line per hour, so a block's height reads as a duration instead of a
  // shape. Only whole hours inside the window — a rule at 06:43 helps nobody.
  const hourLines = React.useMemo(() => {
    const out: number[] = [];
    for (let m = Math.ceil(win.startMinute / 60) * 60; m < win.endMinute; m += 60) out.push(m);
    return out;
  }, [win.startMinute, win.endMinute]);

  if (map.empty) {
    return (
      <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-10 text-center">
        <p className="text-sm text-white/55">{labels.nothing}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto pb-1">
        {/* A fixed minimum so seven columns never squeeze into unreadable slivers
            on a phone; the container scrolls sideways instead, which is the one
            place in the app where that is the right answer rather than a bug. */}
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-x-1.5">
            <span />
            {map.days.map((d, i) => (
              <span
                key={d.index}
                className={cn(
                  "pb-2 text-center text-[11.5px] font-semibold",
                  d.isToday ? "text-[#D4FF3D]" : "text-white/45"
                )}
              >
                {dayNames[i]}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-x-1.5">
            {/* The hour rail. */}
            <div className="relative h-[420px]">
              {hourLines.map((m) => (
                <span
                  key={m}
                  className="absolute -translate-y-1/2 text-[10px] tabular-nums text-white/30"
                  style={{ top: `${offset(m)}%` }}
                  dir="ltr"
                >
                  {clock(m)}
                </span>
              ))}
            </div>

            {map.days.map((day, dayIndex) => {
              const spans = map.spans.filter((s) => s.dayIndex === dayIndex);
              const isNowDay = map.now?.dayIndex === dayIndex;

              return (
                <div
                  key={day.index}
                  className={cn(
                    "relative h-[420px] overflow-hidden rounded-2xl",
                    day.isToday ? "bg-white/[0.055]" : "bg-white/[0.022]"
                  )}
                >
                  {hourLines.map((m) => (
                    <span
                      key={m}
                      aria-hidden
                      className="absolute inset-x-0 h-px bg-white/[0.055]"
                      style={{ top: `${offset(m)}%` }}
                    />
                  ))}

                  {spans.map((s) => {
                    const style = SPAN_STYLE[s.kind];
                    const top = offset(s.startMinute);
                    const height = offset(s.endMinute) - top;
                    const widthPct = 100 / s.laneCount;
                    return (
                      <div
                        key={s.id}
                        title={`${s.title} — ${clock(s.startMinute)}–${clock(s.endMinute)}`}
                        className="week-block absolute overflow-hidden rounded-xl px-2 py-1.5"
                        style={{
                          top: `${top}%`,
                          height: `max(${height}%, 22px)`,
                          insetInlineStart: `${s.lane * widthPct}%`,
                          width: `calc(${widthPct}% - 3px)`,
                          background: style.fill,
                          color: style.text,
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,.18), 0 6px 16px -8px ${style.glow}66`,
                        }}
                      >
                        <span className="block truncate text-[11px] font-semibold leading-tight" dir="auto">
                          {s.title}
                        </span>
                        {height > 9 && (
                          <span className="mt-0.5 block text-[9.5px] tabular-nums opacity-70" dir="ltr">
                            {clock(s.startMinute)}–{clock(s.endMinute)}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {isNowDay && map.now && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10"
                      style={{ top: `${offset(map.now.minute)}%` }}
                    >
                      <span className="block h-px w-full bg-[#D4FF3D]" />
                      <span className="absolute -top-[3px] size-[7px] rounded-full bg-[#D4FF3D] shadow-[0_0_10px_#D4FF3D]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Due, rather than happening. Its own row under the grid, on the same
              seven columns, so a deadline still belongs to its day without
              pretending to a position on a clock. */}
          {map.points.length > 0 && (
            <div className="mt-1.5 grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-x-1.5">
              <span />
              {map.days.map((day, dayIndex) => {
                const due = map.points.filter((p) => p.dayIndex === dayIndex);
                return (
                  <div key={day.index} className="flex flex-col gap-1">
                    {due.map((p) => (
                      <span
                        key={p.id}
                        title={p.title}
                        className="flex items-center gap-1 rounded-lg px-1.5 py-1"
                        style={{
                          background: `${POINT_STYLE[p.kind]}1F`,
                          color: POINT_STYLE[p.kind],
                        }}
                      >
                        <span className="size-1.5 shrink-0 rotate-45" style={{ background: "currentColor" }} />
                        <span className="min-w-0 flex-1 truncate text-[9.5px] font-semibold" dir="auto">
                          {p.title}
                        </span>
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {map.unplaced.length > 0 && (
        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-3 text-[12px] font-semibold text-white/70">{labels.unplaced}</p>
          <div className="flex flex-wrap gap-2">
            {map.unplaced.map((u) => (
              <span
                key={u.id}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px]",
                  u.overdue ? "bg-[#FF5C5C]/15 text-[#FF9E9E]" : "bg-white/[0.07] text-white/75"
                )}
              >
                <span dir="auto" className="max-w-[22ch] truncate">{u.title}</span>
                <span className="text-[10.5px] tabular-nums opacity-65" dir="ltr">
                  {u.minutes ? `${u.minutes}m` : labels.noEstimate}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
