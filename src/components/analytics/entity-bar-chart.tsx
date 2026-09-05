"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from "recharts";
import { useChartTheme } from "@/lib/chart-colors";
import { NoData } from "@/components/analytics/chart-card";

export function EntityBarChart({
  data,
  valueKey = "value",
  suffix = "%",
}: {
  data: { name: string; color: string; [key: string]: string | number }[];
  valueKey?: string;
  suffix?: string;
}) {
  const { chrome } = useChartTheme();

  if (data.length === 0) return <NoData />;

  const height = Math.max(160, data.length * 40);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chrome.grid} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: chrome.muted }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: chrome.text }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${chrome.grid}` }}
          formatter={(v) => [`${v}${suffix}`, ""]}
        />
        <Bar dataKey={valueKey} radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
          <LabelList dataKey={valueKey} position="right" formatter={(v) => `${v}${suffix}`} style={{ fill: chrome.text, fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
