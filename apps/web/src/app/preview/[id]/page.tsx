"use client";

/**
 * Standalone **simulated preview** page.
 *
 * With the mock deploy driver there is no real server behind a preview's
 * fabricated `*.preview.*` URL, so the dashboard's "Open" button routes here
 * instead of to a dead host (see {@link previewOpenTarget}). This renders a
 * believable "the environment is live" landing for the PR — outside the
 * dashboard layout group, so it has no sidebar and reads like a deployed app —
 * and surfaces the canonical URL that would serve the real app in production.
 *
 * @module
 */

import { ArrowLeft, CheckCircle2, GitBranch, GitCommit } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { ErrorState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreview } from "@/lib/hooks";
import { relativeTime } from "@/lib/time";

/** Short commit SHA for display. */
function shortSha(sha: string | null): string {
  return sha ? sha.slice(0, 7) : "—";
}

export default function SimulatedPreviewPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { data: preview, error, isLoading } = usePreview(id);

  return (
    <main className="min-h-screen bg-gradient-to-b from-muted/40 to-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <span aria-hidden className="text-base">
              ⚓
            </span>
            Shipyard preview environment
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-normal text-amber-600 dark:text-amber-400">
              simulated
            </span>
          </span>
          <Link
            href={`/previews/${id}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error || !preview ? (
          <ErrorState
            title="Preview not found"
            description="This preview may have been destroyed or you may not have access."
          />
        ) : (
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-7 text-success" aria-hidden />
                <h1 className="text-2xl font-semibold tracking-tight">
                  {preview.project.name} is live
                </h1>
                <StatusBadge status={preview.status} kind="preview" />
              </div>
              <p className="text-muted-foreground">
                {preview.pullRequest ? (
                  <>
                    Preview for pull request{" "}
                    <span className="font-medium text-foreground">
                      #{preview.pullRequest.number}
                    </span>{" "}
                    · {preview.pullRequest.title}
                  </>
                ) : (
                  <>Preview environment {preview.name}</>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <GitBranch className="size-4" aria-hidden />
                  {preview.branch ?? "—"}
                </span>
                <span className="flex items-center gap-1.5">
                  <GitCommit className="size-4" aria-hidden />
                  {shortSha(preview.commitSha)}
                </span>
                <span>updated {relativeTime(preview.updatedAt)}</span>
              </div>
            </div>

            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Services ({preview.services.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {preview.services.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{s.name}</span>
                      <StatusBadge status={s.status} kind="service" />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {s.type}
                      {s.ports.length > 0
                        ? ` · :${s.ports.join(", :")}`
                        : ""}
                    </div>
                  </div>
                ))}
                {preview.services.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No services provisioned.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
              <p>
                This is a <strong>simulated</strong> preview — the running stack
                is orchestrated by the mock deploy driver, so the application
                isn&apos;t actually served. In a real deployment
                (<code className="rounded bg-muted px-1">DEPLOY_DRIVER=docker</code>{" "}
                with wildcard DNS) this page is replaced by your live app at{" "}
                {preview.url ? (
                  <span className="break-all font-mono text-foreground">
                    {preview.url}
                  </span>
                ) : (
                  "the preview URL"
                )}
                .
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
