/**
 * Serializers + row types for the pull-requests router.
 *
 * Co-located with `routes/pullRequests.ts`. Follows the global serializer
 * convention (`lib/serialize.ts`): dates become ISO strings and handlers return
 * these DTOs rather than raw Prisma rows.
 *
 * @module
 */

import type { PullRequest, Preview } from "@shipyard/db";

/** A `PullRequest` row enriched with `_count.previews`. */
export type PullRequestRow = PullRequest & {
  _count: { previews: number };
};

/** A single embedded preview summary line (selected subset of `Preview`). */
export type PreviewSummaryRow = Pick<
  Preview,
  "id" | "slug" | "status" | "url" | "createdAt"
>;

/** A `PullRequest` row with its previews summary + count loaded. */
export type PullRequestWithPreviewsRow = PullRequestRow & {
  previews: PreviewSummaryRow[];
};

/** Wire shape of a single preview summary embedded on a PR. */
export interface PreviewSummaryDto {
  id: string;
  slug: string;
  status: Preview["status"];
  url: string | null;
  createdAt: string;
}

/** Wire shape of a tracked pull request (list element). */
export interface PullRequestDto {
  id: string;
  projectId: string;
  number: number;
  title: string;
  authorLogin: string;
  authorAvatar: string | null;
  headRef: string;
  baseRef: string;
  headSha: string;
  state: PullRequest["state"];
  url: string;
  labels: string[];
  previewCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Wire shape of a pull request detail (adds the previews summary). */
export interface PullRequestWithPreviewsDto extends PullRequestDto {
  previews: PreviewSummaryDto[];
}

/**
 * Serialize a preview summary row into its embedded DTO.
 *
 * @param preview - A selected `Preview` subset.
 * @returns The {@link PreviewSummaryDto}.
 */
export function toPreviewSummaryDto(
  preview: PreviewSummaryRow,
): PreviewSummaryDto {
  return {
    id: preview.id,
    slug: preview.slug,
    status: preview.status,
    url: preview.url,
    createdAt: preview.createdAt.toISOString(),
  };
}

/**
 * Serialize a `PullRequest` row (with preview count) into its DTO.
 *
 * @param pr - A `PullRequest` row including `_count.previews`.
 * @returns The {@link PullRequestDto}.
 */
export function toPullRequestDto(pr: PullRequestRow): PullRequestDto {
  return {
    id: pr.id,
    projectId: pr.projectId,
    number: pr.number,
    title: pr.title,
    authorLogin: pr.authorLogin,
    authorAvatar: pr.authorAvatar,
    headRef: pr.headRef,
    baseRef: pr.baseRef,
    headSha: pr.headSha,
    state: pr.state,
    url: pr.url,
    labels: pr.labels,
    previewCount: pr._count.previews,
    createdAt: pr.createdAt.toISOString(),
    updatedAt: pr.updatedAt.toISOString(),
  };
}

/**
 * Serialize a `PullRequest` row (with previews + count) into its detail DTO.
 *
 * @param pr - A `PullRequest` row with `previews` and `_count.previews`.
 * @returns The {@link PullRequestWithPreviewsDto}.
 */
export function toPullRequestWithPreviewsDto(
  pr: PullRequestWithPreviewsRow,
): PullRequestWithPreviewsDto {
  return {
    ...toPullRequestDto(pr),
    previews: pr.previews.map(toPreviewSummaryDto),
  };
}
