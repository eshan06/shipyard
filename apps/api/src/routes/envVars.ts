/**
 * Env-vars router — SECURITY CRITICAL.
 *
 * Owns env-var CRUD for projects and previews:
 *
 *  - `GET    /projects/:id/env`  list a project's env vars (VIEWER)
 *  - `POST   /projects/:id/env`  create a PROJECT-scoped env var (MEMBER)
 *  - `GET    /previews/:id/env`  list a preview's env vars (VIEWER)
 *  - `POST   /previews/:id/env`  create a PREVIEW-scoped env var (MEMBER)
 *  - `PATCH  /env/:id`           update an env var (MEMBER)
 *  - `DELETE /env/:id`           delete an env var (MEMBER)
 *
 * ## Secret handling (do not regress)
 *
 * The plaintext `value` a client supplies is encrypted with AES-256-GCM
 * (`@shipyard/core` {@link encryptSecret}) using `app.config.SECRETS_ENCRYPTION_KEY`
 * and stored only in `EnvVar.valueEncrypted`. The API **never** returns
 * `valueEncrypted`, and never returns the plaintext of a *secret* var: the DTO
 * sets `value: null` when `isSecret` is true (masked). Non-secret vars are
 * decrypted on read so the dashboard can show their value. Audit entries record
 * the key but never the value.
 *
 * Follows the canonical pattern in `routes/teams.ts`:
 * schema → auth (`app.requireAuth`) → RBAC (`lib/rbac`) → Prisma →
 * serialize → audit (`lib/audit`).
 *
 * @module
 */

import { z } from "zod";

import {
  ConflictError,
  EnvKeySchema,
  EnvScopeSchema,
  EnvTargetSchema,
  EnvVarUpdateSchema,
  ForbiddenError,
  NotFoundError,
  PaginationQuerySchema,
  decryptSecret,
  encryptSecret,
} from "@shipyard/core";
import { Prisma } from "@shipyard/db";

import { writeAudit } from "../lib/audit.js";
import { paginate } from "../lib/pagination.js";
import {
  requireTeamRole,
  teamIdForPreview,
  teamIdForProject,
} from "../lib/rbac.js";
import { requireScope } from "../lib/scopes.js";

import { ErrorResponseSchema, listResponse } from "./schemas.js";

import type { EnvVar } from "@shipyard/db";
import type { FastifyInstance } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

// ── Schemas ───────────────────────────────────────────────────────────────

/** Path-params schema for owner-scoped routes (`/projects/:id/env`, `/previews/:id/env`). */
const OwnerParamsSchema = z.object({ id: z.string().min(1) });

/** Path-params schema for the `/env/:id` routes. */
const EnvVarParamsSchema = z.object({ id: z.string().min(1) });

/**
 * Request body for creating an env var under a route-derived owner.
 *
 * The owning project/preview and the `scope` are determined by the URL, so —
 * unlike the core `EnvVarCreateSchema` — the body only carries the mutable
 * fields. The plaintext `value` is encrypted server-side and never echoed back.
 */
const EnvVarCreateBodySchema = z.object({
  key: EnvKeySchema,
  /** Plaintext value; encrypted server-side. Never returned in responses. */
  value: z.string().max(64 * 1024, "value is too large"),
  target: EnvTargetSchema.default("BOTH"),
  isSecret: z.boolean().default(false),
});

/**
 * Response schema for a single env var DTO.
 *
 * `value` is the decrypted plaintext for non-secret vars, and `null` when the
 * var is a secret (masked). `valueEncrypted` is never part of the wire shape.
 */
const EnvVarResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
  scope: EnvScopeSchema,
  target: EnvTargetSchema,
  isSecret: z.boolean(),
  value: z.string().nullable(),
});

// ── Serialization ───────────────────────────────────────────────────────────

/** The wire shape of an {@link EnvVar}. Secret values are masked to `null`. */
interface EnvVarDto {
  id: string;
  key: string;
  scope: EnvVar["scope"];
  target: EnvVar["target"];
  isSecret: boolean;
  value: string | null;
}

/**
 * Serialize an {@link EnvVar} row into its public DTO.
 *
 * SECURITY: never emits `valueEncrypted`. The plaintext is decrypted (with
 * `key`, the base64 encryption key) and returned **only** for non-secret vars;
 * secret vars are masked with `value: null`.
 *
 * @param row - A Prisma `EnvVar` row.
 * @param key - The base64 `SECRETS_ENCRYPTION_KEY` used to decrypt non-secrets.
 * @returns The {@link EnvVarDto}.
 */
