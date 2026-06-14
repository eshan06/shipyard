"use client";

import { CircleDollarSign, FolderGit2, TriangleAlert, Users } from "lucide-react";
import * as React from "react";

import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCostSummary } from "@/lib/hooks";
import { absoluteTime } from "@/lib/time";
import { cn, formatUsd } from "@/lib/utils";

import { CostByProjectChart, CostOverTimeChart } from "./_components/charts";

import type { CostSummary } from "@/lib/api-types";
import type { LucideIcon } from "lucide-react";

/** A compact KPI card for a single headline metric. */
function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "warning" | "danger";
}): React.JSX.Element {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={cn("text-2xl font-semibold tracking-tight", toneClass)}>
            {value}
          </p>
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}

/** A per-team budget row with a usage bar. */
function TeamBudgetRow({
  team,
}: {
  team: CostSummary["teams"][number];
}): React.JSX.Element {
  const pct =
    team.budgetUsedFraction != null
      ? Math.min(100, Math.round(team.budgetUsedFraction * 100))
      : null;

  return (
    <div className="space-y-2 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          {team.teamName}
          {team.overBudget ? (
            <Badge variant="destructive" className="gap-1">
              <TriangleAlert className="size-3" />
              Over budget
            </Badge>
          ) : null}
        </span>
        <span className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {formatUsd(team.spendUsd)}
          </span>
          {team.budgetUsdMonthly != null ? (
            <> {" / "}{formatUsd(team.budgetUsdMonthly)}</>
          ) : (
            <> {" "}(no budget)</>
          )}
        </span>
      </div>
      {pct != null ? (
        <Progress
          value={pct}
          className={cn(team.overBudget && "[&>div]:bg-destructive")}
        />
      ) : null}
    </div>
  );
}

/**
 * The Costs page: a usage + spend overview for the current month. Shows headline
 * KPIs (total spend, projects, teams over budget), a spend-over-time area chart,
 * a spend-by-project bar chart, per-team budget bars, and a per-project spend
 * table. All data is client-fetched via {@link useCostSummary}. Renders loading,
 * empty, and error states.
 */
export default function CostsPage(): React.JSX.Element {
  const costs = useCostSummary();
  const summary = costs.data;

  const overBudgetCount = React.useMemo(
    () => summary?.teams.filter((t) => t.overBudget).length ?? 0,
    [summary],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Costs"
        description="Estimated compute spend for the current billing month."
        actions={
          summary ? (
            <span className="text-xs text-muted-foreground">
              {absoluteTime(summary.periodStart)} —{" "}
              {absoluteTime(summary.periodEnd)}
            </span>
          ) : undefined
        }
      />

      {costs.isLoading ? (
        <LoadingSkeleton rows={3} variant="cards" />
      ) : costs.error ? (
        <ErrorState
          description={costs.error.message}
          onRetry={() => void costs.mutate()}
        />
      ) : !summary ? (
        <EmptyState
          icon={CircleDollarSign}
          title="No cost data yet"
          description="Spend appears here once previews start consuming compute."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={CircleDollarSign}
              label="Total spend"
              value={formatUsd(summary.totalUsd)}
              hint="Month to date"
            />
            <StatCard
              icon={FolderGit2}
              label="Projects with spend"
              value={summary.byProject.length}
            />
            <StatCard
              icon={overBudgetCount > 0 ? TriangleAlert : Users}
              label="Teams over budget"
              value={overBudgetCount}
              tone={overBudgetCount > 0 ? "danger" : "default"}
              hint={`${summary.teams.length} ${summary.teams.length === 1 ? "team" : "teams"} total`}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Spend over time</CardTitle>
                <CardDescription>Estimated USD per day.</CardDescription>
              </CardHeader>
              <CardContent>
                {summary.byDay.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No daily spend recorded yet.
                  </p>
                ) : (
                  <CostOverTimeChart data={summary.byDay} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Spend by project</CardTitle>
                <CardDescription>Top projects this month.</CardDescription>
              </CardHeader>
              <CardContent>
                {summary.byProject.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No project spend recorded yet.
                  </p>
                ) : (
                  <CostByProjectChart data={summary.byProject} />
                )}
              </CardContent>
            </Card>
          </div>

          {summary.teams.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Team budgets</CardTitle>
                <CardDescription>
                  Spend against each team&apos;s monthly budget.
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                {summary.teams.map((team) => (
                  <TeamBudgetRow key={team.teamId} team={team} />
                ))}
              </CardContent>
            </Card>
          ) : null}

          {summary.byProject.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>By project</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Estimated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.byProject.map((p) => (
                      <TableRow key={p.projectId}>
                        <TableCell className="font-medium">
                          {p.projectName}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatUsd(p.estimatedUsd)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
