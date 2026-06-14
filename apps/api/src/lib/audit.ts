/**
 * Audit-log writer.
 *
 * Mutations that change important state record an {@link AuditLog} row (who did
 * what, to which resource). This is best-effort context for operators and the
 * dashboard, so callers `await` it inside their handler but it is intentionally
 * a thin wrapper — keep the metadata free of secret values.
 *
 * @module
 */

import type { Prisma, PrismaClient } from "@shipyard/db";

/**
 * Parameters for an audit-log entry. All fields except `action` are optional so
 * the helper fits both team-scoped and system actions.
 */
export interface AuditEntry {
  /** Owning team, when the action is team-scoped. */
  teamId?: string;
  /** The acting user (omit for system/anonymous actions). */
  actorId?: string;
  /** Stable action verb, e.g. `"team.create"` or `"preview.destroy"`. */
  action: string;
  /** Resource kind, e.g. `"Team"`, `"Preview"`. */
  targetType?: string;
  /** Resource id the action targeted. */
  targetId?: string;
  /** Extra structured context (must not contain secret values). */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Write an {@link AuditLog} row.
 *
 * @param prisma - The Prisma client to write through.
 * @param entry - The audit entry to persist.
 * @returns The created audit log row's id.
 */
export async function writeAudit(
  prisma: PrismaClient,
  entry: AuditEntry,
): Promise<string> {
  const row = await prisma.auditLog.create({
    data: {
      teamId: entry.teamId,
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata ?? {},
    },
    select: { id: true },
  });
  return row.id;
}