function toEnvVarDto(row: EnvVar, key: string): EnvVarDto {
  return {
    id: row.id,
    key: row.key,
    scope: row.scope,
    target: row.target,
    isSecret: row.isSecret,
    value: row.isSecret ? null : decryptSecret(row.valueEncrypted, key),
  };
}

// ── Router ────────────────────────────────────────────────────────────────

/**
 * The env-vars router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const envVarsRoutes: FastifyPluginAsyncZod = async (app) => {
  const encryptionKey = app.config.SECRETS_ENCRYPTION_KEY;

  // ── List a project's env vars (VIEWER) ──────────────────────────────────
  app.get(
    "/projects/:id/env",
    {
      preHandler: requireScope("env:read"),
      schema: {
        tags: ["env"],
        summary: "List a project's env vars (secrets masked)",
        params: OwnerParamsSchema,
        querystring: PaginationQuerySchema,
        response: {
          200: listResponse(EnvVarResponseSchema),
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id: projectId } = request.params;
      const { cursor, limit, order } = request.query;

      const teamId = await teamIdForProject(app.prisma, projectId);
      await requireTeamRole(app, request, teamId, "VIEWER");

      const page = await paginate(app.prisma.envVar, {
        cursor,
        limit,
        order,
        where: { projectId },
      });

      return {
        data: page.data.map((row) => toEnvVarDto(row, encryptionKey)),
        nextCursor: page.nextCursor,
      };
    },
  );

  // ── Create a PROJECT-scoped env var (MEMBER) ─────────────────────────────
  app.post(
    "/projects/:id/env",
    {
      preHandler: requireScope("env:write"),
      schema: {
        tags: ["env"],
        summary: "Create a PROJECT-scoped env var",
        params: OwnerParamsSchema,
        body: EnvVarCreateBodySchema,
        response: {
          201: EnvVarResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: projectId } = request.params;
      const { key, value, target, isSecret } = request.body;

      const teamId = await teamIdForProject(app.prisma, projectId);
      await requireTeamRole(app, request, teamId, "MEMBER");

      let row;
      try {
        row = await app.prisma.envVar.create({
          data: {
            projectId,
            scope: "PROJECT",
            target,
            key,
            valueEncrypted: encryptSecret(value, encryptionKey),
            isSecret,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new ConflictError(
            `An env var with key "${key}" already exists for this project`,
          );
        }
        throw err;
      }

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: "envVar.create",
        targetType: "EnvVar",
        targetId: row.id,
        // Never log the value; record only non-sensitive descriptors.
        metadata: { key: row.key, scope: row.scope, isSecret: row.isSecret },
      });

      reply.status(201);
      return toEnvVarDto(row, encryptionKey);
    },
  );

  // ── List a preview's env vars (VIEWER) ───────────────────────────────────
  app.get(
    "/previews/:id/env",
    {
      preHandler: requireScope("env:read"),
      schema: {
        tags: ["env"],
        summary: "List a preview's env vars (secrets masked)",
        params: OwnerParamsSchema,
        querystring: PaginationQuerySchema,
        response: {
          200: listResponse(EnvVarResponseSchema),
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id: previewId } = request.params;
      const { cursor, limit, order } = request.query;

      const teamId = await teamIdForPreview(app.prisma, previewId);
      await requireTeamRole(app, request, teamId, "VIEWER");

      const page = await paginate(app.prisma.envVar, {
        cursor,
        limit,
        order,
        where: { previewId },
      });

      return {
        data: page.data.map((row) => toEnvVarDto(row, encryptionKey)),
        nextCursor: page.nextCursor,
      };
    },
  );

  // ── Create a PREVIEW-scoped env var (MEMBER) ─────────────────────────────
  app.post(
    "/previews/:id/env",
    {
      preHandler: requireScope("env:write"),
      schema: {
        tags: ["env"],
        summary: "Create a PREVIEW-scoped env var",
        params: OwnerParamsSchema,
        body: EnvVarCreateBodySchema,
        response: {
          201: EnvVarResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: previewId } = request.params;
      const { key, value, target, isSecret } = request.body;

      const teamId = await teamIdForPreview(app.prisma, previewId);
      await requireTeamRole(app, request, teamId, "MEMBER");

      let row;
      try {
        row = await app.prisma.envVar.create({
          data: {
            previewId,
            scope: "PREVIEW",
            target,
            key,
            valueEncrypted: encryptSecret(value, encryptionKey),
            isSecret,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new ConflictError(
            `An env var with key "${key}" already exists for this preview`,
          );
        }
        throw err;
      }

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: "envVar.create",
        targetType: "EnvVar",
        targetId: row.id,
        metadata: { key: row.key, scope: row.scope, isSecret: row.isSecret },
      });

      reply.status(201);
      return toEnvVarDto(row, encryptionKey);
    },
  );

  // ── Update an env var (MEMBER) ───────────────────────────────────────────
  app.patch(
    "/env/:id",
    {
      preHandler: requireScope("env:write"),
      schema: {
        tags: ["env"],
        summary: "Update an env var (re-encrypts when a new value is supplied)",
        params: EnvVarParamsSchema,
        body: EnvVarUpdateSchema,
        response: {
          200: EnvVarResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const body = request.body;

      const teamId = await teamIdForEnvVar(app.prisma, id);
      await requireTeamRole(app, request, teamId, "MEMBER");

      // Read the current isSecret so we can detect (and refuse) a secret -> non
      // -secret downgrade that does not also re-supply the value. Without this,
      // a MEMBER could flip isSecret to false and then GET the previously-masked
      // plaintext, defeating the "secret values are never returned" guarantee.
      const current = await app.prisma.envVar.findUnique({
        where: { id },
        select: { isSecret: true },
      });
      if (!current) throw new NotFoundError("EnvVar", id);

      const downgradingSecret =
        current.isSecret &&
        body.isSecret === false &&
        body.value === undefined;
      if (downgradingSecret) {
        throw new ForbiddenError(
          "Unmasking a secret requires re-supplying its value in the same request",
        );
      }

      const data: Prisma.EnvVarUpdateInput = {};
      if (body.value !== undefined) {
        // Re-encrypt fresh ciphertext for the new plaintext.
        data.valueEncrypted = encryptSecret(body.value, encryptionKey);
      }
      if (body.target !== undefined) data.target = body.target;
      if (body.isSecret !== undefined) data.isSecret = body.isSecret;

      let row;
      try {
        row = await app.prisma.envVar.update({ where: { id }, data });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2025"
        ) {
          throw new NotFoundError("EnvVar", id);
        }
        throw err;
      }

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: "envVar.update",
        targetType: "EnvVar",
        targetId: row.id,
        // Field names only — never the value itself.
        metadata: { key: row.key, fields: Object.keys(data) },
      });

      return toEnvVarDto(row, encryptionKey);
    },
  );

  // ── Delete an env var (MEMBER) ───────────────────────────────────────────
  app.delete(
    "/env/:id",
    {
      preHandler: requireScope("env:write"),
      schema: {
        tags: ["env"],
        summary: "Delete an env var",
        params: EnvVarParamsSchema,
        response: {
          204: z.null(),
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const teamId = await teamIdForEnvVar(app.prisma, id);
      await requireTeamRole(app, request, teamId, "MEMBER");

      let row;
      try {
        row = await app.prisma.envVar.delete({
          where: { id },
          select: { key: true },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2025"
        ) {
          throw new NotFoundError("EnvVar", id);
        }
        throw err;
      }

      await writeAudit(app.prisma, {
        teamId,
        actorId: request.auth!.userId,
        action: "envVar.delete",
        targetType: "EnvVar",
        targetId: id,
        metadata: { key: row.key },
      });

      reply.status(204);
      return null;
    },
  );
};

/**
 * Resolve the owning team id for an env var (via its project or preview).
 *
 * An env var is owned by exactly one of a project or a preview; this walks
 * whichever owner is set back to its team. Defined locally because env vars are
 * the only resource that can be owned by either aggregate.
 *
 * @param prisma - Prisma client (the env-var + RBAC resolver surface).
 * @param envVarId - The env var id.
 * @returns The owning `Team.id`.
 * @throws NotFoundError when the env var (or its resolved owner) does not exist.
 */
async function teamIdForEnvVar(
  prisma: FastifyInstance["prisma"],
  envVarId: string,
): Promise<string> {
  const envVar = await prisma.envVar.findUnique({
    where: { id: envVarId },
    select: { projectId: true, previewId: true },
  });
  if (!envVar) throw new NotFoundError("EnvVar", envVarId);

  if (envVar.projectId !== null) {
    return teamIdForProject(prisma, envVar.projectId);
  }
  if (envVar.previewId !== null) {
    return teamIdForPreview(prisma, envVar.previewId);
  }
  // An env var with neither owner is a data-integrity violation; treat as 404.
  throw new NotFoundError("EnvVar", envVarId);
}
