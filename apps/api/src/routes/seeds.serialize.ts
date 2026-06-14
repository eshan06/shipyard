/**
 * Serializers + zod response schemas local to the seed-templates router.
 *
 * Kept co-located (rather than in the shared `lib/serialize.ts` /
 * `routes/schemas.ts`) so the seeds router owns its wire contract. Follows the
 * project-wide convention: dates are ISO strings, and handlers return these
 * DTOs rather than raw Prisma rows.
 *
 * @module
 */

import { z } from "zod";

import { SeedKindSchema } from "@shipyard/core";

import { iso } from "../lib/serialize.js";

import type { SeedTemplate } from "@shipyard/db";

/**
 * The wire shape of a {@link SeedTemplate}. Dates are ISO strings.
 */
export interface SeedTemplateDto {
  id: string;
  projectId: string;
  name: string;
  kind: SeedTemplate["kind"];
  source: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Serialize a {@link SeedTemplate} row into its public DTO (normalises dates).
 *
 * @param seed - A Prisma `SeedTemplate` row.
 * @returns The {@link SeedTemplateDto}.
 */
export function toSeedTemplateDto(seed: SeedTemplate): SeedTemplateDto {
  return {
    id: seed.id,
    projectId: seed.projectId,
    name: seed.name,
    kind: seed.kind,
    source: seed.source,
    isDefault: seed.isDefault,
    createdAt: iso(seed.createdAt)!,
    updatedAt: iso(seed.updatedAt)!,
  };
}

/** Response schema for a single {@link SeedTemplateDto}. */
export const SeedTemplateResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  kind: SeedKindSchema,
  source: z.string(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
