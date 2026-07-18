/**
 * Resolve a preview's environment variables from the database.
 *
 * Projects and previews store configuration + secrets as {@link EnvVar} rows
 * whose values are AES-256-GCM ciphertext. The deploy worker must decrypt these
 * and inject them into the preview plan, otherwise real preview apps start with
 * only the hardcoded defaults and any app needing an API key/config value fails.
 *
 * Precedence (later wins): project-scoped vars → preview-scoped vars, so a
 * preview override beats the project default.
 *
 * @module
 */

import { decryptSecret } from "@shipyard/core";

import type { PrismaClient } from "@shipyard/db";
import type { Logger } from "pino";

/**
 * Load and decrypt the effective runtime env for a preview.
 *
 * @param db - Prisma client.
 * @param args - Project + preview ids and the secrets key.
 * @param logger - Logger for undecryptable rows (skipped, not fatal).
 * @returns A flat `KEY=value` map ready to merge into the plan's `env`.
 */
export async function resolvePreviewEnv(
  db: PrismaClient,
  args: { projectId: string; previewId: string; encryptionKey: string },
  logger: Logger,
): Promise<Record<string, string>> {
  const rows = await db.envVar.findMany({
    where: {
      // RUNTIME + BOTH targets apply to the running container (BUILD-only vars
      // are for image builds; we merge everything non-build here for now).
      OR: [{ projectId: args.projectId }, { previewId: args.previewId }],
    },
    select: {
      key: true,
      valueEncrypted: true,
      scope: true,
      target: true,
      projectId: true,
      previewId: true,
    },
  });

  // Project scope first, preview scope last so preview overrides win.
  const ordered = [...rows].sort((a, b) => {
    const rank = (r: (typeof rows)[number]) => (r.previewId === args.previewId ? 1 : 0);
    return rank(a) - rank(b);
  });

  const env: Record<string, string> = {};
  for (const row of ordered) {
    if (row.target === "BUILD") continue; // build-only vars are not runtime env
    try {
      env[row.key] = decryptSecret(row.valueEncrypted, args.encryptionKey);
    } catch (err) {
      // A single undecryptable row (wrong/rotated key, corrupt ciphertext) must
      // not abort the whole deploy — skip it and surface a warning.
      logger.warn({ err, key: row.key }, "env var decrypt failed; skipping");
    }
  }
  return env;
}
