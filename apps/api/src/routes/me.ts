/**
 * `GET /me` — the current authenticated user and their team memberships.
 *
 * Mounted under `/api/v1` with `app.requireAuth` (see `routes/index.ts`).
 *
 * @module
 */

import { z } from "zod";

import { NotFoundError } from "@shipyard/core";

import { callerTeamScope } from "../lib/rbac.js";
import { toMembershipDto, toUserDto } from "../lib/serialize.js";

import {
  ErrorResponseSchema,
  MembershipResponseSchema,
  UserResponseSchema,
} from "./schemas.js";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Response schema for `GET /me`. */
const MeResponseSchema = z.object({
  user: UserResponseSchema,
  memberships: z.array(MembershipResponseSchema),
});

/**
 * The `/me` router.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const meRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/me",
    {
      schema: {
        tags: ["me"],
        summary: "Get the current user and their team memberships",
        response: { 200: MeResponseSchema, 401: ErrorResponseSchema },
      },
    },
    async (request) => {
      const userId = request.auth!.userId;
      // A team-scoped API token may only see its membership on the bound team,
      // not the user's full cross-team membership list.
      const tokenTeamId = callerTeamScope(request);
      const user = await app.prisma.user.findUnique({
        where: { id: userId },
        include: {
          memberships: {
            ...(tokenTeamId ? { where: { teamId: tokenTeamId } } : {}),
            include: { team: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!user) throw new NotFoundError("User", userId);

      return {
        user: toUserDto(user),
        memberships: user.memberships.map(toMembershipDto),
      };
    },
  );
};
