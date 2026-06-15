/**
 * Create / update Data Transfer Object (DTO) schemas for the Shipyard domain
 * aggregates, mirroring `packages/db/prisma/schema.prisma`.
 *
 * Conventions:
 * - `*CreateSchema` validates the client-supplied subset for a new row
 *   (server-managed fields such as `id`, timestamps, status are omitted).
 * - `*UpdateSchema` is the partial of the mutable fields, requiring at least
 *   one key so empty PATCH bodies are rejected.
 * - Each schema exports its inferred TypeScript type.
 *
 * @module
 */

import { z } from "zod";

import { CuidSchema, EnvKeySchema, SlugSchema } from "./common.js";
import {
  DeploymentTriggerSchema,
  EnvScopeSchema,
  EnvTargetSchema,
  MembershipRoleSchema,
  RepoProviderSchema,
  SeedKindSchema,
} from "./enums.js";

/**
 * Require that an "update" object has at least one defined key, so a PATCH with
 * an empty body is rejected as a no-op.
 *
 * @param schema - A `ZodObject` (typically built with `.partial()`).
 * @returns The same schema refined to reject empty objects.
 */
function requireAtLeastOneKey<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.refine(
    (value) => Object.values(value).some((v) => v !== undefined),
    { message: "At least one field must be provided" },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Team
// ─────────────────────────────────────────────────────────────────────────────

/** DTO for creating a {@link Team}. */
export const TeamCreateSchema = z.object({
  name: z.string().min(1, "name is required").max(120),
  slug: SlugSchema,
  avatarUrl: z.string().url().optional(),
  /** Optional monthly budget cap in USD (maps to `Team.budgetUsdMonthly`). */
  budgetUsdMonthly: z.number().nonnegative().optional(),
});
/** Inferred type for {@link TeamCreateSchema}. */
export type TeamCreateInput = z.infer<typeof TeamCreateSchema>;

/** DTO for updating a {@link Team}. */
export const TeamUpdateSchema = requireAtLeastOneKey(
  TeamCreateSchema.partial(),
);
/** Inferred type for {@link TeamUpdateSchema}. */
export type TeamUpdateInput = z.infer<typeof TeamUpdateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Project
// ─────────────────────────────────────────────────────────────────────────────

/** DTO for creating a {@link Project} (a connected repo). */
export const ProjectCreateSchema = z.object({
  teamId: CuidSchema,
  name: z.string().min(1, "name is required").max(120),
  slug: SlugSchema,
  provider: RepoProviderSchema.default("GITHUB"),
  /** `owner/repo`, e.g. `acme/storefront`. */
  repoFullName: z
    .string()
    .min(1)
    .regex(/^[^/\s]+\/[^/\s]+$/, "repoFullName must be in 'owner/repo' form"),
  repoId: z.string().optional(),
  installationId: z.string().optional(),
  defaultBranch: z.string().min(1).default("main"),
  framework: z.string().max(64).optional(),
  rootDirectory: z.string().min(1).default("."),
  /** Free-form build/deploy configuration JSON. */
  config: z.record(z.string(), z.unknown()).default({}),
  autoDeployPrs: z.boolean().default(true),
  autoStopMinutes: z.number().int().min(0).default(120),
  destroyTtlMinutes: z.number().int().min(0).default(60),
});
/** Inferred type for {@link ProjectCreateSchema}. */
export type ProjectCreateInput = z.infer<typeof ProjectCreateSchema>;

/**
 * DTO for updating a {@link Project}. `teamId` is omitted (projects cannot be
 * reparented via update) and `isArchived` is added for archive/unarchive.
 */
export const ProjectUpdateSchema = requireAtLeastOneKey(
  ProjectCreateSchema.omit({ teamId: true })
    .extend({ isArchived: z.boolean() })
    .partial(),
);
/** Inferred type for {@link ProjectUpdateSchema}. */
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Preview
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO for creating a {@link Preview}. `status`, `url`, and timestamps are
 * server-managed; `slug` is typically derived from the branch but may be
 * supplied explicitly.
 */
export const PreviewCreateSchema = z.object({
  projectId: CuidSchema,
  pullRequestId: CuidSchema.optional(),
  name: z.string().min(1, "name is required").max(120),
  slug: SlugSchema.optional(),
  commitSha: z.string().min(7).max(64).optional(),
  branch: z.string().min(1).max(255).optional(),
  isPinned: z.boolean().default(false),
  autoStopMinutes: z.number().int().min(0).default(120),
});
/** Inferred type for {@link PreviewCreateSchema}. */
export type PreviewCreateInput = z.infer<typeof PreviewCreateSchema>;

/**
 * DTO for updating a {@link Preview}. Limited to client-mutable settings —
 * status transitions are driven by the worker (see `status.ts`), not PATCH.
 */
export const PreviewUpdateSchema = requireAtLeastOneKey(
  z
    .object({
      name: z.string().min(1).max(120),
      isPinned: z.boolean(),
      autoStopMinutes: z.number().int().min(0),
    })
    .partial(),
);
/** Inferred type for {@link PreviewUpdateSchema}. */
export type PreviewUpdateInput = z.infer<typeof PreviewUpdateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Deployment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO for creating a {@link Deployment}. `status` and timing fields are
 * server-managed.
 */
export const DeploymentCreateSchema = z.object({
  previewId: CuidSchema,
  commitSha: z.string().min(7, "commitSha is required").max(64),
  trigger: DeploymentTriggerSchema.default("PR_SYNC"),
  createdById: CuidSchema.optional(),
});
/** Inferred type for {@link DeploymentCreateSchema}. */
export type DeploymentCreateInput = z.infer<typeof DeploymentCreateSchema>;

/**
 * DTO for updating a {@link Deployment}. Used by the worker to record progress
 * and outcome; status here is a free enum (transition validity is enforced via
 * `status.ts`, not this schema).
 */
export const DeploymentUpdateSchema = requireAtLeastOneKey(
  z
    .object({
      startedAt: z.coerce.date(),
      finishedAt: z.coerce.date(),
      durationMs: z.number().int().min(0),
      errorSummary: z.string().max(4096),
    })
    .partial(),
);
/** Inferred type for {@link DeploymentUpdateSchema}. */
export type DeploymentUpdateInput = z.infer<typeof DeploymentUpdateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// EnvVar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO for creating an {@link EnvVar}. The client supplies the *plaintext*
 * `value`; the service encrypts it into `valueEncrypted` before persisting.
 *
 * Exactly one of `projectId` / `previewId` must be set, consistent with the
 * `scope`: PROJECT-scoped vars attach to a project, PREVIEW-scoped to a preview.
 */
export const EnvVarCreateSchema = z
  .object({
    projectId: CuidSchema.optional(),
    previewId: CuidSchema.optional(),
    scope: EnvScopeSchema.default("PROJECT"),
    target: EnvTargetSchema.default("BOTH"),
    key: EnvKeySchema,
    /** Plaintext value; encrypted server-side. Never returned in responses. */
    value: z.string().max(64 * 1024, "value is too large"),
    isSecret: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    const hasProject = val.projectId !== undefined;
    const hasPreview = val.previewId !== undefined;
    if (hasProject === hasPreview) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly one of projectId or previewId must be provided",
        path: hasProject ? ["previewId"] : ["projectId"],
      });
    }
    if (val.scope === "PROJECT" && !hasProject) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PROJECT-scoped env vars require projectId",
        path: ["projectId"],
      });
    }
    if (val.scope === "PREVIEW" && !hasPreview) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PREVIEW-scoped env vars require previewId",
        path: ["previewId"],
      });
    }
  });
