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
import { ErrorState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, ApiError } from "@/lib/api";
import { useDeployment } from "@/lib/hooks";
import { absoluteTime, relativeTime } from "@/lib/time";
import { cn, formatDuration, shortSha } from "@/lib/utils";

import type { Build, Deployment } from "@/lib/api-types";
import type { BuildStatus } from "@shipyard/core";

/** Deployment statuses that may still be cancelled. */
const CANCELLABLE = new Set(["QUEUED", "BUILDING", "DEPLOYING"]);

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

/** A labelled key/value row. */
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
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-sm font-medium">
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
  const meta = BUILD_STATUS_KIND[status] ?? {
    label: status,
    variant: "muted" as const,
  };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

/** The build summary card: status, image tag, cache, exit code, error. */
function BuildCard({ build }: { build: Build }): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hammer className="size-4 text-muted-foreground" />
          Build
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <MetaRow icon={<span aria-hidden>·</span>} label="Status">
          <BuildStatusBadge status={build.status} />
        </MetaRow>
        <MetaRow icon={<Package className="size-4" />} label="Image">
          {build.imageTag ? (
            <span className="font-mono text-xs">{build.imageTag}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </MetaRow>
        <MetaRow icon={<Zap className="size-4" />} label="Cache">
          {build.cacheHit ? (
            <Badge variant="success">Hit</Badge>
          ) : (
            <span className="text-muted-foreground">Miss</span>
          )}
        </MetaRow>
        <MetaRow icon={<Clock className="size-4" />} label="Duration">
          {formatDuration(build.durationMs)}
        </MetaRow>
        {build.exitCode != null ? (
          <MetaRow icon={<span aria-hidden>·</span>} label="Exit code">
            <span className="font-mono">{build.exitCode}</span>
          </MetaRow>
        ) : null}
        {build.errorSummary ? (
          <div className="pt-3">
            <p className="mb-1.5 text-xs font-medium text-destructive">
              Error summary
            </p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-destructive/5 p-3 font-mono text-xs leading-relaxed text-destructive">
              {build.errorSummary.trim()}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
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
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
        onClick={() => router.push("/deployments")}
      >
        <ArrowLeft className="size-4" />
        Deployments
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-semibold tracking-tight">
              {previewName ?? "Deployment"}
            </h2>
            <StatusBadge status={deployment.status} kind="deployment" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <GitCommit className="size-3.5" />
              <span className="font-mono">{shortSha(deployment.commitSha)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="size-3.5" />
              {deployment.trigger}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" />
              {relativeTime(deployment.queuedAt)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {deployment.preview ? (
            <Button asChild variant="outline">
              <Link href={`/previews/${deployment.previewId}`}>
                <Boxes className="size-4" />
                Preview
              </Link>
            </Button>
          ) : null}
          {canCancel ? (
            <Button variant="destructive" onClick={onCancel}>
              <CircleSlash className="size-4" />
              Cancel
            </Button>
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
      <ErrorState
        title="Couldn't load deployment"
        description={error.message}
        onRetry={() => void mutate()}
      />
    );
  }

  if (isLoading || !deployment) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
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
    <div className="space-y-8">
      <DeploymentDetailHeader
        deployment={deployment}
        onCancel={() => setConfirmCancel(true)}
      />

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <MetaRow icon={<GitCommit className="size-4" />} label="Commit">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-mono text-xs">
                      {shortSha(deployment.commitSha)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="font-mono text-xs">
                    {deployment.commitSha}
                  </TooltipContent>
                </Tooltip>
              </MetaRow>
              <MetaRow icon={<Zap className="size-4" />} label="Trigger">
                {deployment.trigger}
              </MetaRow>
              <MetaRow icon={<Clock className="size-4" />} label="Duration">
                {formatDuration(deployment.durationMs)}
              </MetaRow>
              <MetaRow icon={<span aria-hidden>·</span>} label="Queued">
                <span className="text-muted-foreground">
                  {absoluteTime(deployment.queuedAt)}
                </span>
              </MetaRow>
              <MetaRow icon={<span aria-hidden>·</span>} label="Started">
                <span className="text-muted-foreground">
                  {absoluteTime(deployment.startedAt)}
                </span>
              </MetaRow>
              <MetaRow icon={<span aria-hidden>·</span>} label="Finished">
                <span className="text-muted-foreground">
                  {absoluteTime(deployment.finishedAt)}
                </span>
              </MetaRow>
            </CardContent>
          </Card>

          {deployment.build ? <BuildCard build={deployment.build} /> : null}

          {deployment.errorSummary ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-destructive">Error</CardTitle>
              </CardHeader>
              <CardContent>
                <pre
                  className={cn(
                    "max-h-48 overflow-auto whitespace-pre-wrap break-words",
                    "rounded-md bg-destructive/5 p-3 font-mono text-xs",
                    "leading-relaxed text-destructive",
                  )}
                >
                  {deployment.errorSummary.trim()}
                </pre>
              </CardContent>
            </Card>
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
