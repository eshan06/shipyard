/**
 * Serializer + row type for the audit router.
 *
 * Co-located with `routes/audit.ts`. Follows the global serializer convention
 * (`lib/serialize.ts`): dates become ISO strings and we expose only the actor's
 * login (never the full user row).
 *
 * @module
 */

import type { AuditLog } from "@shipyard/db";

/** An `AuditLog` row with its actor's `githubLogin` selected. */
export type AuditLogRow = AuditLog & {
  actor: { githubLogin: string | null } | null;
};

/** Wire shape of an audit-log entry. Dates are ISO strings. */
export interface AuditLogDto {
  id: string;
  teamId: string | null;
  actorId: string | null;
  /** The acting user's GitHub login, when known (system actions have none). */
  actorLogin: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
}

/**
 * Serialize an `AuditLog` row (with its actor login) into its public DTO.
 *
 * @param log - An `AuditLog` row including `actor.githubLogin`.
 * @returns The {@link AuditLogDto}.
 */
export function toAuditLogDto(log: AuditLogRow): AuditLogDto {
  return {
    id: log.id,
    teamId: log.teamId,
    actorId: log.actorId,
    actorLogin: log.actor?.githubLogin ?? null,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    metadata: log.metadata,
    createdAt: log.createdAt.toISOString(),
  };
}
