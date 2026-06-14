"use client";

import {
  ChevronDown,
  ChevronRight,
  GitCommit,
  PartyPopper,
  RotateCw,
  Search,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, ApiError } from "@/lib/api";
import { useDeployments } from "@/lib/hooks";
import { absoluteTime, relativeTime } from "@/lib/time";
import { cn, formatDuration, shortSha } from "@/lib/utils";

import type { Build, Deployment } from "@/lib/api-types";
import type { BuildStatus } from "@shipyard/core";

/** A deployment row that is guaranteed to carry a build summary. */
interface BuiltDeployment extends Deployment {
  build: Build;
}

/** Whether a deployment row has an attached build summary. */
function hasBuild(d: Deployment): d is BuiltDeployment {
  return d.build != null;
}

/** Local display metadata for {@link BuildStatus} (core ships no build map). */
const BUILD_STATUS_KIND: Record<
  BuildStatus,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  PENDING: { label: "Pending", variant: "muted" },
  RUNNING: { label: "Running", variant: "info" },
  SUCCEEDED: { label: "Succeeded", variant: "success" },
  FAILED: { label: "Failed", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "muted" },
};

/** A status pill for a build's lifecycle status. */
function BuildStatusBadge({ status }: { status: BuildStatus }): React.JSX.Element {
  const meta = BUILD_STATUS_KIND[status] ?? {
    label: status,
    variant: "muted" as const,
  };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

/**
 * The build error summary: a monospace block, truncated to one line by default
 * with an inline expand/collapse toggle when it overflows.
 */
function ErrorSummary({ text }: { text: string }): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const trimmed = text.trim();

  return (
    <div className="max-w-xl">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="group flex w-full items-start gap-1.5 rounded-md text-left text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {expanded ? (
          <ChevronDown className="mt-0.5 size-3.5 shrink-0 opacity-60 transition-colors group-hover:opacity-100" />
        ) : (
          <ChevronRight className="mt-0.5 size-3.5 shrink-0 opacity-60 transition-colors group-hover:opacity-100" />
        )}
        <code
          className={cn(
            "block min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed",
            !expanded && "truncate whitespace-nowrap",
          )}
        >
          {trimmed}
        </code>
      </button>
    </div>
  );
}

/** Props for {@link BuildRow}. */
interface BuildRowProps {
  deployment: BuiltDeployment;
  /** Whether to render the build status badge column (the "all" view). */
  showStatus: boolean;
  /** Whether a retry is currently in flight for this row. */
  retrying: boolean;
  /** Open the retry confirmation for this row. */
  onRetry: () => void;
}

/** A single build row in the table. */
function BuildRow({
  deployment,
  showStatus,
  retrying,
  onRetry,
}: BuildRowProps): React.JSX.Element {
  const { build } = deployment;
  const previewName =
    deployment.preview?.name ?? deployment.preview?.slug ?? "Unknown preview";
  const canRetry =
    build.status === "FAILED" || deployment.status === "FAILED";

  return (
    <TableRow>
      {showStatus ? (
        <TableCell className="align-top">
          <Link href={`/deployments/${deployment.id}`}>
            <BuildStatusBadge status={build.status} />
          </Link>
        </TableCell>
      ) : null}
      <TableCell className="align-top">
        <Link
          href={`/deployments/${deployment.id}`}
          className="font-medium hover:underline"
        >
          {previewName}
        </Link>
      </TableCell>
      <TableCell className="align-top">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1.5 font-mono text-xs">
              <GitCommit className="size-3.5 shrink-0 text-muted-foreground" />
              {shortSha(deployment.commitSha)}
            </span>
          </TooltipTrigger>
          <TooltipContent className="font-mono text-xs">
            {deployment.commitSha}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="align-top">
        {build.errorSummary ? (
          <ErrorSummary text={build.errorSummary} />
        ) : (
          <span className="text-xs text-muted-foreground">
            {build.status === "SUCCEEDED" ? "No errors" : "—"}
          </span>
        )}
      </TableCell>
      <TableCell className="align-top text-xs">
        {formatDuration(build.durationMs)}
      </TableCell>
      <TableCell className="align-top text-xs text-muted-foreground">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              {relativeTime(build.finishedAt ?? deployment.queuedAt)}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {absoluteTime(build.finishedAt ?? deployment.queuedAt)}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="align-top text-right">
        <Button
          variant="outline"
          size="sm"
          disabled={!canRetry || retrying}
          onClick={onRetry}
          aria-label={`Retry build for ${previewName}`}
        >
          <RotateCw className={cn("size-3.5", retrying && "animate-spin")} />
          Retry
        </Button>
      </TableCell>
    </TableRow>
  );
}

