"use client";

import {
  Archive,
  ArrowUpDown,
  FolderGit2,
  GitBranch,
  Github,
  Layers,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";


import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/lib/hooks";
import { relativeTime } from "@/lib/time";

import type { Project } from "@/lib/api-types";

/** Visibility filter for the archived toggle. */
type ArchivedFilter = "active" | "archived" | "all";

/** A single project card in the responsive grid. */
function ProjectCard({ p }: { p: Project }): React.JSX.Element {
  return (
    <Card className="group transition-colors hover:border-primary/40">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/projects/${p.id}`}
              className="block truncate text-sm font-semibold hover:underline"
            >
              {p.name}
            </Link>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Github className="size-3.5 shrink-0" />
              <span className="truncate">{p.repoFullName}</span>
            </p>
          </div>
          {p.isArchived ? (
            <Badge variant="muted" className="gap-1 shrink-0">
              <Archive className="size-3" />
              Archived
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
              {p.provider}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <GitBranch className="size-3.5 shrink-0" />
            <span className="truncate font-mono">{p.defaultBranch}</span>
          </span>
          {p.framework ? (
            <span className="inline-flex items-center gap-1.5">
              <Layers className="size-3.5 shrink-0" />
              <span className="truncate capitalize">{p.framework}</span>
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">
            Updated {relativeTime(p.updatedAt)}
          </span>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/projects/${p.id}`}>Manage</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The Projects list page: a searchable, responsive grid of project cards
 * showing repo, framework, default branch, provider, and archive state, each
 * linking to its detail/settings page. Renders loading, empty, and error
 * states.
 */
export default function ProjectsPage(): React.JSX.Element {
  const projects = useProjects();
  const [query, setQuery] = React.useState("");
  const [archived, setArchived] = React.useState<ArchivedFilter>("active");

  const all = projects.data?.data ?? [];

  const items = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all
      .filter((p) => {
        if (archived === "active" && p.isArchived) return false;
        if (archived === "archived" && !p.isArchived) return false;
        return true;
      })
      .filter((p) => {
        if (!needle) return true;
        return (
          p.name.toLowerCase().includes(needle) ||
          p.repoFullName.toLowerCase().includes(needle) ||
          (p.framework ?? "").toLowerCase().includes(needle)
        );
      });
  }, [all, query, archived]);

  const isFiltered = query.trim() !== "" || archived !== "active";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Connected repositories and their preview-environment settings."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects…"
                aria-label="Search projects"
                className="w-[12rem]"
              />
            </div>
            <Select
              value={archived}
              onValueChange={(v) => setArchived(v as ArchivedFilter)}
            >
              <SelectTrigger className="w-[9rem]" aria-label="Archive filter">
                <ArrowUpDown className="size-3.5 opacity-60" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {projects.isLoading ? (
        <LoadingSkeleton variant="cards" rows={6} />
      ) : projects.error ? (
        <ErrorState
          description={projects.error.message}
          onRetry={() => void projects.mutate()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title={isFiltered ? "No matching projects" : "No projects yet"}
          description={
            isFiltered
              ? "No projects match the current search or filters."
              : "Connect a repository to start creating preview environments for its pull requests."
          }
          action={
            isFiltered ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setArchived("active");
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
