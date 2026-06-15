"use client";

import {
  Activity,
  ChevronRight,
  CircleCheck,
  Clock,
  ExternalLink,
  Filter,
  GitCommit,
  OctagonX,
  RefreshCw,
  Rocket,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { DEPLOYMENT_STATUS_DISPLAY } from "@shipyard/core/status";

import { StatusBadge } from "@/components/status-badge";
import { Select, StatCard, Term } from "@/components/sy";
import { useDeployments } from "@/lib/hooks";
import { relativeTime } from "@/lib/time";
import { formatDuration, shortSha } from "@/lib/utils";

import type { TermLine } from "@/components/sy";
import type { Deployment } from "@/lib/api-types";
import type { DeploymentStatus } from "@shipyard/core";

/** Sentinel select value meaning "no filter". */
const ALL = "__all__";

/** Statuses that represent an in-flight (not yet terminal) deployment. */
const IN_FLIGHT = new Set<DeploymentStatus>(["QUEUED", "BUILDING", "DEPLOYING"]);

/**
 * Build the terminal log lines for an expanded deployment row from real data:
 * failed runs surface their error summary in red; in-flight runs show a dim
 * "still running" line; succeeded runs show a couple of green success lines.
 */
function termLines(d: Deployment): TermLine[] {
  const sha = shortSha(d.commitSha);
  if (d.status === "FAILED") {
    const err =
      d.errorSummary ??
      d.build?.errorSummary ??
      "Build step failed — see Builds for the full log.";
    return [
      { text: `$ shipyard deploy ${sha}`, tone: "dim" },
      { text: "✗ build failed", tone: "red" },
      { text: err, tone: "red" },
    ];
  }
  if (d.status === "CANCELLED") {
    return [
      { text: `$ shipyard deploy ${sha}`, tone: "dim" },
      { text: "⊘ deployment cancelled", tone: "amber" },
    ];
  }
  if (IN_FLIGHT.has(d.status)) {
    return [
      { text: `$ shipyard deploy ${sha}`, tone: "dim" },
      { text: `… ${DEPLOYMENT_STATUS_DISPLAY[d.status].label.toLowerCase()}`, tone: "blue" },
    ];
  }
  // SUCCEEDED
  return [
    { text: `$ shipyard deploy ${sha}`, tone: "dim" },
    { text: "✓ build succeeded", tone: "green" },
    {
      text: `✓ deploy complete${d.durationMs != null ? ` in ${formatDuration(d.durationMs)}` : ""}`,
      tone: "green",
    },
  ];
}

/** The expanded panel beneath a deployment row. */
function ExpandRow({ d }: { d: Deployment }): React.JSX.Element {
  const slug = d.preview?.slug;
  return (
    <div className="expbox">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {slug ? <span className="pill">{slug}</span> : null}
        <span className="pill">{d.trigger}</span>
        <span className="pill">{shortSha(d.commitSha)}</span>
      </div>
      <Term
        title={`build · ${shortSha(d.commitSha)}`}
        tag={d.status === "FAILED" ? "FAILED" : undefined}
        tagTone="red"
        lines={termLines(d)}
      />
      <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
        <Link
          href={slug ? `/previews?slug=${encodeURIComponent(slug)}` : "/previews"}
          className="btn btn-outline btn-sm"
          onClick={(e) => e.stopPropagation()}
        >
          Open preview
          <ExternalLink size={13} />
        </Link>
        <Link
          href={`/deployments/${d.id}`}
          className="btn btn-ghost btn-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <RefreshCw size={13} />
          Redeploy
        </Link>
      </div>
    </div>
  );
}

/**
 * The Deployments page (engineering-terminal redesign): a stat row derived from
 * the loaded runs (success rate, average duration, in-flight count, failures)
 * over a filterable table whose rows expand in place to reveal a terminal log
 * block and per-run actions. Renders loading, error, and empty states.
 */
export default function DeploymentsPage(): React.JSX.Element {
  const [status, setStatus] = React.useState<string>(ALL);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const deployments = useDeployments({
    status: status === ALL ? undefined : (status as DeploymentStatus),
    limit: 50,
  });
  const items = deployments.data?.data ?? [];

  const statusOptions = React.useMemo(
    () => [
      { value: ALL, label: "All statuses" },
      ...(Object.keys(DEPLOYMENT_STATUS_DISPLAY) as DeploymentStatus[]).map(
        (s) => ({ value: s, label: DEPLOYMENT_STATUS_DISPLAY[s].label }),
      ),
    ],
    [],
  );

  // Derived stats over the loaded rows.
  const finished = items.filter(
    (d) => d.status === "SUCCEEDED" || d.status === "FAILED",
  );
  const succeeded = items.filter((d) => d.status === "SUCCEEDED");
  const successRate =
    finished.length > 0
      ? Math.round((succeeded.length / finished.length) * 100)
      : null;

  const durations = items
    .map((d) => d.durationMs)
    .filter((ms): ms is number => ms != null);
  const avgDuration =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null;

  const building = items.filter((d) => d.status === "BUILDING").length;
  const deploying = items.filter((d) => d.status === "DEPLOYING").length;
  const queued = items.filter((d) => d.status === "QUEUED").length;
  const runningNow = building + deploying + queued;
  const runningParts = [
    building ? `${building} building` : null,
    deploying ? `${deploying} deploying` : null,
    queued ? `${queued} queued` : null,
  ].filter(Boolean);

  const failed = items.filter((d) => d.status === "FAILED").length;

  const maxDur = durations.length > 0 ? Math.max(...durations) : 1;

  return (
    <div className="page fade-in">
      <div className="phead">
        <div className="phead-l">
          <h1 className="ptitle">Deployments</h1>
          <p className="psub">Build-and-start runs across all your previews.</p>
        </div>
        <div className="phead-r">
          <Select
            value={status}
            options={statusOptions}
            onChange={setStatus}
            icon={Filter}
            width={180}
          />
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <StatCard
          label="Success rate"
          value={successRate != null ? `${successRate}%` : "—"}
          icon={CircleCheck}
          iconTone="green"
          sub={
            finished.length > 0
              ? `${succeeded.length}/${finished.length} finished`
              : "no finished runs"
          }
        />
        <StatCard
          label="Avg duration"
          value={avgDuration != null ? formatDuration(avgDuration) : "—"}
          icon={Clock}
          sub="build + deploy"
        />
        <StatCard
          label="Running now"
          value={runningNow}
          icon={Activity}
          iconTone="blue"
          sub={runningParts.length > 0 ? runningParts.join(" · ") : "idle"}
        />
        <StatCard
          label="Failed"
          value={failed}
          icon={OctagonX}
          sub={failed > 0 ? "needs triage" : "all clear"}
        />
      </div>

      {deployments.isLoading ? (
        <div className="empty">Loading deployments…</div>
      ) : deployments.error ? (
        <div className="empty">{deployments.error.message}</div>
      ) : items.length === 0 ? (
        <div className="empty">
          <Rocket
            size={20}
            style={{ display: "block", margin: "0 auto 10px", opacity: 0.6 }}
          />
          No deployments yet — they appear here as previews build and deploy.
        </div>
      ) : (
        <div className="tablewrap">
          <table className="dtable">
            <thead>
              <tr>
                <th style={{ width: 130 }}>Status</th>
                <th>Preview</th>
                <th>Commit</th>
                <th>Trigger</th>
                <th>Duration</th>
                <th style={{ textAlign: "right" }}>Queued</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const isOpen = expandedId === d.id;
                const previewName =
                  d.preview?.name ?? d.preview?.slug ?? "Preview";
                const inFlight = IN_FLIGHT.has(d.status);
                const rows: React.JSX.Element[] = [
                  <tr
                    key={d.id}
                    className={isOpen ? "expanded" : ""}
                    onClick={() => setExpandedId(isOpen ? null : d.id)}
                  >
                    <td>
                      <StatusBadge status={d.status} kind="deployment" />
                    </td>
                    <td>
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 9 }}
                      >
                        <ChevronRight
                          size={14}
                          style={{
                            color: "var(--tx-faint)",
                            transform: isOpen ? "rotate(90deg)" : "none",
                            transition: "transform .15s",
                            flex: "none",
                          }}
                        />
                        <span style={{ fontWeight: 600 }}>{previewName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="c-mono">
                        <GitCommit
                          size={12}
                          style={{
                            verticalAlign: "-2px",
                            marginRight: 5,
                            color: "var(--tx-faint)",
                          }}
                        />
                        {shortSha(d.commitSha)}
                      </span>
                    </td>
                    <td>
                      <span className="trigpill">{d.trigger}</span>
                    </td>
                    <td>
                      {d.durationMs != null ? (
                        <>
                          <span className="durbar">
                            <i
                              style={{
                                width: `${(d.durationMs / maxDur) * 100}%`,
                                background:
                                  d.status === "FAILED"
                                    ? "var(--red)"
                                    : "var(--tx-dim)",
                              }}
                            />
                          </span>
                          <span className="c-mono">
                            {formatDuration(d.durationMs)}
                          </span>
                        </>
                      ) : inFlight ? (
                        <span className="c-mono" style={{ color: "var(--blue)" }}>
                          running…
                        </span>
                      ) : (
                        <span className="c-mono" style={{ color: "var(--tx-dim)" }}>
                          —
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="c-mono" style={{ color: "var(--tx-dim)" }}>
                        {relativeTime(d.queuedAt)}
                      </span>
                    </td>
                  </tr>,
                ];
                if (isOpen) {
                  rows.push(
                    <tr key={`${d.id}-exp`} className="exprow">
                      <td colSpan={6}>
                        <ExpandRow d={d} />
                      </td>
                    </tr>,
                  );
                }
                return rows;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
