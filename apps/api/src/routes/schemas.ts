/**
 * Reusable zod response schemas for OpenAPI + serialization.
 *
 * Per the serializer convention (`lib/serialize.ts`), response schemas model
 * dates as ISO strings and Decimals as numbers; handlers return serializer DTOs,
 * never raw Prisma rows. These shared building blocks keep every router's
 * OpenAPI consistent.
 *
 * @module
 */

import { z } from "zod";

import { MembershipRoleSchema } from "@shipyard/core";

/**
 * The stable error envelope mirroring `@shipyard/core`'s `ErrorResponse`. Used
 * as the documented response for non-2xx statuses.
 */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    httpStatus: z.number(),
    details: z.unknown().optional(),
  }),
});

/**
 * Wrap an item schema into the `{ data, nextCursor }` paginated list envelope.
 *
 * @param item - The zod schema for a single list element.
 * @returns A zod object schema for the list response.
 */
export function listResponse<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

/** Response schema for a single {@link User} DTO. */
export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  githubLogin: z.string().nullable(),
  isAdmin: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Response schema for a single {@link Team} DTO. */
export const TeamResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  avatarUrl: z.string().nullable(),
  budgetUsdMonthly: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Response schema for a single {@link Membership} DTO (team optionally embedded). */
export const MembershipResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  teamId: z.string(),
  role: MembershipRoleSchema,
  createdAt: z.string(),
  team: TeamResponseSchema.optional(),
});
