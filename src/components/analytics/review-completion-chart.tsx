"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useChartTheme } from "@/lib/chart-colors";
import { NoData } from "@/components/analytics/chart-card";

export function ReviewCompletionChart({ data }: { data: { label: string; completed: number; overdue: number }[] }) {
  const { status, chrome } = useChartTheme();
  if (data.every((d) => d.completed === 0 && d.overdue === 0)) return <NoData />;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chrome.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: chrome.muted }} axisLine={{ stroke: chrome.grid }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chrome.muted }} axisLine={false} tickLine={false} width={30} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chrome.grid}` }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="completed" name="Completed" fill={status.good} radius={[4, 4, 0, 0]} maxBarSize={20} />
        <Bar dataKey="overdue" name="Overdue" fill={status.critical} radius={[4, 4, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
