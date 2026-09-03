"use client";

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useChartTheme } from "@/lib/chart-colors";
import { NoData } from "@/components/analytics/chart-card";

export function StudyProgressChart({ data }: { data: { label: string; percent: number }[] }) {
  const { sequential, chrome } = useChartTheme();
  if (data.every((d) => d.percent === 0)) return <NoData text="No lectures completed yet." />;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chrome.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: chrome.muted }} axisLine={{ stroke: chrome.grid }} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: chrome.muted }} axisLine={false} tickLine={false} width={38} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chrome.grid}` }}
          formatter={(v) => [`${v}%`, "Lectures completed"]}
        />
        <Line type="monotone" dataKey="percent" stroke={sequential[3]} strokeWidth={2} dot={{ r: 3, fill: sequential[3] }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
