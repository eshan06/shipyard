"use client";

import {
  Activity,
  ArrowUpRight,
  Box,
  CircleCheck,
  CircleDollarSign,
  GitCommit,
  Globe,
  Layers,
  Plus,
  Rocket,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { StatusBadge, statusColorVar } from "@/components/status-badge";
import { StatCard } from "@/components/sy";
import {
  useCostSummary,
  useDeployments,
  usePreviews,
} from "@/lib/hooks";
import { relativeTime } from "@/lib/time";
import { formatDuration, formatUsd, shortSha } from "@/lib/utils";

import type { DeltaDir } from "@/components/sy";
import type { Deployment, Preview } from "@/lib/api-types";

/** Status values whose dot should pulse in the timeline (live deployments). */
const LIVE_DEPLOYMENT = new Set(["QUEUED", "BUILDING", "DEPLOYING"]);

/** A single deployment row in the "Recent deployments" timeline. */
function DeploymentRow({
  d,
  last,
}: {
  d: Deployment;
  last: boolean;
}): React.JSX.Element {
  const live = LIVE_DEPLOYMENT.has(d.status);
  const dotColor = statusColorVar(d.status, "deployment");
  return (
    <Link
      href={`/deployments/${d.id}`}
      className="tl-row"
      style={{
        display: "flex",
        gap: 14,
        padding: "11px 0",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
        alignItems: "center",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 10,
          flex: "none",
          alignSelf: "stretch",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <span
          className={live ? "pulse-dot" : ""}
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            marginTop: 4,
            background: dotColor,
            boxShadow: `0 0 0 3px color-mix(in srgb, ${dotColor} 22%, transparent)`,
          }}
        />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <StatusBadge status={d.status} kind="deployment" />
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {d.preview ? `PR #${d.preview.slug}` : "Deployment"}
          </span>
          <span
            className="mono"
            style={{ color: "var(--tx-dim)", fontSize: 12 }}
          >
            {d.preview?.name ?? ""}
          </span>
        </div>
        <div className="meta" style={{ marginTop: 5 }}>
          <GitCommit />
          <span>{shortSha(d.commitSha)}</span>
          <span className="dot-sep" />
          <span className="trigpill">{d.trigger}</span>
          <span className="dot-sep" />
          <span style={{ color: "var(--tx-faint)" }}>
            {relativeTime(d.queuedAt)}
          </span>
        </div>
      </div>
      <span
        className="mono"
        style={{ color: "var(--tx-dim)", fontSize: 11.5 }}
      >
        {formatDuration(d.durationMs)}
      </span>
      <ArrowUpRight size={15} style={{ color: "var(--tx-faint)" }} />
    </Link>
  );
}

/** A single active-preview card in the right-hand panel. */
function ActivePreviewCard({ p }: { p: Preview }): React.JSX.Element {
  const building = p.status === "BUILDING" || p.status === "DEPLOYING";
  const running = p.status === "RUNNING";
  return (
    <Link
      href={`/previews/${p.id}`}
      className="card"
      style={{ padding: 14, cursor: "pointer", display: "block" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="pv-id">
            {p.pullRequest ? (
              <span className="pr">PR #{p.pullRequest.number}</span>
            ) : null}
            <span className="nm">{p.slug}</span>
          </div>
          <div className="pv-proj">
            {p.project.name}
            {p.branch ? ` · ${p.branch}` : ""}
          </div>
        </div>
        <StatusBadge status={p.status} kind="preview" />
      </div>
      {building ? (
        <div className="bprog indet" style={{ marginTop: 12 }}>
          <i />
        </div>
      ) : null}
      {running && p.url ? (
        <div className="pv-url" style={{ marginTop: 12 }}>
          <Globe />
          <span className="u">{p.url}</span>
        </div>
      ) : null}
    </Link>
  );
}

/**
 * The Overview page: a page header, a four-up row of KPI stat cards (active
 * previews, running, deploys today, est. monthly cost), and a two-column body
 * with a recent-deployments timeline and an active-previews list. Every section
 * renders its own loading / empty / error state from the real SWR hooks.
 */
export default function OverviewPage(): React.JSX.Element {
  const previews = usePreviews({ limit: 100 });
  const deployments = useDeployments({ limit: 50 });
  const costs = useCostSummary();

  const allPreviews = previews.data?.data ?? [];
  const liveOnly = allPreviews.filter((p) => p.destroyedAt == null);
  const running = liveOnly.filter((p) => p.status === "RUNNING").length;
  const building = liveOnly.filter(
    (p) => p.status === "BUILDING" || p.status === "DEPLOYING",
  ).length;

  const allDeployments = deployments.data?.data ?? [];
  const startOfToday = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const today = allDeployments.filter(
    (d) => new Date(d.queuedAt).getTime() >= startOfToday,
  );
  const failedToday = today.filter((d) => d.status === "FAILED").length;

  const recent = allDeployments.slice(0, 8);
  const active = liveOnly.filter((p) =>
    ["BUILDING", "DEPLOYING", "RUNNING"].includes(p.status),
  );

  // Cost spark + delta are derived from the real `byDay` series only.
  const byDay = costs.data?.byDay ?? [];
  const costSpark = byDay.map((d) => d.estimatedUsd);
  const firstDay = byDay[0];
  const lastDay = byDay[byDay.length - 1];
  let costDelta: { dir: DeltaDir; text: string } | undefined;
  if (firstDay && lastDay && firstDay.estimatedUsd > 0) {
    const pct = Math.round(
      ((lastDay.estimatedUsd - firstDay.estimatedUsd) / firstDay.estimatedUsd) *
        100,
    );
    if (pct !== 0) {
      costDelta = {
        dir: pct > 0 ? "up" : "down",
        text: `${pct > 0 ? "+" : ""}${pct}%`,
      };
    }
  }

  return (
    <div className="page fade-in">
      <div className="phead">
        <div className="phead-l">
          <h1 className="ptitle">Overview</h1>
          <p className="psub">
            A live snapshot of your preview environments and recent activity.
          </p>
        </div>
        <div className="phead-r">
          <Link className="btn btn-ghost" href="/previews">
            <Layers size={15} />
            View previews
          </Link>
          <Link className="btn btn-primary" href="/previews/new">
            <Plus size={15} />
            New preview
          </Link>
        </div>
      </div>

      <div className="grid cols-4">
        <StatCard
          label="Active previews"
          value={active.length}
          sub={`${liveOnly.length} total`}
          icon={Box}
          iconTone="acc"
        />
        <StatCard
          label="Running"
          value={running}
          sub={`${building} building`}
          icon={Activity}
          iconTone="green"
          delta={running > 0 ? { dir: "flat", text: "live" } : undefined}
        />
        <StatCard
          label="Deploys today"
          value={today.length}
          sub={`${failedToday} failed`}
          icon={Rocket}
          iconTone="blue"
        />
        <StatCard
          label="Est. monthly cost"
          value={formatUsd(costs.data?.totalUsd ?? 0)}
          sub="current period"
          icon={CircleDollarSign}
          spark={costSpark.length > 1 ? costSpark : undefined}
          sparkColor="var(--teal)"
          delta={costDelta}
        />
      </div>

      <div className="two-col section-gap">
        {/* Recent deployments timeline */}
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">
              <Rocket size={16} />
              Recent deployments
            </span>
            <span className="panel-act">
              <Link className="link" href="/deployments">
                View all
                <ArrowUpRight />
              </Link>
            </span>
          </div>
          <div style={{ padding: "8px 18px 14px" }}>
            {deployments.isLoading ? (
              <div className="empty">Loading deployments…</div>
            ) : deployments.error ? (
              <div className="empty">Failed to load deployments.</div>
            ) : recent.length === 0 ? (
              <div className="empty">No deployments yet.</div>
            ) : (
              recent.map((d, i) => (
                <DeploymentRow
                  key={d.id}
                  d={d}
                  last={i === recent.length - 1}
                />
              ))
            )}
          </div>
        </div>

        {/* Active previews */}
        <div className="panel" style={{ alignSelf: "start" }}>
          <div className="panel-head">
            <span className="panel-title">
              <Box size={16} />
              Active previews
            </span>
            <span className="panel-act">
              <Link className="link" href="/previews">
                View all
                <ArrowUpRight />
              </Link>
            </span>
          </div>
          <div
            style={{
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 11,
            }}
          >
            {previews.isLoading ? (
              <div className="empty">Loading previews…</div>
            ) : previews.error ? (
              <div className="empty">Failed to load previews.</div>
            ) : active.length === 0 ? (
              <div className="empty">No active previews.</div>
            ) : (
              <>
                {active.map((p) => (
                  <ActivePreviewCard key={p.id} p={p} />
                ))}
                <div
                  className="card"
                  style={{
                    padding: "13px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: "var(--tx-dim)",
                  }}
                >
                  <CircleCheck size={16} style={{ color: "var(--green)" }} />
                  <span style={{ fontSize: 12.5 }}>
                    {liveOnly.length - active.length} idle previews ·{" "}
                    <span className="mono">$0.00/hr</span> while stopped
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
