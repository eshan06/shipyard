"use client";

import { Box, Filter, GitBranch, Github, Plus, Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Select } from "@/components/sy";
import { usePreviews, useProjects } from "@/lib/hooks";
import { relativeTime } from "@/lib/time";

import type { Preview, Project } from "@/lib/api-types";

/** Real preview counts derived for a single project. */
interface ProjectCounts {
  active: number;
  total: number;
  lastDeployOk: boolean;
}

/** A single project card with real preview/deploy counts. */
function ProjectCard({
  p,
  counts,
}: {
  p: Project;
  counts: ProjectCounts;
}): React.JSX.Element {
  return (
    <div className="card proj-card">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 9,
            display: "grid",
            placeItems: "center",
            background: "var(--panel-3)",
            border: "1px solid var(--line)",
            color: "var(--tx-mid)",
            flex: "none",
          }}
        >
          <Box size={18} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</span>
            <span className="tag">
              <Github
                size={10}
                style={{ verticalAlign: "-1px", marginRight: 3 }}
              />
              {p.provider}
            </span>
          </div>
          <div className="meta" style={{ marginTop: 5 }}>
            <Github />
            {p.repoFullName}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <span className="pill">
          <GitBranch
            size={11}
            style={{ verticalAlign: "-2px", marginRight: 4 }}
          />
          {p.defaultBranch}
        </span>
        <span className="pill">
          <Box size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} />
          {p.framework ?? "Node"}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 26,
          padding: "12px 0",
          borderTop: "1px solid var(--line-soft)",
          borderBottom: "1px solid var(--line-soft)",
        }}
      >
        <div className="proj-stat">
          <span className="n">{counts.active}</span>
          <span className="l">active previews</span>
        </div>
        <div className="proj-stat">
          <span className="n">{counts.total}</span>
          <span className="l">total previews</span>
        </div>
        <div className="proj-stat">
          <span
            className="n"
            style={{
              color: counts.lastDeployOk ? "var(--green)" : "var(--tx-dim)",
            }}
          >
            ●
          </span>
          <span className="l">
            {counts.lastDeployOk ? "last deploy ok" : "no deploys"}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span className="pv-time">Updated {relativeTime(p.updatedAt)}</span>
        <Link
          href={`/projects/${p.id}`}
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: "auto" }}
        >
          Manage
        </Link>
      </div>
    </div>
  );
}

/**
 * The Projects page: a searchable, sortable grid of connected repositories.
 * Each card shows real per-project preview counts (active / total) and whether
 * the project's most recent deployment succeeded, derived from the previews
 * list. Renders loading, error, and empty/filtered states.
 */
export default function ProjectsPage(): React.JSX.Element {
  const projects = useProjects();
  const previews = usePreviews({ limit: 100 });
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState("active");

  const all = projects.data?.data ?? [];
  const previewList: Preview[] = previews.data?.data ?? [];

  /** Group preview counts by project slug. */
  const countsBySlug = React.useMemo(() => {
    const map = new Map<string, ProjectCounts>();
    for (const pv of previewList) {
      const slug = pv.project.slug;
      const cur = map.get(slug) ?? {
        active: 0,
        total: 0,
        lastDeployOk: false,
      };
      cur.total += 1;
      if (pv.statusDisplay.isActive) cur.active += 1;
      if (pv.latestDeploymentStatus === "SUCCEEDED") cur.lastDeployOk = true;
      map.set(slug, cur);
    }
    return map;
  }, [previewList]);

  const countsFor = React.useCallback(
    (p: Project): ProjectCounts =>
      countsBySlug.get(p.slug) ?? {
        active: 0,
        total: 0,
        lastDeployOk: false,
      },
    [countsBySlug],
  );

  const items = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = all.filter((p) => {
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        p.repoFullName.toLowerCase().includes(needle) ||
        (p.framework ?? "").toLowerCase().includes(needle)
      );
    });
    const sorted = [...filtered];
    if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "updated") {
      sorted.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    } else {
      sorted.sort((a, b) => countsFor(b).active - countsFor(a).active);
    }
    return sorted;
  }, [all, query, sort, countsFor]);

  return (
    <div className="page fade-in">
      <div className="phead">
        <div className="phead-l">
          <h1 className="ptitle">Projects</h1>
          <p className="psub">
            Connected repositories and their preview-environment settings.
          </p>
        </div>
        <div className="phead-r">
          <div className="search">
            <Search />
            <input
              placeholder="Search projects…"
              aria-label="Search projects"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select
            value={sort}
            options={[
              { value: "active", label: "Active" },
              { value: "name", label: "Name" },
              { value: "updated", label: "Last updated" },
            ]}
            onChange={setSort}
            icon={Filter}
            width={170}
          />
          <button className="btn btn-primary">
            <Plus size={15} />
            Connect repo
          </button>
        </div>
      </div>

      {projects.isLoading ? (
        <div className="empty">Loading projects…</div>
      ) : projects.error ? (
        <div className="empty">
          Failed to load projects. {projects.error.message}
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          {query.trim()
            ? "No projects match your search."
            : "No projects yet. Connect a repository to get started."}
        </div>
      ) : (
        <div className="grid cols-3">
          {items.map((p) => (
            <ProjectCard key={p.id} p={p} counts={countsFor(p)} />
          ))}
          <div className="card proj-new">
            <div style={{ textAlign: "center", color: "var(--tx-dim)" }}>
              <Plus size={22} style={{ color: "var(--acc-bright)" }} />
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--tx-mid)",
                  marginTop: 8,
                }}
              >
                Connect a repository
              </div>
              <div
                style={{ fontSize: 11.5, marginTop: 3 }}
                className="mono"
              >
                github · gitlab · bitbucket
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
