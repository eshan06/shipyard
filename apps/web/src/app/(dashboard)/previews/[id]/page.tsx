"use client";

import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  GitCommit,
  Pin,
  PinOff,
  RotateCw,
  Square,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { LogViewer } from "@/components/log-viewer";
import { ErrorState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import { api, ApiError } from "@/lib/api";
import {
  usePreview,
  usePreviewCosts,
  usePreviewDeployments,
  usePreviewEnv,
  usePreviewReviews,
} from "@/lib/hooks";
import { previewOpenTarget } from "@/lib/preview-link";
import { usePreviewStatus } from "@/lib/sse";
import { absoluteTime, relativeTime } from "@/lib/time";
import {
  cn,
  formatDuration,
  formatUsd,
  initials,
  shortSha,
} from "@/lib/utils";

import type { PreviewDetail, Service } from "@/lib/api-types";

/** A labelled metadata pill used in the detail header. */
function MetaItem({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      {children}
    </span>
  );
}

/** Health indicator + status badge for a service row. */
function ServiceRow({ s }: { s: Service }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{s.name}</span>
          <Badge variant="outline" className="text-[10px] uppercase">
            {s.type}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {s.image ?? "—"}
          {s.ports.length > 0 ? ` · ports ${s.ports.join(", ")}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {s.restartCount > 0 ? (
          <span className="text-xs text-muted-foreground">
            {s.restartCount} restarts
          </span>
        ) : null}
        <StatusBadge status={s.status} kind="service" />
      </div>
    </div>
  );
}

/** The header + action toolbar for a preview. */
function PreviewHeader({
  preview,
  liveUrl,
  liveStatus,
  onRefresh,
}: {
  preview: PreviewDetail;
  liveUrl: string | null;
  liveStatus: string;
  onRefresh: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [stopOpen, setStopOpen] = React.useState(false);
  const [destroyOpen, setDestroyOpen] = React.useState(false);

  const url = liveUrl ?? preview.url;

  /** Maps an action label to its product-analytics event name. */
  const ACTION_EVENTS: Record<string, string> = {
    pin: ANALYTICS_EVENTS.previewPinned,
    redeploy: ANALYTICS_EVENTS.previewRedeployed,
    stop: ANALYTICS_EVENTS.previewStopped,
    destroy: ANALYTICS_EVENTS.previewDestroyed,
  };

  /** Run a preview action with optimistic refresh + toasts. */
  const run = async (
    label: string,
    fn: () => Promise<unknown>,
    success: string,
  ): Promise<void> => {
    setBusy(label);
    try {
      await fn();
      const event = ACTION_EVENTS[label];
      if (event) trackEvent(event, { previewId: preview.id });
      toast.success(success);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `${label} failed`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
        onClick={() => router.push("/previews")}
      >
        <ArrowLeft className="size-4" />
        Previews
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-semibold tracking-tight">
              {preview.name}
            </h2>
            <StatusBadge status={liveStatus} kind="preview" />
            {preview.isPinned ? (
              <Badge variant="info" className="gap-1">
                <Pin className="size-3" />
                Pinned
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <MetaItem icon={<GitBranch className="size-3.5" />}>
              <span className="font-mono">{preview.branch ?? "—"}</span>
            </MetaItem>
            <MetaItem icon={<GitCommit className="size-3.5" />}>
              <span className="font-mono">{shortSha(preview.commitSha)}</span>
            </MetaItem>
            <MetaItem icon={<span aria-hidden>·</span>}>
              {preview.project.name}
            </MetaItem>
            <MetaItem icon={<span aria-hidden>·</span>}>
              updated {relativeTime(preview.updatedAt)}
            </MetaItem>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {url ? (
            <Button asChild variant="outline">
              <a
                href={previewOpenTarget({ id: preview.id, url }).href ?? url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open
                <ExternalLink className="size-4" />
              </a>
            </Button>
          ) : null}
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              void run(
                "pin",
                () => api.pinPreview(preview.id, !preview.isPinned),
                preview.isPinned ? "Preview unpinned" : "Preview pinned",
              )
            }
          >
            {preview.isPinned ? (
              <PinOff className="size-4" />
            ) : (
              <Pin className="size-4" />
            )}
            {preview.isPinned ? "Unpin" : "Pin"}
          </Button>
          <Button
            disabled={busy !== null}
            onClick={() =>
              void run(
                "redeploy",
                () => api.redeployPreview(preview.id),
                "Redeploy queued",
              )
            }
          >
            <RotateCw
              className={cn("size-4", busy === "redeploy" && "animate-spin")}
            />
            Redeploy
          </Button>
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => setStopOpen(true)}
          >
            <Square className="size-4" />
            Stop
          </Button>
          <Button
            variant="destructive"
            disabled={busy !== null}
            onClick={() => setDestroyOpen(true)}
          >
            <Trash2 className="size-4" />
            Destroy
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        title="Stop this preview?"
        description="The environment will be torn down but its record kept, so it can be redeployed later."
        confirmLabel="Stop preview"
        onConfirm={() =>
          run("stop", () => api.stopPreview(preview.id), "Stop queued")
        }
      />
      <ConfirmDialog
        open={destroyOpen}
        onOpenChange={setDestroyOpen}
        title="Destroy this preview?"
        description="This permanently tears down the environment and its resources. This cannot be undone."
        confirmLabel="Destroy preview"
        confirmVariant="destructive"
        onConfirm={() =>
          run("destroy", () => api.destroyPreview(preview.id), "Destroy queued")
        }
      />
    </div>
  );
}

/**
 * The Preview detail page: a header with live status + wired action buttons
 * (pin/redeploy/stop/destroy, with optimistic refresh, toasts, and confirm
 * dialogs for destructive actions), tabbed sections for Services, Deployments,
 * Reviewers, Env vars (secrets masked), and Cost, plus a live logs panel that
 * streams the latest deployment's output over SSE.
 */
export default function PreviewDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;

  // Active tab drives lazy data fetching: the preview detail response already
  // includes `services` inline, and the other tabs' data is only fetched once
  // that tab is opened — so opening the page costs 2 requests (preview +
  // deployments-for-logs), not 6.
  const [tab, setTab] = React.useState("services");

  const { data: preview, error, isLoading, mutate } = usePreview(id);
  const deployments = usePreviewDeployments(id); // also feeds the live-logs panel
  const reviews = usePreviewReviews(tab === "reviewers" ? id : null);
  const env = usePreviewEnv(tab === "env" ? id : null);
  const costs = usePreviewCosts(tab === "cost" ? id : null);

  // Live status overlays the fetched snapshot for instant updates.
  const { event: statusEvent } = usePreviewStatus(id);
  const liveStatus = statusEvent?.status ?? preview?.status ?? "QUEUED";
  const liveUrl = statusEvent?.url ?? null;

  // A live status event means the world changed behind the snapshot: a
  // redeploy created a new Deployment row (the logs panel must switch to it)
  // and service states moved (Starting → Healthy). Revalidate both so the
  // page tracks reality without a manual refresh. Keyed on the EVENT OBJECT
  // (a fresh object per SSE message), not the status string — consecutive
  // events can carry the same status (e.g. RUNNING → redeploy → RUNNING)
  // and must still retrigger.
  const revalidateDeployments = deployments.mutate;
  // The stream's first message is a prime (current status sent on connect),
  // not a transition — SWR just fetched the same data, so skip it.
  const primedRef = React.useRef(false);
  React.useEffect(() => {
    if (!statusEvent) return;
    if (!primedRef.current) {
      primedRef.current = true;
      return;
    }
    void mutate();
    void revalidateDeployments();
    // Trailing settle: a fast deploy emits BUILDING→DEPLOYING→RUNNING within
    // SWR's 2s dedupe window, so the immediate revalidations above can all
    // join one in-flight fetch that captured a MID-deploy snapshot (stale
    // services/updatedAt). Refetch once more after the burst quiets — the
    // timer resets on every event so only the final transition pays it.
    const settle = window.setTimeout(() => {
      void mutate();
      void revalidateDeployments();
    }, 2_500);
    return () => window.clearTimeout(settle);
  }, [statusEvent, mutate, revalidateDeployments]);

  const latestDeploymentId = deployments.data?.data[0]?.id ?? null;

  if (error) {
    return (
      <ErrorState
        title="Couldn't load preview"
        description={error.message}
        onRetry={() => void mutate()}
      />
    );
  }

  if (isLoading || !preview) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PreviewHeader
        preview={preview}
        liveUrl={liveUrl}
        liveStatus={liveStatus}
        onRefresh={() => {
          void mutate();
          void revalidateDeployments();
        }}
      />

      <div className="space-y-6">
        {/* Tabbed detail */}
        <div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex w-full flex-wrap justify-start">
              <TabsTrigger value="services">
                Services
                <Badge variant="muted" className="ml-2">
                  {preview.serviceCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="deployments">Deployments</TabsTrigger>
              <TabsTrigger value="reviewers">
                Reviewers
                <Badge variant="muted" className="ml-2">
                  {preview.reviewerCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="env">Env vars</TabsTrigger>
              <TabsTrigger value="cost">Cost</TabsTrigger>
            </TabsList>

            {/* Services (included inline in the preview detail response) */}
            <TabsContent value="services" className="mt-4 space-y-3">
              {preview.services.map((s) => (
                <ServiceRow key={s.id} s={s} />
              ))}
              {preview.services.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No services have been provisioned yet.
                </p>
              ) : null}
            </TabsContent>

            {/* Deployments timeline */}
            <TabsContent value="deployments" className="mt-4">
              <div className="space-y-2">
                {(deployments.data?.data ?? []).map((d) => (
                  <Link
                    key={d.id}
                    href={`/deployments/${d.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border p-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge status={d.status} kind="deployment" />
                      <div>
                        <p className="text-sm font-medium">
                          <span className="font-mono">
                            {shortSha(d.commitSha)}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            · {d.trigger}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {relativeTime(d.queuedAt)} ·{" "}
                          {formatDuration(d.durationMs)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
                {(deployments.data?.data.length ?? 0) === 0 ? (
                  <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No deployments yet.
                  </p>
                ) : null}
              </div>
            </TabsContent>

            {/* Reviewers */}
            <TabsContent value="reviewers" className="mt-4 space-y-2">
              {(reviews.data?.data ?? []).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      {r.avatarUrl ? (
                        <AvatarImage src={r.avatarUrl} alt={r.login} />
                      ) : null}
                      <AvatarFallback className="text-xs">
                        {initials(r.login)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{r.login}</span>
                  </div>
                  <Badge
                    variant={
                      r.state === "APPROVED"
                        ? "success"
                        : r.state === "CHANGES_REQUESTED"
                          ? "destructive"
                          : "muted"
                    }
                  >
                    {r.state.replace(/_/g, " ").toLowerCase()}
                  </Badge>
                </div>
              ))}
              {(reviews.data?.data.length ?? 0) === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No reviewers assigned.
                </p>
              ) : null}
            </TabsContent>

            {/* Env vars */}
            <TabsContent value="env" className="mt-4">
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Target</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(env.data?.data ?? []).map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">
                          {v.key}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {v.isSecret ? "••••••••" : (v.value ?? "")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {v.scope}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {v.target}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(env.data?.data.length ?? 0) === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    No environment variables.
                  </p>
                ) : null}
              </div>
            </TabsContent>

            {/* Cost */}
            <TabsContent value="cost" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Estimated cost</span>
                    <span className="text-lg">
                      {formatUsd(costs.data?.totalUsd ?? 0)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(costs.data?.data ?? []).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {absoluteTime(c.periodStart)}
                      </span>
                      <span className="font-medium">
                        {formatUsd(c.estimatedUsd, 4)}
                      </span>
                    </div>
                  ))}
                  {(costs.data?.data.length ?? 0) === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No cost records yet.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Live logs — full width below the tabs */}
        <div className="space-y-2">
          <LogViewer
            deploymentId={latestDeploymentId}
            title="Latest deployment logs"
            heightClass="h-80"
          />
          <p className="text-xs text-muted-foreground">
            Streaming the most recent deployment. Logs auto-scroll; scroll up to
            pause following.
          </p>
        </div>
      </div>
    </div>
  );
}