/** Inferred type for {@link EnvVarCreateSchema}. */
export type EnvVarCreateInput = z.infer<typeof EnvVarCreateSchema>;

/**
 * DTO for updating an {@link EnvVar}. Only the value/target/secret-flag are
 * mutable; the key and scope/owner are fixed for the lifetime of the row.
 */
export const EnvVarUpdateSchema = requireAtLeastOneKey(
  z
    .object({
      value: z.string().max(64 * 1024),
      target: EnvTargetSchema,
      isSecret: z.boolean(),
    })
    .partial(),
);
/** Inferred type for {@link EnvVarUpdateSchema}. */
export type EnvVarUpdateInput = z.infer<typeof EnvVarUpdateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// SeedTemplate
// ─────────────────────────────────────────────────────────────────────────────

/** DTO for creating a {@link SeedTemplate}. */
export const SeedTemplateCreateSchema = z.object({
  projectId: CuidSchema,
  name: z.string().min(1, "name is required").max(120),
  kind: SeedKindSchema.default("SQL"),
  /** Inline SQL, a script path, or a snapshot reference (per `kind`). */
  source: z.string().min(1, "source is required"),
  isDefault: z.boolean().default(false),
});
/** Inferred type for {@link SeedTemplateCreateSchema}. */
export type SeedTemplateCreateInput = z.infer<typeof SeedTemplateCreateSchema>;

/** DTO for updating a {@link SeedTemplate}. */
export const SeedTemplateUpdateSchema = requireAtLeastOneKey(
  SeedTemplateCreateSchema.omit({ projectId: true }).partial(),
);
/** Inferred type for {@link SeedTemplateUpdateSchema}. */
export type SeedTemplateUpdateInput = z.infer<typeof SeedTemplateUpdateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// ApiToken
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DTO for creating an {@link ApiToken}. The raw token is generated server-side
 * and returned exactly once; only its hash/prefix are persisted, so no token
 * value is accepted here.
 */
export const ApiTokenCreateSchema = z.object({
  teamId: CuidSchema,
  userId: CuidSchema.optional(),
  name: z.string().min(1, "name is required").max(120),
  /** Permission scopes, e.g. `["previews:read", "previews:write"]`. */
  scopes: z.array(z.string().min(1)).default([]),
  /** Optional expiry; coerced from ISO string. Must be in the future. */
  expiresAt: z.coerce
    .date()
    .refine((d) => d.getTime() > Date.now(), "expiresAt must be in the future")
    .optional(),
});
/** Inferred type for {@link ApiTokenCreateSchema}. */
export type ApiTokenCreateInput = z.infer<typeof ApiTokenCreateSchema>;

/**
 * DTO for updating an {@link ApiToken}. Tokens are largely immutable; only the
 * display name and scopes can change (rotation = revoke + create new).
 */
export const ApiTokenUpdateSchema = requireAtLeastOneKey(
  z
    .object({
      name: z.string().min(1).max(120),
      scopes: z.array(z.string().min(1)),
    })
    .partial(),
);
/** Inferred type for {@link ApiTokenUpdateSchema}. */
export type ApiTokenUpdateInput = z.infer<typeof ApiTokenUpdateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Membership (helper DTO for team invitations / role changes)
// ─────────────────────────────────────────────────────────────────────────────

/** DTO for adding/updating a team membership role. */
export const MembershipUpsertSchema = z.object({
  userId: CuidSchema,
  teamId: CuidSchema,
  role: MembershipRoleSchema.default("MEMBER"),
});
/** Inferred type for {@link MembershipUpsertSchema}. */
export type MembershipUpsertInput = z.infer<typeof MembershipUpsertSchema>;
