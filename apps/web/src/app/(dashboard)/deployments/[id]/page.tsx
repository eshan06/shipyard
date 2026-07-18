"use client";

import {
  ArrowLeft,
  Boxes,
  CircleSlash,
  Clock,
  GitCommit,
  Hammer,
  Package,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { LogViewer } from "@/components/log-viewer";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { Term } from "@/components/sy";
import { api, ApiError } from "@/lib/api";
import { useDeployment } from "@/lib/hooks";
import { absoluteTime, relativeTime } from "@/lib/time";
import { formatDuration, shortSha } from "@/lib/utils";

import type { TermLine } from "@/components/sy";
import type { Build, Deployment } from "@/lib/api-types";
import type { BuildStatus } from "@shipyard/core";

/** Deployment statuses that may still be cancelled. */
const CANCELLABLE = new Set(["QUEUED", "BUILDING", "DEPLOYING"]);

/** Local display metadata for {@link BuildStatus} (core ships no build map). */
const BUILD_STATUS_KIND: Record<BuildStatus, { label: string; tone: StatusTone }> = {
  PENDING: { label: "Pending", tone: "gray" },
  RUNNING: { label: "Running", tone: "blue" },
  SUCCEEDED: { label: "Succeeded", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
  CANCELLED: { label: "Cancelled", tone: "gray" },
};

/** Split a raw error summary into red-tinted terminal log lines. */
function errorTermLines(summary: string): TermLine[] {
  return summary
    .trim()
    .split("\n")
    .map((text) => ({ text: text.length > 0 ? text : " ", tone: "red" as const }));
}

/** A labelled key/value row (terminal `.kv`). */
function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="kv">
      <span
        className="kv-k"
        style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
      >
        {icon}
        {label}
      </span>
      <span className="kv-v" style={{ minWidth: 0 }}>
        {children}
      </span>
    </div>
  );
}

/** A status pill for a build's lifecycle status. */
function BuildStatusBadge({
  status,
}: {
  status: BuildStatus;
}): React.JSX.Element {
  const meta = BUILD_STATUS_KIND[status] ?? { label: status, tone: "gray" as const };
  return <span className={`badge b-${meta.tone}`}>{meta.label}</span>;
}

