"use client";

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useChartTheme } from "@/lib/chart-colors";
import { NoData } from "@/components/analytics/chart-card";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function StudyProgressChart({ data, dict }: { data: { label: string; percent: number }[]; dict: Dictionary }) {
  const { sequential, chrome } = useChartTheme();
  if (data.every((d) => d.percent === 0)) return <NoData text={dict.analytics.noLecturesCompletedYet} />;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chrome.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: chrome.muted }} axisLine={{ stroke: chrome.grid }} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: chrome.muted }} axisLine={false} tickLine={false} width={38} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chrome.grid}` }}
          formatter={(v) => [`${v}%`, dict.analytics.lecturesCompletedTooltip]}
        />
        <Line type="monotone" dataKey="percent" stroke={sequential[3]} strokeWidth={2} dot={{ r: 3, fill: sequential[3] }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
