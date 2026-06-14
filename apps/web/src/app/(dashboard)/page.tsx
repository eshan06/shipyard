"use client";

import {
  Activity,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  Rocket,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";


import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useCostSummary,
  useDeployments,
  usePreviews,
} from "@/lib/hooks";
import { relativeTime } from "@/lib/time";
import { cn, formatUsd, shortSha } from "@/lib/utils";

import type { Deployment, Preview } from "@/lib/api-types";
import type { LucideIcon } from "lucide-react";

/** A single KPI stat card with an icon, value, and label. */
function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  loading?: boolean;
}): React.JSX.Element {
  const toneClass = {
    default: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
    info: "text-info",
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <div className="h-8 w-16 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
          )}
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg bg-muted",
            toneClass,
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

/** A compact recent-deployment row. */
function DeploymentRow({ d }: { d: Deployment }): React.JSX.Element {
  return (
    <Link
      href={`/deployments/${d.id}`}
      className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent"
    >
      <div className="flex min-w-0 items-center gap-3">
        <StatusBadge status={d.status} kind="deployment" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {d.preview?.name ?? d.preview?.slug ?? "Deployment"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-mono">{shortSha(d.commitSha)}</span> ·{" "}
            {relativeTime(d.queuedAt)}
          </p>
        </div>
      </div>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

/** A compact active-preview card. */
function PreviewCard({ p }: { p: Preview }): React.JSX.Element {
  return (
    <Link
      href={`/previews/${p.id}`}
      className="flex flex-col gap-2 rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{p.name}</span>
        <StatusBadge status={p.status} kind="preview" />
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {p.project.name}
        {p.branch ? ` · ${p.branch}` : ""}
      </p>
    </Link>
  );
}

/**
 * The Overview page: top-line KPI stat cards (active previews, running /
 * building / failed counts, deployments today, estimated monthly cost) plus a
 * recent-deployments list and an active-previews grid. Every section has its own
 * loading, empty, and error states.
 */
export default function OverviewPage(): React.JSX.Element {
  const previews = usePreviews({ limit: 100 });
  const deployments = useDeployments({ limit: 8 });
  const costs = useCostSummary();

  const all = previews.data?.data ?? [];
  const active = all.filter((p) => p.statusDisplay.isActive);
  const running = all.filter((p) => p.status === "RUNNING").length;
  const building = all.filter(
    (p) => p.status === "BUILDING" || p.status === "DEPLOYING",
  ).length;
  const failed = all.filter((p) => p.status === "FAILED").length;

  const startOfToday = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const deploysToday = (deployments.data?.data ?? []).filter(
    (d) => new Date(d.queuedAt).getTime() >= startOfToday,
  ).length;

  return (
    <div className="space-y-8">
      <OnboardingChecklist />

      <PageHeader
        title="Overview"
        description="A live snapshot of your preview environments and recent activity."
        actions={
          <Button asChild>
            <Link href="/previews">
              <Boxes className="size-4" />
              View previews
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Boxes}
          label="Active previews"
          value={active.length}
          hint={`${all.length} total`}
          tone="info"
          loading={previews.isLoading}
        />
        <StatCard
          icon={Activity}
          label="Running"
          value={running}
          hint={`${building} building`}
          tone="success"
          loading={previews.isLoading}
        />
        <StatCard
          icon={Rocket}
          label="Deploys today"
          value={deploysToday}
          hint={failed > 0 ? `${failed} failed previews` : "All healthy"}
          tone={failed > 0 ? "warning" : "default"}
          loading={deployments.isLoading}
        />
        <StatCard
          icon={CircleDollarSign}
          label="Est. monthly cost"
          value={formatUsd(costs.data?.totalUsd ?? 0)}
          hint="Current period"
          tone="default"
          loading={costs.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent deployments */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent deployments</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/deployments">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {deployments.isLoading ? (
              <LoadingSkeleton rows={4} />
            ) : deployments.error ? (
              <ErrorState
                description={deployments.error.message}
                onRetry={() => void deployments.mutate()}
              />
            ) : (deployments.data?.data.length ?? 0) === 0 ? (
              <EmptyState
                icon={Rocket}
                title="No deployments yet"
                description="Deployments will appear here as previews are created."
              />
            ) : (
              <div className="-mx-3 divide-y divide-border/60">
                {deployments.data?.data.map((d) => (
                  <DeploymentRow key={d.id} d={d} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active previews */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Active previews</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/previews">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {previews.isLoading ? (
              <LoadingSkeleton rows={4} />
            ) : previews.error ? (
              <ErrorState
                description={previews.error.message}
                onRetry={() => void previews.mutate()}
              />
            ) : active.length === 0 ? (
              <EmptyState
                icon={failed > 0 ? TriangleAlert : Boxes}
                title="No active previews"
                description="Open a pull request or create a preview to get started."
                action={
                  <Button asChild size="sm">
                    <Link href="/previews">Go to previews</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {active.slice(0, 6).map((p) => (
                  <PreviewCard key={p.id} p={p} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