/** The build summary card: status, image tag, cache, exit code, error. */
function BuildCard({ build }: { build: Build }): React.JSX.Element {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">
          <Hammer size={16} />
          Build
        </span>
      </div>
      <div style={{ padding: "4px 18px 14px" }}>
        <MetaRow icon={<span aria-hidden>·</span>} label="Status">
          <BuildStatusBadge status={build.status} />
        </MetaRow>
        <MetaRow icon={<Package size={14} />} label="Image">
          {build.imageTag ? (
            <span className="mono" style={{ fontSize: 12 }}>
              {build.imageTag}
            </span>
          ) : (
            <span style={{ color: "var(--tx-dim)" }}>—</span>
          )}
        </MetaRow>
        <MetaRow icon={<Zap size={14} />} label="Cache">
          {build.cacheHit ? (
            <span className="badge b-green">Hit</span>
          ) : (
            <span style={{ color: "var(--tx-dim)" }}>Miss</span>
          )}
        </MetaRow>
        <MetaRow icon={<Clock size={14} />} label="Duration">
          {formatDuration(build.durationMs)}
        </MetaRow>
        {build.exitCode != null ? (
          <MetaRow icon={<span aria-hidden>·</span>} label="Exit code">
            <span className="mono">{build.exitCode}</span>
          </MetaRow>
        ) : null}
        {build.errorSummary ? (
          <div style={{ paddingTop: 14 }}>
            <Term
              title="build · error summary"
              tag="FAILED"
              tagTone="red"
              lines={errorTermLines(build.errorSummary)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The detail header: back link, status, preview link, and cancel action. */
function DeploymentDetailHeader({
  deployment,
  onCancel,
}: {
  deployment: Deployment;
  onCancel: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const previewName = deployment.preview?.name ?? deployment.preview?.slug;
  const canCancel = CANCELLABLE.has(deployment.status);

  return (
    <div style={{ marginBottom: 22 }}>
      <button
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: 16 }}
        onClick={() => router.push("/deployments")}
      >
        <ArrowLeft size={14} />
        Deployments
      </button>

      <div className="phead" style={{ marginBottom: 0 }}>
        <div className="phead-l">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 className="ptitle">{previewName ?? "Deployment"}</h1>
            <StatusBadge status={deployment.status} kind="deployment" />
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              marginTop: 10,
            }}
          >
            <span className="meta">
              <GitCommit />
              <span className="mono">{shortSha(deployment.commitSha)}</span>
            </span>
            <span className="meta">
              <Zap />
              {deployment.trigger}
            </span>
            <span className="meta">
              <Clock />
              {relativeTime(deployment.queuedAt)}
            </span>
          </div>
        </div>

        <div className="phead-r">
          {deployment.preview ? (
            <Link
              className="btn btn-outline"
              href={`/previews/${deployment.previewId}`}
            >
              <Boxes size={15} />
              Preview
            </Link>
          ) : null}
          {canCancel ? (
            <button className="btn btn-danger" onClick={onCancel}>
              <CircleSlash size={15} />
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * The Deployment detail page: a header (status, commit, trigger, preview link,
 * cancel action), a metadata + build summary column, and a live log stream for
 * the deployment. Polls while the deployment is in flight. Renders loading and
 * error states.
 */
export default function DeploymentDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  const { data: deployment, error, isLoading, mutate } = useDeployment(id);

  if (error) {
    return (
      <div className="page fade-in">
        <div className="empty">
          <div style={{ marginBottom: 10 }}>
            Couldn&apos;t load deployment — {error.message}
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => void mutate()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !deployment) {
    return (
      <div className="page fade-in">
        <div className="empty">Loading deployment…</div>
      </div>
    );
  }

  const cancel = async (): Promise<void> => {
    try {
      await api.cancelDeployment(deployment.id);
      toast.success("Deployment cancelled");
      void mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Cancel failed");
    }
  };

  return (
    <div className="page fade-in">
      <DeploymentDetailHeader
        deployment={deployment}
        onCancel={() => setConfirmCancel(true)}
      />

      <div className="two-col" style={{ alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18 }}>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Details</span>
            </div>
            <div style={{ padding: "4px 18px 14px" }}>
              <MetaRow icon={<GitCommit size={14} />} label="Commit">
                <span
                  className="mono"
                  style={{ fontSize: 12 }}
                  title={deployment.commitSha}
                >
                  {shortSha(deployment.commitSha)}
                </span>
              </MetaRow>
              <MetaRow icon={<Zap size={14} />} label="Trigger">
                {deployment.trigger}
              </MetaRow>
              <MetaRow icon={<Clock size={14} />} label="Duration">
                {formatDuration(deployment.durationMs)}
              </MetaRow>
              <MetaRow icon={<span aria-hidden>·</span>} label="Queued">
                <span style={{ color: "var(--tx-dim)" }}>
                  {absoluteTime(deployment.queuedAt)}
                </span>
              </MetaRow>
              <MetaRow icon={<span aria-hidden>·</span>} label="Started">
                <span style={{ color: "var(--tx-dim)" }}>
                  {absoluteTime(deployment.startedAt)}
                </span>
              </MetaRow>
              <MetaRow icon={<span aria-hidden>·</span>} label="Finished">
                <span style={{ color: "var(--tx-dim)" }}>
                  {absoluteTime(deployment.finishedAt)}
                </span>
              </MetaRow>
            </div>
          </div>

          {deployment.build ? <BuildCard build={deployment.build} /> : null}

          {deployment.errorSummary ? (
            <Term
              title={`error · ${shortSha(deployment.commitSha)}`}
              tag="FAILED"
              tagTone="red"
              lines={errorTermLines(deployment.errorSummary)}
            />
          ) : null}
        </div>

        <LogViewer
          deploymentId={deployment.id}
          title="Deployment logs"
          heightClass="h-[32rem]"
        />
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this deployment?"
        description="This stops the in-flight build and deploy. You can re-deploy the preview afterward."
        confirmLabel="Cancel deployment"
        confirmVariant="destructive"
        onConfirm={cancel}
      />
    </div>
  );
}
