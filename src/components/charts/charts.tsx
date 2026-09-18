"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Charts follow one rule set: thin marks, recessive grid, tooltips on hover,
 * a legend whenever there are 2+ series, and text in ink colours (never the
 * series colour). Colours come from the validated dark-surface palette.
 */
const AXIS = { fill: "#94a3b8", fontSize: 11 };
const GRID = "#1e293b";
const TOOLTIP = {
  contentStyle: { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 12 },
  labelStyle: { color: "#e2e8f0" },
  itemStyle: { color: "#cbd5e1" },
};

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

export function TimeSeriesChart({
  data,
  xKey,
  series,
  height = 240,
  ariaLabel,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: SeriesDef[];
  height?: number;
  ariaLabel: string;
}) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS} tickFormatter={(v: string) => String(v).slice(5)} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={16} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip {...TOOLTIP} cursor={{ stroke: "#475569" }} />
          {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }} iconType="plainline" /> : null}
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#0f172a", strokeWidth: 2 }} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  color: string;
}

/** Horizontal bars; each bar carries its entity colour so filtering never repaints survivors. */
export function HorizontalBarChart({
  data,
  ariaLabel,
  labelWidth = 110,
  height,
  valueName = "Jumlah",
}: {
  data: BarDatum[];
  ariaLabel: string;
  labelWidth?: number;
  height?: number;
  valueName?: string;
}) {
  const h = height ?? Math.max(120, data.length * 32 + 24);
  return (
    <div role="img" aria-label={ariaLabel} style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="label" tick={{ ...AXIS, fill: "#cbd5e1" }} width={labelWidth} axisLine={false} tickLine={false} />
          <Tooltip {...TOOLTIP} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
          <Bar dataKey="value" name={valueName} barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false}
            label={{ position: "right", fill: "#cbd5e1", fontSize: 11 }}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Part-to-whole for a handful of categories (3–4). More than that belongs in a bar chart. */
export function DonutChart({
  data,
  ariaLabel,
  height = 240,
}: {
  data: BarDatum[];
  ariaLabel: string;
  height?: number;
}) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip {...TOOLTIP} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }} />
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="#0f172a" strokeWidth={2} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
