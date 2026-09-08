"use client";

import { useChartTheme } from "@/lib/chart-colors";
import { format } from "date-fns";
import { format as formatDict, type Dictionary } from "@/lib/i18n/dictionaries";

function bucket(minutes: number, ramp: string[]) {
  if (minutes <= 0) return null;
  if (minutes < 20) return ramp[1];
  if (minutes < 40) return ramp[2];
  if (minutes < 60) return ramp[3];
  return ramp[4];
}

export function ConsistencyHeatmap({ weeks, dict }: { weeks: { date: string; minutes: number }[][]; dict: Dictionary }) {
  const { sequential, chrome } = useChartTheme();
  const activeDays = weeks.flat().filter((d) => d.minutes > 0).length;
  const totalDays = weeks.flat().length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => {
              const color = bucket(day.minutes, sequential);
              return (
                <div
                  key={day.date}
                  title={`${format(new Date(day.date), "MMM d")} — ${day.minutes} min`}
                  className="size-3.5 rounded-sm"
                  style={{ backgroundColor: color ?? chrome.grid }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {formatDict(dict.analytics.daysActive, { active: activeDays, total: totalDays })}
        </span>
        <span className="flex items-center gap-1">
          {dict.analytics.less}
          {[null, sequential[1], sequential[2], sequential[3], sequential[4]].map((c, i) => (
            <span key={i} className="size-2.5 rounded-sm" style={{ backgroundColor: c ?? chrome.grid }} />
          ))}
          {dict.analytics.more}
        </span>
      </div>
    </div>
  );
}
