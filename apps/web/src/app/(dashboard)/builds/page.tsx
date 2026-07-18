"use client";

import {
  ChevronRight,
  CircleCheck,
  Clock,
  OctagonX,
  RefreshCw,
  Search,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { CopyBtn, StatCard, Term, Toggle } from "@/components/sy";
import { api, ApiError } from "@/lib/api";
import { useDeployments } from "@/lib/hooks";
import { relativeTime } from "@/lib/time";
import { formatDuration, shortSha } from "@/lib/utils";

import type { TermLine } from "@/components/sy";
import type { Build, Deployment } from "@/lib/api-types";

/** A deployment row guaranteed to carry a build summary. */
interface BuiltDeployment extends Deployment {
  build: Build;
}

/** Whether a deployment has an attached build summary. */
function hasBuild(d: Deployment): d is BuiltDeployment {
  return d.build != null;
}

/** Whether a built deployment represents a failed build. */
function isFailed(d: BuiltDeployment): boolean {
  return d.build.status === "FAILED" || d.status === "FAILED";
}

/**
 * Derive terminal log lines from a build's real error summary. Lines that read
 * like an error are tinted red; everything else is dimmed. Falls back to a
 * single placeholder line when the API gave us no summary.
 */
function logLines(d: BuiltDeployment): TermLine[] {
  const summary = d.build.errorSummary ?? d.errorSummary ?? "";
  const raw = summary
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.length > 0);
  if (raw.length === 0) {
    return [{ text: "Build failed — no error summary captured.", tone: "dim" }];
  }
  return raw.map((text) => {
    const looksError = /error|fail|cannot|exception|fatal|✖|✗/i.test(text);
    return { text, tone: looksError ? "red" : "dim" };
  });
}

/** Props for {@link BuildCard}. */
interface BuildCardProps {
  deployment: BuiltDeployment;
  open: boolean;
  onToggle: () => void;
  retrying: boolean;
  onRetry: () => void;
}

