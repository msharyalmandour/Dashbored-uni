"use client";

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useChartTheme } from "@/lib/chart-colors";
import { NoData } from "@/components/analytics/chart-card";

export function GapTrendsChart({ data }: { data: { label: string; created: number; resolved: number }[] }) {
  const { categorical, chrome } = useChartTheme();
  if (data.every((d) => d.created === 0 && d.resolved === 0)) return <NoData />;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chrome.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: chrome.muted }} axisLine={{ stroke: chrome.grid }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chrome.muted }} axisLine={false} tickLine={false} width={30} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chrome.grid}` }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="created" name="Created" stroke={categorical[0]} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="resolved" name="Resolved" stroke={categorical[5]} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
