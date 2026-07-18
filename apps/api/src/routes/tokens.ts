/**
 * API-tokens router.
 *
 * Personal-access / CI tokens authenticate non-interactive callers. They are
 * team-scoped and managing them is a privileged, settings-level action, so
 * every endpoint requires the `ADMIN` role on the owning team.
 *
 * ## SECURITY
 *
 * - The raw token is generated server-side (`generateApiToken`) and returned to
 *   the client **exactly once** in the create response under the `token` field;
 *   only its SHA-256 hash and display prefix are persisted.
 * - The list endpoint surfaces **only** safe metadata (prefix, name, scopes,
 *   timestamps) — never the token or its hash.
 * - Audit entries never include the raw token value.
 *
 * Mounted under `/api/v1` with `app.requireAuth` applied (see `routes/index.ts`).
 *
 * Endpoints:
 *  - `GET    /teams/:id/tokens`            list non-revoked tokens (ADMIN)
 *  - `POST   /teams/:id/tokens`            mint a token, raw value shown once (ADMIN)
 *  - `DELETE /teams/:id/tokens/:tokenId`   revoke a token (ADMIN)
 *
 * @module
 */

import { z } from "zod";

import {
  ApiTokenCreateSchema,
  NotFoundError,
  PaginationQuerySchema,
} from "@shipyard/core";

import { writeAudit } from "../lib/audit.js";
import { paginate } from "../lib/pagination.js";
import { requireTeamRole } from "../lib/rbac.js";
import { requireScope } from "../lib/scopes.js";
import { generateApiToken } from "../lib/tokens.js";

import { ErrorResponseSchema, listResponse } from "./schemas.js";
import {
  ApiTokenCreatedResponseSchema,
  ApiTokenResponseSchema,
  toApiTokenDto,
} from "./tokens.serialize.js";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Path-params schema for the `/teams/:id/tokens` routes. */
const TeamParamsSchema = z.object({ id: z.string().min(1) });

/** Path-params schema for the `/teams/:id/tokens/:tokenId` route. */
const TokenParamsSchema = z.object({
  id: z.string().min(1),
  tokenId: z.string().min(1),
});

/**
 * The API-tokens router.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const tokensRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── List a team's non-revoked tokens (ADMIN) ──────────────────────────────
  app.get(
    "/teams/:id/tokens",
    {
      preHandler: requireScope("tokens:read"),
      schema: {
        tags: ["tokens"],
        summary: "List a team's active (non-revoked) API tokens",
        description:
          "Returns token metadata only (prefix, name, scopes, timestamps). The token value is never returned.",
        params: TeamParamsSchema,
        querystring: PaginationQuerySchema,
        response: {
          200: listResponse(ApiTokenResponseSchema),
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id: teamId } = request.params;
      await requireTeamRole(app, request, teamId, "ADMIN");

      const { cursor, limit, order } = request.query;
      const page = await paginate(app.prisma.apiToken, {
        cursor,
        limit,
        order,
        where: { teamId, revokedAt: null },
      });

      return {
        data: page.data.map(toApiTokenDto),
        nextCursor: page.nextCursor,
      };
    },
  );

  // ── Mint a token (ADMIN) — raw value returned EXACTLY ONCE ─────────────────
  app.post(
    "/teams/:id/tokens",
    {
      preHandler: requireScope("tokens:write"),
      schema: {
        tags: ["tokens"],
        summary: "Create an API token (raw value returned exactly once)",
        description:
          "Generates a token server-side and returns its raw value once under `token`. Only the hash and prefix are persisted; the raw value cannot be retrieved again.",
        params: TeamParamsSchema,
        // teamId/userId come from the path + auth context, not the body.
        body: ApiTokenCreateSchema.omit({ teamId: true, userId: true }),
        response: {
          201: ApiTokenCreatedResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: teamId } = request.params;
      await requireTeamRole(app, request, teamId, "ADMIN");

      const userId = request.auth!.userId;
      const { name, scopes, expiresAt } = request.body;

      // Generate the secret; persist only its hash + display prefix.
      const generated = generateApiToken();

      const token = await app.prisma.apiToken.create({
        data: {
          teamId,
          userId,
          name,
          scopes,
          expiresAt: expiresAt ?? null,
          hashedToken: generated.hashed,
          prefix: generated.prefix,
        },
      });

      // Audit the mint — metadata carries only the safe prefix, never the raw
      // token or its hash.
      await writeAudit(app.prisma, {
        teamId,
        actorId: userId,
        action: "token.create",
        targetType: "ApiToken",
        targetId: token.id,
        metadata: {
          name: token.name,
          prefix: token.prefix,
          scopes: token.scopes,
        },
      });

      reply.status(201);
      // The ONLY place the raw token is ever exposed.
      return { token: generated.raw, apiToken: toApiTokenDto(token) };
    },
  );

  // ── Revoke a token (ADMIN) ────────────────────────────────────────────────
  app.delete(
    "/teams/:id/tokens/:tokenId",
    {
      preHandler: requireScope("tokens:write"),
      schema: {
        tags: ["tokens"],
        summary: "Revoke an API token",
        params: TokenParamsSchema,
        response: {
          204: z.null(),
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: teamId, tokenId } = request.params;
      await requireTeamRole(app, request, teamId, "ADMIN");

      // Scope the lookup to the team so a token id from another team 404s
      // rather than leaking cross-team existence.
      const existing = await app.prisma.apiToken.findFirst({
        where: { id: tokenId, teamId },
        select: { id: true, revokedAt: true },
      });
      if (!existing) throw new NotFoundError("ApiToken", tokenId);

      // Revoke idempotently: a previously revoked token stays revoked.
      if (!existing.revokedAt) {
        await app.prisma.apiToken.update({
          where: { id: tokenId },
          data: { revokedAt: new Date() },
        });

        await writeAudit(app.prisma, {
          teamId,
          actorId: request.auth!.userId,
          action: "token.revoke",
          targetType: "ApiToken",
          targetId: tokenId,
        });
      }

      reply.status(204);
      return null;
    },
  );
};
