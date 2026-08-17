"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function compactMoney(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

const tooltipStyle = {
  background: "rgba(20, 20, 24, 0.95)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 12,
  fontSize: 12,
  color: "#f4f4f5",
};

const formatter = (value: unknown) => {
  const n = Number(value);
  return compactMoney(Number.isFinite(n) ? n : 0);
};

const AXIS_TICK = "#71717a";
const GRID = "#24242a";
const REVENUE = "#fafafa";
const SPEND = "#8b8b92";

export function RevenueTrendChart({
  data,
}: {
  data: { label: string; revenue: number; adSpend: number; orders: number }[];
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: AXIS_TICK, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            tick={{ fill: AXIS_TICK, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => compactMoney(v)}
            width={52}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={formatter}
            labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke={REVENUE}
            strokeWidth={2}
            fill="url(#revFill)"
          />
          <Line
            type="monotone"
            dataKey="adSpend"
            name="Ad spend"
            stroke={SPEND}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChannelComparisonChart({
  data,
}: {
  data: { channel: string; spend: number; revenue: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="channel"
            tick={{ fill: AXIS_TICK, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: AXIS_TICK, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => compactMoney(v)}
            width={52}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={formatter}
            cursor={{ fill: "rgba(255,255,255,0.06)" }}
          />
          <Bar dataKey="spend" name="Ad spend" fill={SPEND} radius={[4, 4, 0, 0]} />
          <Bar dataKey="revenue" name="Revenue" fill={REVENUE} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({
  data,
  colors,
}: {
  data: { name: string; value: number }[];
  colors: string[];
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={formatter} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
