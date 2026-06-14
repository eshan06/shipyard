"use client";

import * as React from "react";

import { useMe } from "@/lib/hooks";

import type { Membership } from "@/lib/api-types";
import type { MembershipRole } from "@shipyard/core";

/** Rank roles so we can default to the most-privileged membership. */
const ROLE_RANK: Record<MembershipRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
  VIEWER: 0,
};

/** Whether a role may manage tokens / edit the team (ADMIN or above). */
export function canManage(role: MembershipRole | undefined): boolean {
  return role === "ADMIN" || role === "OWNER";
}

/** The resolved active-team state returned by {@link useActiveTeam}. */
export interface ActiveTeam {
  /** The current user's memberships (each with its `team` relation). */
  memberships: Membership[];
  /** The selected team id (or `null` when the user has no teams). */
  teamId: string | null;
  /** The membership for the selected team. */
  active: Membership | undefined;
  /** The caller's role on the selected team. */
  role: MembershipRole | undefined;
  /** Select a different team by id. */
  setTeamId: (id: string) => void;
  /** True while `/me` is loading. */
  isLoading: boolean;
  /** A load error from `/me`, if any. */
  error: ReturnType<typeof useMe>["error"];
  /** Revalidate `/me`. */
  refresh: () => void;
}

/**
 * Resolve the "active" team for the settings page from the current user's
 * memberships. Defaults to the most-privileged membership (so admins land on a
 * team they can actually manage) and exposes a local selector so the user can
 * switch between their teams within the page.
 */
export function useActiveTeam(): ActiveTeam {
  const { data, error, isLoading, mutate } = useMe();
  const memberships = React.useMemo<Membership[]>(
    () => data?.memberships ?? [],
    [data],
  );

  const [teamId, setTeamId] = React.useState<string | null>(null);

  // Pick a sensible default once memberships arrive (or if the current
  // selection is no longer valid), preferring the highest-privileged team.
  React.useEffect(() => {
    if (memberships.length === 0) {
      if (teamId !== null) setTeamId(null);
      return;
    }
    const stillValid = memberships.some((m) => m.teamId === teamId);
    if (!stillValid) {
      const best = [...memberships].sort(
        (a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role],
      )[0];
      setTeamId(best?.teamId ?? null);
    }
  }, [memberships, teamId]);

  const active = memberships.find((m) => m.teamId === teamId);

  return {
    memberships,
    teamId,
    active,
    role: active?.role,
    setTeamId,
    isLoading,
    error,
    refresh: () => void mutate(),
  };
}
