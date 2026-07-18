"use client";

import {
  Archive,
  ArrowLeft,
  Boxes,
  ExternalLink,
  FolderRoot,
  GitBranch,
  Github,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";

import { usePreviews, useProject } from "@/lib/hooks";
import { absoluteTime } from "@/lib/time";

import { EnvManager } from "./_components/env-manager";
import { SeedManager } from "./_components/seed-manager";
import {
  DangerZoneCard,
  DeploySettingsCard,
} from "./_components/settings-form";

import type { Project } from "@/lib/api-types";

/** The project detail tabs. */
const TABS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "env", label: "Environment" },
  { value: "seeds", label: "Seed templates" },
  { value: "settings", label: "Settings" },
];

/** A labelled key/value pair (terminal `.kv`) in the overview repository card. */
function InfoRow({
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

/** The detail-page header: back link, name, repo, archive badge, GitHub link. */
function ProjectDetailHeader({
  project,
}: {
  project: Project;
}): React.JSX.Element {
  const router = useRouter();
  const repoUrl =
    project.provider.toLowerCase() === "github"
      ? `https://github.com/${project.repoFullName}`
      : null;

  return (
    <div style={{ marginBottom: 22 }}>
      <button
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: 16 }}
        onClick={() => router.push("/projects")}
      >
        <ArrowLeft size={14} />
        Projects
      </button>

      <div className="phead" style={{ marginBottom: 0 }}>
        <div className="phead-l">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 className="ptitle">{project.name}</h1>
            {project.isArchived ? (
              <span className="badge b-gray">
                <Archive size={11} />
                Archived
              </span>
            ) : null}
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
              <Github />
              <span className="mono">{project.repoFullName}</span>
            </span>
            <span className="meta">
              <GitBranch />
              <span className="mono">{project.defaultBranch}</span>
            </span>
            {project.framework ? (
              <span className="meta">
                <Layers />
                <span style={{ textTransform: "capitalize" }}>
                  {project.framework}
                </span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="phead-r">
          {repoUrl ? (
            <a
              className="btn btn-outline"
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={15} />
              Repository
              <ExternalLink size={13} />
            </a>
          ) : null}
          <Link className="btn btn-outline" href={`/previews?projectId=${project.id}`}>
            <Boxes size={15} />
            Previews
          </Link>
        </div>
      </div>
    </div>
  );
}

/** The Overview tab: repository facts + a snapshot of deploy settings. */
function OverviewTab({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: () => void;
}): React.JSX.Element {
  const previews = usePreviews({ projectId: project.id, limit: 100 });
  const previewCount = previews.data?.data.length;

  return (
    <div className="grid cols-2" style={{ alignItems: "start", gap: 18 }}>
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Repository</span>
        </div>
        <div style={{ padding: "4px 18px 14px" }}>
          <p className="psub" style={{ marginTop: 8, marginBottom: 4 }}>
            Source-control connection and build location.
          </p>
          <InfoRow icon={<Github size={14} />} label="Repository">
            <span className="mono">{project.repoFullName}</span>
          </InfoRow>
          <InfoRow icon={<span aria-hidden>·</span>} label="Provider">
            <span style={{ textTransform: "capitalize" }}>
              {project.provider}
            </span>
          </InfoRow>
          <InfoRow icon={<GitBranch size={14} />} label="Default branch">
            <span className="mono">{project.defaultBranch}</span>
          </InfoRow>
          <InfoRow icon={<Layers size={14} />} label="Framework">
            {project.framework ? (
              <span style={{ textTransform: "capitalize" }}>
                {project.framework}
              </span>
            ) : (
              <span style={{ color: "var(--tx-dim)" }}>Auto-detect</span>
            )}
          </InfoRow>
          <InfoRow icon={<FolderRoot size={14} />} label="Root directory">
            <span className="mono">{project.rootDirectory || "/"}</span>
          </InfoRow>
          <InfoRow icon={<Boxes size={14} />} label="Active previews">
            {previews.isLoading ? (
              <span style={{ color: "var(--tx-dim)" }}>…</span>
            ) : (
              <span>{previewCount ?? 0}</span>
            )}
          </InfoRow>
          <InfoRow icon={<span aria-hidden>·</span>} label="Created">
            <span style={{ color: "var(--tx-dim)" }}>
              {absoluteTime(project.createdAt)}
            </span>
          </InfoRow>
        </div>
      </div>

      <DeploySettingsCard project={project} onSaved={onSaved} />
    </div>
  );
}

/**
 * The Project detail page: a header (repo info, archive badge, repo/previews
 * links) and four tabs — Overview (repository facts + editable deployment
 * settings), Environment Variables & Secrets (full CRUD with masked secrets),
 * Seed Templates (CRUD + default), and Settings (deployment settings + danger
 * zone). Renders loading and error states.
 */
export default function ProjectDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [tab, setTab] = React.useState("overview");

  const { data: project, error, isLoading, mutate } = useProject(id);

  if (error) {
    return (
      <div className="page fade-in">
        <div className="empty">
          <div style={{ marginBottom: 10 }}>
            Couldn&apos;t load project — {error.message}
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => void mutate()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !project) {
    return (
      <div className="page fade-in">
        <div className="empty">Loading project…</div>
      </div>
    );
  }

  const refresh = (): void => {
    void mutate();
  };

  return (
    <div className="page fade-in">
      <ProjectDetailHeader project={project} />

      <div
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid var(--line)",
          marginBottom: 22,
          flexWrap: "wrap",
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              className="mono"
              onClick={() => setTab(t.value)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "10px 14px",
                fontSize: 12.5,
                color: active ? "var(--tx)" : "var(--tx-dim)",
                borderBottom: active
                  ? "2px solid var(--acc)"
                  : "2px solid transparent",
                marginBottom: -1,
                transition: "color .14s",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" ? (
        <OverviewTab project={project} onSaved={refresh} />
      ) : null}

      {tab === "env" ? <EnvManager projectId={project.id} /> : null}

      {tab === "seeds" ? <SeedManager projectId={project.id} /> : null}

      {tab === "settings" ? (
        <div style={{ display: "grid", gap: 18 }}>
          <DeploySettingsCard project={project} onSaved={refresh} />
          <DangerZoneCard project={project} onChanged={refresh} />
        </div>
      ) : null}
    </div>
  );
}
