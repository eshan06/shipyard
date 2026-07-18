"use client";

import {
  ExternalLink,
  Filter,
  Folder,
  GitBranch,
  GitPullRequest,
  Globe,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { PREVIEW_STATUS_DISPLAY } from "@shipyard/core/status";

import { StatusBadge, statusColorVar } from "@/components/status-badge";
import { Select } from "@/components/sy";
import { usePreviews, useProjects } from "@/lib/hooks";
import { previewOpenTarget } from "@/lib/preview-link";
import { relativeTime } from "@/lib/time";

import type { Preview } from "@/lib/api-types";
import type { PreviewStatus } from "@shipyard/core";

/** Sentinel select value meaning "no filter". */
const ALL = "__all__";

/** A single preview card in the responsive grid. */
function PreviewCard({ p }: { p: Preview }): React.JSX.Element {
  const building = p.status === "BUILDING" || p.status === "DEPLOYING";
  const live = p.status === "RUNNING";
  const openHref = p.url ? (previewOpenTarget(p).href ?? p.url) : null;

  return (
    <div
      className="pvcard"
      style={{ ["--statc" as string]: statusColorVar(p.status, "preview") }}
    >
      <div className="pv-top">
        <div style={{ minWidth: 0 }}>
          <div className="pv-id">
            {p.isPinned ? <Zap size={13} className="pv-star" /> : null}
            {p.pullRequest ? (
              <span className="pr">PR #{p.pullRequest.number}</span>
            ) : null}
            <span className="nm">{p.slug}</span>
          </div>
          <div className="pv-proj">{p.project.name}</div>
        </div>
        <span className="pv-badge">
          <StatusBadge status={p.status} kind="preview" />
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {p.branch ? (
          <div className="meta">
            <GitBranch />
            <span className="truncate">{p.branch}</span>
          </div>
        ) : null}
        {p.pullRequest ? (
          <div className="meta">
            <GitPullRequest />
            <span className="truncate" style={{ color: "var(--tx-mid)" }}>
              #{p.pullRequest.number} {p.pullRequest.title}
            </span>
          </div>
        ) : null}
      </div>

      {building ? (
        <div className="bprog indet">
          <i />
        </div>
      ) : null}
      {live && p.url ? (
        <div className="pv-url">
          <Globe />
          <span className="u">{p.url}</span>
        </div>
      ) : null}

      <div className="pv-foot">
        <span className="pv-time">{relativeTime(p.lastActivityAt)}</span>
        <div className="pv-actions">
          {openHref ? (
            <a
              className="btn btn-ghost btn-sm"
              href={openHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open preview"
            >
              Open
              <ExternalLink size={13} />
            </a>
          ) : null}
          <Link className="btn btn-outline btn-sm" href={`/previews/${p.id}`}>
            Details
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * The Previews list page: an "engineering terminal" grid of preview cards with
 * status + project filters. Each card shows a status stripe, project, branch/PR,
 * build progress / live URL, last activity, and quick actions (open URL,
 * details). Renders loading, empty, and error states.
 */
export default function PreviewsPage(): React.JSX.Element {
  // Seed the project filter from the `?projectId=` query param so deep links
  // from a project's "Previews" button land pre-filtered.
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState<string>(ALL);
  const [projectId, setProjectId] = React.useState<string>(
    () => searchParams.get("projectId") ?? ALL,
  );

  const previews = usePreviews({
    status: status === ALL ? undefined : (status as PreviewStatus),
    projectId: projectId === ALL ? undefined : projectId,
    limit: 100,
  });
  const projects = useProjects();

  const items = previews.data?.data ?? [];

  const projOpts = [
    { value: ALL, label: "All projects" },
    ...(projects.data?.data ?? []).map((proj) => ({
      value: proj.id,
      label: proj.name,
    })),
  ];
  const statusOpts = [
    { value: ALL, label: "All statuses" },
    ...(Object.keys(PREVIEW_STATUS_DISPLAY) as PreviewStatus[]).map((s) => ({
      value: s,
      label: PREVIEW_STATUS_DISPLAY[s].label,
    })),
  ];

  return (
    <div className="page fade-in">
      <div className="phead">
        <div className="phead-l">
          <h1 className="ptitle">Previews</h1>
          <p className="psub">
            Every live preview environment across your projects.
          </p>
        </div>
        <div className="phead-r">
          <Select
            value={projectId}
            options={projOpts}
            onChange={setProjectId}
            icon={Folder}
            width={180}
          />
          <Select
            value={status}
            options={statusOpts}
            onChange={setStatus}
            icon={Filter}
            width={180}
          />
        </div>
      </div>

      {previews.isLoading ? (
        <div className="empty">Loading previews…</div>
      ) : previews.error ? (
        <div className="empty">{previews.error.message}</div>
      ) : items.length === 0 ? (
        <div className="empty">No previews match these filters.</div>
      ) : (
        <div className="pv-grid">
          {items.map((p) => (
            <PreviewCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