/** A single failed-build card: a collapsed summary row + expandable log. */
function BuildCard({
  deployment,
  open,
  onToggle,
  retrying,
  onRetry,
}: BuildCardProps): React.JSX.Element {
  const { build } = deployment;
  const name = deployment.preview?.name ?? deployment.preview?.slug ?? "preview";
  const slug = deployment.preview?.slug ?? "";
  const errorText =
    build.errorSummary ?? deployment.errorSummary ?? "Build failed";
  const when = relativeTime(build.finishedAt ?? deployment.finishedAt);
  const lines = logLines(deployment);
  const exit = build.exitCode ?? 1;

  return (
    <div
      className="card"
      style={{
        overflow: "hidden",
        borderColor: open ? "var(--line-strong)" : undefined,
      }}
    >
      <div
        className="build-row"
        style={{
          alignItems: "center",
          gap: 14,
          padding: "15px 16px",
          cursor: "pointer",
        }}
        onClick={onToggle}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 600,
              fontSize: 13.5,
            }}
          >
            <ChevronRight
              size={14}
              style={{
                color: "var(--tx-faint)",
                transform: open ? "rotate(90deg)" : "none",
                transition: "transform .15s",
                flex: "none",
              }}
            />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </span>
          </div>
          {slug ? (
            <div className="meta" style={{ marginTop: 5, paddingLeft: 22 }}>
              <span className="truncate">{slug}</span>
            </div>
          ) : null}
        </div>
        <span className="mono" style={{ fontSize: 12, color: "var(--tx-mid)" }}>
          {shortSha(deployment.commitSha)}
        </span>
        <div className="errline">
          <ChevronRight size={13} className="chev" />
          <span className="etext">{errorText}</span>
        </div>
        <span className="mono" style={{ fontSize: 12, color: "var(--tx-dim)" }}>
          {formatDuration(build.durationMs)}
        </span>
        <span
          className="mono"
          style={{ fontSize: 12, color: "var(--tx-faint)" }}
        >
          {when}
        </span>
        <button
          className="btn btn-outline btn-sm"
          disabled={retrying}
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
        >
          <RefreshCw size={13} className={retrying ? "spin" : undefined} />
          Retry
        </button>
      </div>
      {open ? (
        <div style={{ padding: "0 16px 16px" }}>
          <Term
            title={`build log · ${shortSha(deployment.commitSha)} · exit ${exit}`}
            tag="FAILED"
            tagTone="red"
            lines={lines}
          />
          <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={retrying}
              onClick={onRetry}
            >
              <RefreshCw size={13} />
              Retry build
            </button>
            <span className="btn btn-outline btn-sm" style={{ gap: 6 }}>
              <CopyBtn text={errorText} />
              Copy log
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The Builds page: a failed-build triage view. It lists deployments whose
 * container build failed — preview, commit, the build's error summary, when it
 * failed, and a Retry action that re-deploys the preview's commit. A search
 * filters by preview slug/commit and a toggle reveals all builds (not just
 * failures). Renders loading, empty, and error states.
 */
export default function BuildsPage(): React.JSX.Element {
  const [query, setQuery] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);

  const deployments = useDeployments({ limit: 100 });
  const all = deployments.data?.data ?? [];

  const built = React.useMemo(() => all.filter(hasBuild), [all]);

  const failed = React.useMemo(() => built.filter(isFailed), [built]);

  const rows = React.useMemo(() => {
    const scoped = showAll ? built : failed;
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((d) => {
      const slug = d.preview?.slug ?? "";
      const name = d.preview?.name ?? "";
      return (
        slug.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        d.commitSha.toLowerCase().includes(q)
      );
    });
  }, [built, failed, showAll, query]);

  // Build-success rate across the deployments that carried a build summary.
  const succeeded = React.useMemo(
    () => built.filter((d) => d.build.status === "SUCCEEDED").length,
    [built],
  );
  const successPct =
    built.length > 0 ? Math.round((succeeded / built.length) * 100) : null;

  // Average build duration across builds that reported one.
  const avgMs = React.useMemo(() => {
    const durs = built
      .map((d) => d.build.durationMs)
      .filter((v): v is number => v != null);
    if (durs.length === 0) return null;
    return durs.reduce((a, b) => a + b, 0) / durs.length;
  }, [built]);

  const isFiltering = query.trim().length > 0;

  /** Re-deploy the preview behind a failed build. */
  const retry = async (d: BuiltDeployment): Promise<void> => {
    setRetryingId(d.id);
    try {
      await api.redeployPreview(d.previewId);
      toast.success("Redeploy queued", {
        description: d.preview?.name
          ? `Rebuilding ${d.preview.name}.`
          : undefined,
      });
      void deployments.mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Retry failed");
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="page fade-in">
      <div className="phead">
        <div className="phead-l">
          <h1 className="ptitle">Builds</h1>
          <p className="psub">
            Triage failed container builds and re-run them in one click.
          </p>
        </div>
        <div className="phead-r">
          <div className="search">
            <Search />
            <input
              placeholder="Filter preview or commit…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter builds by preview or commit"
            />
          </div>
          <Toggle on={showAll} onChange={setShowAll} label="Show all builds" />
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <StatCard
          label="Failed builds"
          value={failed.length}
          sub="last 100 deploys"
          icon={OctagonX}
        />
        <StatCard
          label="Build success"
          value={successPct == null ? "—" : `${successPct}%`}
          sub="rolling 100 deploys"
          icon={CircleCheck}
          iconTone="green"
        />
        <StatCard
          label="Avg build time"
          value={formatDuration(avgMs)}
          sub="across builds"
          icon={Clock}
        />
        <StatCard
          label="Retries today"
          value={0}
          sub="this session"
          icon={RefreshCw}
          iconTone="blue"
        />
      </div>

      {deployments.isLoading ? (
        <div className="empty">Loading builds…</div>
      ) : deployments.error ? (
        <div className="panel" style={{ padding: "13px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span
              className="stat-ic"
              style={{
                color: "var(--red)",
                background: "var(--red-soft)",
                borderColor: "var(--red-line)",
              }}
            >
              <OctagonX size={15} />
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                Couldn’t load builds
              </div>
              <div
                style={{ color: "var(--tx-dim)", fontSize: 12, marginTop: 2 }}
              >
                {deployments.error.message}
              </div>
            </div>
            <button
              className="btn btn-outline btn-sm"
              style={{ marginLeft: "auto" }}
              onClick={() => void deployments.mutate()}
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          {!showAll && failed.length > 0 ? (
            <div
              className="panel"
              style={{
                padding: "13px 16px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 11,
              }}
            >
              <span
                className="stat-ic"
                style={{
                  color: "var(--red)",
                  background: "var(--red-soft)",
                  borderColor: "var(--red-line)",
                }}
              >
                <OctagonX size={15} />
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                  {failed.length} failed{" "}
                  {failed.length === 1 ? "build" : "builds"} in the last{" "}
                  {built.length} deployments
                </div>
                <div
                  style={{ color: "var(--tx-dim)", fontSize: 12, marginTop: 2 }}
                >
                  Expand a build to inspect its log, then retry to re-run the
                  container build.
                </div>
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rows.length > 0 ? (
              rows.map((d) => (
                <BuildCard
                  key={d.id}
                  deployment={d}
                  open={openId === d.id}
                  onToggle={() => setOpenId(openId === d.id ? null : d.id)}
                  retrying={retryingId === d.id}
                  onRetry={() => void retry(d)}
                />
              ))
            ) : isFiltering ? (
              <div className="empty">No builds match “{query}”.</div>
            ) : showAll ? (
              <div className="empty">No builds yet.</div>
            ) : (
              <div className="empty">No failed builds.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
