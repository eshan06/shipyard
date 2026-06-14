"use client";

import {
  Boxes,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  Pin,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import {
  PREVIEW_STATUS_DISPLAY,
  type PreviewStatus,
} from "@shipyard/core";

import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePreviews, useProjects } from "@/lib/hooks";
import { relativeTime } from "@/lib/time";

import type { Preview } from "@/lib/api-types";

/** Sentinel select value meaning "no filter". */
const ALL = "__all__";

/** A single preview card in the responsive grid. */
function PreviewCard({ p }: { p: Preview }): React.JSX.Element {
  return (
    <Card className="group transition-colors hover:border-primary/40">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/previews/${p.id}`}
              className="flex items-center gap-1.5 truncate text-sm font-semibold hover:underline"
            >
              {p.isPinned ? (
                <Pin className="size-3.5 shrink-0 text-primary" />
              ) : null}
              {p.name}
            </Link>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {p.project.name}
            </p>
          </div>
          <StatusBadge status={p.status} kind="preview" />
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          {p.branch ? (
            <div className="flex items-center gap-1.5">
              <GitBranch className="size-3.5 shrink-0" />
              <span className="truncate font-mono">{p.branch}</span>
            </div>
          ) : null}
          {p.pullRequest ? (
            <div className="flex items-center gap-1.5">
              <GitPullRequest className="size-3.5 shrink-0" />
              <a
                href={p.pullRequest.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:text-foreground hover:underline"
              >
                #{p.pullRequest.number} {p.pullRequest.title}
              </a>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {relativeTime(p.lastActivityAt)}
          </span>
          <div className="flex items-center gap-1.5">
            {p.url ? (
              <Button asChild variant="outline" size="sm">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open preview"
                >
                  Open
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="ghost">
              <Link href={`/previews/${p.id}`}>Details</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The Previews list page: a responsive grid of preview cards with status +
 * project filters. Each card shows status, project, branch/PR, last activity,
 * and quick actions (open URL, details). Renders loading, empty, and error
 * states.
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Previews"
        description="Every live preview environment across your projects."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-[11rem]">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All projects</SelectItem>
                {projects.data?.data.map((proj) => (
                  <SelectItem key={proj.id} value={proj.id}>
                    {proj.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[10rem]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {(
                  Object.keys(PREVIEW_STATUS_DISPLAY) as PreviewStatus[]
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    {PREVIEW_STATUS_DISPLAY[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {previews.isLoading ? (
        <LoadingSkeleton variant="cards" rows={6} />
      ) : previews.error ? (
        <ErrorState
          description={previews.error.message}
          onRetry={() => void previews.mutate()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No previews found"
          description={
            status !== ALL || projectId !== ALL
              ? "No previews match the current filters. Try clearing them."
              : "Previews appear automatically when pull requests are opened."
          }
          action={
            status !== ALL || projectId !== ALL ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatus(ALL);
                  setProjectId(ALL);
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
            <PreviewCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