/**
 * The Builds page: a failed-build-focused triage view. By default it lists
 * deployments whose container build failed — showing the preview, commit, the
 * build's error summary (monospace, expandable), when it failed, and a Retry
 * action that re-deploys the preview's current commit. A toggle reveals all
 * builds (succeeded + failed) with status badges. Renders loading, empty, and
 * error states.
 */
export default function BuildsPage(): React.JSX.Element {
  const [showAll, setShowAll] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [retryTarget, setRetryTarget] = React.useState<BuiltDeployment | null>(
    null,
  );
  const [retryingId, setRetryingId] = React.useState<string | null>(null);

  // Fetch a generous page of recent deployments; each row carries a build
  // summary. We filter to builds (and to failures) on the client so toggling
  // views is instant and does not refetch.
  const deployments = useDeployments({ limit: 100 });

  const all = deployments.data?.data ?? [];

  const rows = React.useMemo(() => {
    const withBuilds = all.filter(hasBuild);
    const scoped = showAll
      ? withBuilds
      : withBuilds.filter((d) => d.build.status === "FAILED");
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((d) => {
      const name = d.preview?.name ?? d.preview?.slug ?? "";
      return (
        name.toLowerCase().includes(q) ||
        d.commitSha.toLowerCase().includes(q)
      );
    });
  }, [all, showAll, query]);

  const failedCount = React.useMemo(
    () => all.filter(hasBuild).filter((d) => d.build.status === "FAILED").length,
    [all],
  );

  /** Re-deploy the preview behind a failed build, with a toast on completion. */
  const confirmRetry = async (): Promise<void> => {
    if (!retryTarget) return;
    const target = retryTarget;
    setRetryingId(target.id);
    try {
      await api.redeployPreview(target.previewId);
      toast.success("Redeploy queued", {
        description: target.preview?.name
          ? `Rebuilding ${target.preview.name}.`
          : undefined,
      });
      void deployments.mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Retry failed");
    } finally {
      setRetryingId(null);
    }
  };

  const isFiltering = query.trim().length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Builds"
        description="Triage failed container builds and re-run them in one click."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter preview or commit"
                aria-label="Filter builds by preview or commit"
                className="w-[14rem] pl-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-all-builds"
                checked={showAll}
                onCheckedChange={setShowAll}
              />
              <Label
                htmlFor="show-all-builds"
                className="cursor-pointer whitespace-nowrap text-sm font-normal text-muted-foreground"
              >
                Show all builds
              </Label>
            </div>
          </div>
        }
      />

      {!deployments.isLoading && !deployments.error && !showAll ? (
        <p className="text-sm text-muted-foreground">
          {failedCount === 0
            ? "All recent builds are passing."
            : `${failedCount} failed ${failedCount === 1 ? "build" : "builds"} in the last 100 deployments.`}
        </p>
      ) : null}

      {deployments.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : deployments.error ? (
        <ErrorState
          description={deployments.error.message}
          onRetry={() => void deployments.mutate()}
        />
      ) : rows.length === 0 ? (
        isFiltering ? (
          <EmptyState
            icon={Search}
            title="No matching builds"
            description="No builds match your filter. Try a different preview name or commit."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuery("")}
              >
                Clear filter
              </Button>
            }
          />
        ) : showAll ? (
          <EmptyState
            title="No builds yet"
            description="Builds appear here as previews build and deploy."
          />
        ) : (
          <EmptyState
            icon={PartyPopper}
            title="No failed builds 🎉"
            description="Every recent build is green. Flip “Show all builds” to see the full history."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAll(true)}
              >
                Show all builds
              </Button>
            }
          />
        )
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {showAll ? <TableHead className="w-[7rem]">Status</TableHead> : null}
                <TableHead>Preview</TableHead>
                <TableHead className="w-[8rem]">Commit</TableHead>
                <TableHead>{showAll ? "Build" : "Error"}</TableHead>
                <TableHead className="w-[6rem]">Duration</TableHead>
                <TableHead className="w-[9rem]">When</TableHead>
                <TableHead className="w-[6rem] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <BuildRow
                  key={d.id}
                  deployment={d}
                  showStatus={showAll}
                  retrying={retryingId === d.id}
                  onRetry={() => setRetryTarget(d)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={retryTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRetryTarget(null);
        }}
        title="Retry this build?"
        description={
          <>
            This re-deploys{" "}
            <span className="font-medium text-foreground">
              {retryTarget?.preview?.name ??
                retryTarget?.preview?.slug ??
                "the preview"}
            </span>{" "}
            at commit{" "}
            <span className="font-mono text-foreground">
              {shortSha(retryTarget?.commitSha)}
            </span>
            , queuing a fresh build and deploy.
          </>
        }
        confirmLabel="Retry build"
        onConfirm={confirmRetry}
      />
    </div>
  );
}
