/**
 * Serializers + zod response schemas local to the API-tokens router.
 *
 * ## SECURITY CONVENTION
 *
 * `ApiToken` rows carry a one-way `hashedToken`. **No serializer here ever
 * exposes `hashedToken`, and the raw token is returned only by the create
 * handler, exactly once, never persisted.** Metadata DTOs surface only the safe
 * display prefix, name, scopes, and timestamps so the dashboard can identify a
 * token without ever holding a usable credential.
 *
 * Per the project-wide convention, dates are ISO strings and handlers return
 * these DTOs rather than raw Prisma rows.
 *
 * @module
 */

import { z } from "zod";

import { iso } from "../lib/serialize.js";

import type { ApiToken } from "@shipyard/db";

/**
 * The safe wire shape of an {@link ApiToken}. Deliberately omits `hashedToken`
 * and never carries the raw secret. `prefix` is the only fragment of the token
 * value ever returned, and it is non-secret by construction.
 */
export interface ApiTokenDto {
  id: string;
  teamId: string;
  userId: string | null;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/**
 * Serialize an {@link ApiToken} row into its safe metadata DTO.
 *
 * @param token - A Prisma `ApiToken` row.
 * @returns The {@link ApiTokenDto} — never includes the hash or raw token.
 */
export function toApiTokenDto(token: ApiToken): ApiTokenDto {
  return {
    id: token.id,
    teamId: token.teamId,
    userId: token.userId,
    name: token.name,
    prefix: token.prefix,
    scopes: token.scopes,
    lastUsedAt: iso(token.lastUsedAt),
    expiresAt: iso(token.expiresAt),
    createdAt: iso(token.createdAt)!,
  };
}

/**
 * Response schema for a single {@link ApiTokenDto} (safe metadata only — the
 * raw token and hash are never present).
 */
export const ApiTokenResponseSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  userId: z.string().nullable(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
});

/**
 * Response schema for the create endpoint. The raw secret is delivered under a
 * clearly named, plaintext-once field alongside the token's safe metadata. The
 * accompanying description warns that it is shown only at creation time.
 */
export const ApiTokenCreatedResponseSchema = z.object({
  /**
   * The full secret token, shown EXACTLY ONCE at creation. Store it now — it is
   * never retrievable again and is not persisted in plaintext.
   */
  token: z
    .string()
    .describe(
      "The raw API token, shown exactly once. Copy it now; it cannot be retrieved again.",
    ),
  apiToken: ApiTokenResponseSchema,
});
