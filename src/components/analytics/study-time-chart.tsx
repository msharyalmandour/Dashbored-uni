"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useChartTheme } from "@/lib/chart-colors";
import { NoData } from "@/components/analytics/chart-card";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function StudyTimeChart({ data, dict }: { data: { label: string; minutes: number }[]; dict: Dictionary }) {
  const { sequential, chrome } = useChartTheme();
  const hasData = data.some((d) => d.minutes > 0);

  if (!hasData) return <NoData text={dict.analytics.noFocusSessionsYet} />;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chrome.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: chrome.muted }} axisLine={{ stroke: chrome.grid }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: chrome.muted }} axisLine={false} tickLine={false} width={34} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chrome.grid}` }}
          formatter={(v) => [`${v} ${dict.common.min}`, dict.analytics.studiedTooltip]}
        />
        <Bar dataKey="minutes" fill={sequential[3]} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
