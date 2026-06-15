"use client";

import {
  Activity,
  CircleDollarSign,
  Folder,
  TrendingUp,
  Users,
} from "lucide-react";
import * as React from "react";

import { AreaChart, HBars, StatCard } from "@/components/sy";
import { useCostSummary } from "@/lib/hooks";
import { absoluteTime } from "@/lib/time";
import { formatUsd } from "@/lib/utils";

import type { CostSummary } from "@/lib/api-types";

/**
 * Format a `YYYY-MM-DD` day key as a compact `Mon D` axis label (e.g. `Jun 3`).
 * The {@link AreaChart} strips a leading `Jun ` to render just the day number,
 * matching the design's terse axis.
 */
function dayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** A single per-team budget row with a usage bar and healthy/over caption. */
function TeamBudget({
  team,
}: {
  team: CostSummary["teams"][number];
}): React.JSX.Element {
  const frac = team.budgetUsedFraction ?? 0;
  const pct = Math.min(100, Math.max(0, frac * 100));
  const remaining =
    team.budgetUsdMonthly != null
      ? Math.max(0, team.budgetUsdMonthly - team.spendUsd)
      : null;

  return (
    <div className="bud" style={{ marginBottom: 16 }}>
      <div className="bud-head">
        <span className="bud-name">{team.teamName}</span>
        <span className="bud-val">
          <b>{formatUsd(team.spendUsd)}</b>
          {team.budgetUsdMonthly != null
            ? ` / ${formatUsd(team.budgetUsdMonthly)}`
            : " (no budget)"}
        </span>
      </div>
      <div className="bud-track">
        <div
          className="bud-fill"
          style={{
            width: `${pct}%`,
            ...(team.overBudget
              ? { background: "var(--red)" }
              : {}),
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 7,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 10.5,
            color: team.overBudget ? "var(--red)" : "var(--green)",
          }}
        >
          {team.budgetUsdMonthly != null
            ? `${pct.toFixed(1)}% used · ${team.overBudget ? "over" : "healthy"}`
            : "no budget set"}
        </span>
        {remaining != null ? (
          <span
            className="mono"
            style={{ fontSize: 10.5, color: "var(--tx-faint)" }}
          >
            {formatUsd(remaining)} remaining
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The Costs page: a usage + spend overview for the current billing month in the
 * "engineering terminal" design language. Headline stats (total spend, projects
 * with spend, teams over budget), a hand-built SVG spend-over-time area chart, a
 * spend-by-project bar list, per-team budget bars, and a per-project spend table
 * — all from real {@link useCostSummary} data. Renders loading, empty, and error
 * states.
 */
export default function CostsPage(): React.JSX.Element {
  const costs = useCostSummary();
  const summary = costs.data;

  return (
    <div className="page fade-in">
      <div className="phead">
        <div className="phead-l">
          <h1 className="ptitle">Costs</h1>
          <p className="psub">
            Estimated compute spend for the current billing month.
          </p>
        </div>
        {summary ? (
          <div className="phead-r">
            <span className="daterange">
              {absoluteTime(summary.periodStart)} →{" "}
              {absoluteTime(summary.periodEnd)}
            </span>
          </div>
        ) : null}
      </div>

      {costs.isLoading ? (
        <div className="empty">Loading cost summary…</div>
      ) : costs.error ? (
        <div className="empty">Failed to load costs — {costs.error.message}</div>
      ) : !summary ? (
        <div className="empty">No cost data yet.</div>
      ) : (
        <CostsBody summary={summary} />
      )}
    </div>
  );
}

/** The populated Costs view, given a resolved {@link CostSummary}. */
function CostsBody({ summary }: { summary: CostSummary }): React.JSX.Element {
  const spendSeries = summary.byDay.map((d) => ({
    d: dayLabel(d.date),
    v: d.estimatedUsd,
  }));
  const projectsWithSpend = summary.byProject.filter(
    (p) => p.estimatedUsd > 0,
  ).length;
  const overBudget = summary.teams.filter((t) => t.overBudget).length;
  const spendByProject = summary.byProject.map((p, i) => ({
    name: p.projectName,
    v: p.estimatedUsd,
    color: i === 0 ? "var(--acc)" : "var(--teal)",
  }));

  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <StatCard
          label="Total spend"
          value={formatUsd(summary.totalUsd)}
          icon={CircleDollarSign}
          iconTone="acc"
          sub="month to date"
          spark={summary.byDay.map((d) => d.estimatedUsd)}
          sparkColor="var(--acc)"
        />
        <StatCard
          label="Projects with spend"
          value={projectsWithSpend}
          icon={Folder}
          sub={`of ${summary.byProject.length} active`}
        />
        <StatCard
          label="Teams over budget"
          value={overBudget}
          icon={Users}
          iconTone={overBudget === 0 ? "green" : undefined}
          sub={
            overBudget === 0
              ? "ok"
              : `${summary.teams.length} ${summary.teams.length === 1 ? "team" : "teams"} total`
          }
        />
      </div>

      <div
        className="two-col"
        style={{ gridTemplateColumns: "1.25fr 1fr", marginBottom: 18 }}
      >
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">
              <TrendingUp size={16} />
              Spend over time
            </span>
            <span
              className="panel-act mono"
              style={{ fontSize: 11, color: "var(--tx-dim)" }}
            >
              USD / day
            </span>
          </div>
          <div style={{ padding: "18px 18px 12px" }}>
            {spendSeries.length === 0 ? (
              <div className="empty">No daily spend recorded yet.</div>
            ) : (
              <AreaChart series={spendSeries} color="var(--acc)" height={230} />
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">
              <Activity size={16} />
              Spend by project
            </span>
            <span
              className="panel-act mono"
              style={{ fontSize: 11, color: "var(--tx-dim)" }}
            >
              top this month
            </span>
          </div>
          <div style={{ padding: "26px 20px" }}>
            {spendByProject.length === 0 ? (
              <div className="empty">No project spend recorded yet.</div>
            ) : (
              <>
                <HBars data={spendByProject} />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: "1px solid var(--line-soft)",
                  }}
                >
                  <span style={{ color: "var(--tx-dim)", fontSize: 12 }}>
                    Total across projects
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 13, fontWeight: 600 }}
                  >
                    {formatUsd(summary.totalUsd)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <span className="panel-title">
            <Users size={16} />
            Team budgets
          </span>
          <span
            className="panel-act mono"
            style={{ fontSize: 11, color: "var(--tx-dim)" }}
          >
            monthly
          </span>
        </div>
        <div style={{ padding: "18px 20px" }}>
          {summary.teams.length === 0 ? (
            <div className="empty">No teams to show.</div>
          ) : (
            summary.teams.map((team) => (
              <TeamBudget key={team.teamId} team={team} />
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">
            <Folder size={16} />
            By project
          </span>
        </div>
        {summary.byProject.length === 0 ? (
          <div className="empty">No project spend recorded yet.</div>
        ) : (
          <table className="dtable">
            <thead>
              <tr>
                <th>Project</th>
                <th style={{ textAlign: "right" }}>Estimated</th>
              </tr>
            </thead>
            <tbody>
              {summary.byProject.map((p) => (
                <tr key={p.projectId} style={{ cursor: "default" }}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{p.projectName}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="mono" style={{ fontWeight: 600 }}>
                      {formatUsd(p.estimatedUsd)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
