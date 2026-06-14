"use client";

/**
 * Recharts-based visualizations for the Costs dashboard, co-located with the
 * page. Each chart is wrapped in a {@link ResponsiveContainer} and themed with
 * the shared `--chart-*` / `--border` / `--muted-foreground` CSS variables so it
 * tracks light/dark mode automatically.
 *
 * @module
 */

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatUsd } from "@/lib/utils";

import type { CostSummary } from "@/lib/api-types";

/** The HSL channel triplet for a given chart color slot (1–5), wrapped in hsl(). */
function chartColor(slot: number): string {
  return `hsl(var(--chart-${slot}))`;
}

/** Format a `YYYY-MM-DD` day key as a compact axis label, e.g. `Jun 3`. */
function dayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Shared compact currency formatter for axis ticks (e.g. `$1.2k`). */
function axisUsd(value: number): string {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

/** A themed tooltip card shared by both charts. */
function ChartTooltip({
  active,
  label,
  value,
}: {
  active?: boolean;
  label: string;
  value: number;
}): React.JSX.Element | null {
  if (!active) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{label}</p>
      <p className="mt-0.5 text-muted-foreground">
        <span className="font-semibold text-foreground">
          {formatUsd(value)}
        </span>
      </p>
    </div>
  );
}

const AXIS_PROPS = {
  stroke: "hsl(var(--muted-foreground))",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

/** An area chart of estimated spend per UTC day for the current month. */
export function CostOverTimeChart({
  data,
}: {
  data: CostSummary["byDay"];
}): React.JSX.Element {
  const points = data.map((d) => ({
    date: d.date,
    label: dayLabel(d.date),
    usd: d.estimatedUsd,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart
        data={points}
        margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
      >
        <defs>
          <linearGradient id="costArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor(1)} stopOpacity={0.35} />
            <stop offset="100%" stopColor={chartColor(1)} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={16} />
        <YAxis {...AXIS_PROPS} width={48} tickFormatter={axisUsd} />
        <Tooltip
          cursor={{ stroke: "hsl(var(--border))" }}
          content={({ active, payload }) => (
            <ChartTooltip
              active={active}
              label={
                (payload?.[0]?.payload as { label?: string } | undefined)
                  ?.label ?? ""
              }
              value={Number(payload?.[0]?.value ?? 0)}
            />
          )}
        />
        <Area
          type="monotone"
          dataKey="usd"
          stroke={chartColor(1)}
          strokeWidth={2}
          fill="url(#costArea)"
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** A horizontal bar chart of estimated spend per project (top N). */
export function CostByProjectChart({
  data,
}: {
  data: CostSummary["byProject"];
}): React.JSX.Element {
  const points = data.slice(0, 8).map((p) => ({
    name: p.projectName,
    usd: p.estimatedUsd,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, points.length * 40)}>
      <BarChart
        data={points}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          horizontal={false}
        />
        <XAxis type="number" {...AXIS_PROPS} tickFormatter={axisUsd} />
        <YAxis
          type="category"
          dataKey="name"
          {...AXIS_PROPS}
          width={120}
          tickFormatter={(v: string) =>
            v.length > 18 ? `${v.slice(0, 17)}…` : v
          }
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
          content={({ active, payload }) => (
            <ChartTooltip
              active={active}
              label={
                (payload?.[0]?.payload as { name?: string } | undefined)
                  ?.name ?? ""
              }
              value={Number(payload?.[0]?.value ?? 0)}
            />
          )}
        />
        <Bar dataKey="usd" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {points.map((_, i) => (
            <Cell key={i} fill={chartColor((i % 5) + 1)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
