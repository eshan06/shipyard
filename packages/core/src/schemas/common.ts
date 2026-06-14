/**
 * Shared schema primitives reused across DTOs: identifiers, slugs, env keys,
 * and the generic pagination query.
 *
 * @module
 */

import { z } from "zod";
import { MAX_SLUG_LENGTH } from "../ids.js";

/**
 * A cuid()-style primary key as emitted by Prisma. Validated loosely (a
 * non-empty, reasonably bounded token) rather than with a strict cuid regex so
 * the schema stays compatible with cuid/cuid2 variants.
 */
export const CuidSchema = z
  .string()
  .min(1, "id is required")
  .max(64, "id is too long");

/**
 * A DNS-safe slug: lowercase, `[a-z0-9-]`, no leading/trailing hyphen, bounded
 * to {@link MAX_SLUG_LENGTH}. Matches {@link isValidSlug}.
 */
export const SlugSchema = z
  .string()
  .min(1, "slug is required")
  .max(MAX_SLUG_LENGTH, `slug must be at most ${MAX_SLUG_LENGTH} characters`)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "slug must be lowercase alphanumeric with hyphens, no leading/trailing hyphen",
  );

/**
 * A valid POSIX-ish environment variable key: starts with a letter or
 * underscore, followed by letters, digits, or underscores.
 */
export const EnvKeySchema = z
  .string()
  .min(1, "env key is required")
  .max(256, "env key is too long")
  .regex(
    /^[A-Za-z_][A-Za-z0-9_]*$/,
    "env key must match /^[A-Za-z_][A-Za-z0-9_]*$/",
  );

/**
 * Cursor/offset pagination query parameters.
 *
 * Supports both cursor-based (`cursor`) and the conventional `limit` page size.
 * `limit` is coerced from strings (query params arrive as strings) and clamped
 * to a sane range; `order` controls sort direction.
 */
export const PaginationQuerySchema = z.object({
  /** Opaque cursor (typically an id) to page after. */
  cursor: z.string().min(1).optional(),
  /** Page size; coerced from string, 1–100, default 20. */
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Sort direction by creation time. */
  order: z.enum(["asc", "desc"]).default("desc"),
});
/** Inferred (output) type for {@link PaginationQuerySchema}. */
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
/** Inferred (input) type for {@link PaginationQuerySchema} (pre-defaults). */
export type PaginationQueryInput = z.input<typeof PaginationQuerySchema>;
