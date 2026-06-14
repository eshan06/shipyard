"use client";

import { Rocket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  DEPLOYMENT_STATUS_DISPLAY,
  type DeploymentStatus,
} from "@shipyard/core";

import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeployments } from "@/lib/hooks";
import { relativeTime } from "@/lib/time";
import { formatDuration, shortSha } from "@/lib/utils";


/** Sentinel select value meaning "no filter". */
const ALL = "__all__";

/**
 * The Deployments page: a filterable table of recent deployments with status,
 * commit, trigger, duration, and a link to each deployment's detail (live
 * logs). Renders loading, empty, and error states.
 */
export default function DeploymentsPage(): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = React.useState<string>(ALL);
  const deployments = useDeployments({
    status: status === ALL ? undefined : (status as DeploymentStatus),
    limit: 50,
  });
  const items = deployments.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deployments"
        description="Build-and-start runs across all your previews."
        actions={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[11rem]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {(
                Object.keys(DEPLOYMENT_STATUS_DISPLAY) as DeploymentStatus[]
              ).map((s) => (
                <SelectItem key={s} value={s}>
                  {DEPLOYMENT_STATUS_DISPLAY[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {deployments.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : deployments.error ? (
        <ErrorState
          description={deployments.error.message}
          onRetry={() => void deployments.mutate()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="No deployments"
          description="Deployments appear here as previews build and deploy."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Preview</TableHead>
                <TableHead>Commit</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Queued</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => {
                const href = `/deployments/${d.id}`;
                const previewName = d.preview?.name ?? d.preview?.slug ?? "—";
                return (
                  <TableRow
                    key={d.id}
                    className="cursor-pointer focus-within:bg-accent/40 hover:bg-accent/40"
                    onClick={() => router.push(href)}
                  >
                    <TableCell>
                      <StatusBadge status={d.status} kind="deployment" />
                    </TableCell>
                    <TableCell>
                      {/* The single real link: gives the row an accessible,
                          keyboard-focusable navigation target. Stop propagation
                          so the row's onClick doesn't double-navigate. */}
                      <Link
                        href={href}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                      >
                        {previewName}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {shortSha(d.commitSha)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.trigger}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDuration(d.durationMs)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {relativeTime(d.queuedAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
