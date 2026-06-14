"use client";

import { ShieldCheck, Users } from "lucide-react";
import * as React from "react";

import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/states";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { absoluteTime } from "@/lib/time";
import { formatUsd, initials } from "@/lib/utils";

import { CopyButton } from "./_components/copy-button";
import { TokenManager } from "./_components/token-manager";
import { canManage, useActiveTeam } from "./_components/use-active-team";

import type { Membership } from "@/lib/api-types";
import type { MembershipRole } from "@shipyard/core";

/** Badge variant per role. */
const ROLE_VARIANT: Record<
  MembershipRole,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  OWNER: "info",
  ADMIN: "success",
  MEMBER: "muted",
  VIEWER: "muted",
};

/** A labelled key/value row in the team overview card. */
function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-medium">
        {children}
      </span>
    </div>
  );
}

/** Overview of the active team: name, slug, budget, identifier. */
function TeamOverviewCard({
  membership,
}: {
  membership: Membership;
}): React.JSX.Element {
  const team = membership.team;
  if (!team) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Team details are unavailable.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          {team.name}
        </CardTitle>
        <CardDescription>Workspace settings and billing.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        <InfoRow label="Slug">
          <span className="font-mono text-xs">{team.slug}</span>
        </InfoRow>
        <InfoRow label="Monthly budget">
          {team.budgetUsdMonthly != null ? (
            formatUsd(team.budgetUsdMonthly)
          ) : (
            <span className="text-muted-foreground">No budget set</span>
          )}
        </InfoRow>
        <InfoRow label="Your role">
          <Badge variant={ROLE_VARIANT[membership.role]}>
            {membership.role}
          </Badge>
        </InfoRow>
        <InfoRow label="Created">
          <span className="text-muted-foreground">
            {absoluteTime(team.createdAt)}
          </span>
        </InfoRow>
        <div className="flex items-center justify-between gap-4 py-2.5">
          <span className="text-sm text-muted-foreground">Team ID</span>
          <span className="inline-flex items-center gap-1">
            <span className="font-mono text-xs">{team.id}</span>
            <CopyButton value={team.id} label="Copy team ID" size="icon" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/** Lists the current user's memberships (the teams they belong to). */
function MembershipsCard({
  memberships,
  activeTeamId,
}: {
  memberships: Membership[];
  activeTeamId: string | null;
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          Your teams
        </CardTitle>
        <CardDescription>
          Teams you belong to and your role on each.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberships.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-7">
                      <AvatarFallback className="text-[10px]">
                        {initials(m.team?.name ?? m.teamId)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {m.team?.name ?? m.teamId}
                        {m.teamId === activeTeamId ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (current)
                          </span>
                        ) : null}
                      </p>
                      {m.team?.slug ? (
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {m.team.slug}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={ROLE_VARIANT[m.role]}>{m.role}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * The Team settings page: a team selector (when the user belongs to several),
 * an overview of the active team (slug, budget, your role, identifier), the list
 * of teams you belong to with your role on each, and the active team's API
 * tokens. All data is client-fetched. Renders loading, empty, and error states.
 */
export default function TeamSettingsPage(): React.JSX.Element {
  const {
    memberships,
    teamId,
    active,
    role,
    setTeamId,
    isLoading,
    error,
    refresh,
  } = useActiveTeam();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team settings"
        description="Manage your team, members, and API access."
        actions={
          memberships.length > 1 && teamId ? (
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="w-[14rem]">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {memberships.map((m) => (
                  <SelectItem key={m.teamId} value={m.teamId}>
                    {m.team?.name ?? m.teamId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingSkeleton rows={3} variant="cards" />
      ) : error ? (
        <ErrorState
          title="Couldn't load your teams"
          description={error.message}
          onRetry={refresh}
        />
      ) : memberships.length === 0 || !active || !teamId ? (
        <EmptyState
          icon={Users}
          title="No teams"
          description="You don't belong to any teams yet."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <TeamOverviewCard membership={active} />
            <MembershipsCard
              memberships={memberships}
              activeTeamId={teamId}
            />
          </div>
          <Card>
            <CardContent className="p-6">
              <TokenManager
                teamId={teamId}
                canManageTokens={canManage(role)}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
