"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from "recharts";
import { useChartTheme } from "@/lib/chart-colors";
import { NoData } from "@/components/analytics/chart-card";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function RepeatedMistakesChart({ data, dict }: { data: { name: string; count: number }[]; dict: Dictionary }) {
  const { sequential, chrome } = useChartTheme();
  if (data.length === 0) return <NoData text={dict.analytics.noOpenMistakes} />;

  const height = Math.max(160, data.length * 36);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chrome.grid} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: chrome.muted }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: chrome.text }} axisLine={false} tickLine={false} width={110} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chrome.grid}` }} formatter={(v) => [v, dict.analytics.mistakesTooltip]} />
        <Bar dataKey="count" fill={sequential[3]} radius={[0, 4, 4, 0]} maxBarSize={18}>
          <LabelList dataKey="count" position="right" style={{ fill: chrome.text, fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
