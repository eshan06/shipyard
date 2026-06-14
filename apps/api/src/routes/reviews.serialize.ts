/**
 * Review serializers + response schema (co-located with `routes/reviews.ts`).
 *
 * Follows the project serializer convention (`lib/serialize.ts`): dates are
 * emitted as ISO-8601 strings and handlers return these DTOs rather than raw
 * Prisma rows.
 *
 * @module
 */

import { z } from "zod";

import { ReviewStateSchema } from "@shipyard/core";

import { iso } from "../lib/serialize.js";

import type { Review } from "@shipyard/db";

/**
 * Response schema for a single {@link Review} DTO — the reviewer's login,
 * avatar, current state, and when it last changed. Dates are ISO strings.
 */
export const ReviewResponseSchema = z.object({
  id: z.string(),
  previewId: z.string(),
  userId: z.string().nullable(),
  login: z.string(),
  avatarUrl: z.string().nullable(),
  state: ReviewStateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** The wire shape of a {@link Review}. Dates are ISO strings. */
export type ReviewDto = z.infer<typeof ReviewResponseSchema>;

/**
 * Serialize a {@link Review} row into its public DTO.
 *
 * @param review - A Prisma `Review` row.
 * @returns The {@link ReviewDto}.
 */
export function toReviewDto(review: Review): ReviewDto {
  return {
    id: review.id,
    previewId: review.previewId,
    userId: review.userId,
    login: review.login,
    avatarUrl: review.avatarUrl,
    state: review.state,
    createdAt: iso(review.createdAt)!,
    updatedAt: iso(review.updatedAt)!,
  };
}
