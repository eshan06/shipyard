/**
 * Cursor-based pagination helper for Prisma list endpoints.
 *
 * The API's list responses are `{ data: T[], nextCursor: string | null }` with
 * an opaque cursor (a row id). This helper implements the standard "take N+1"
 * technique: fetch one more row than requested; if it comes back, there is a
 * next page and the extra row's id is the cursor. Ordering is stable —
 * `createdAt` then `id` — so the cursor is unambiguous even when timestamps tie.
 *
 * @module
 */

/**
 * The minimal Prisma model-delegate surface this helper needs: a `findMany`
 * that returns rows carrying an `id`. The args are intentionally loose (`any`)
 * so any concrete Prisma model delegate (with its strict per-model arg types) is
 * structurally assignable — we only rely on the standard cursor/take/orderBy
 * fields, which every delegate accepts.
 */
export interface PaginatableDelegate<TRow extends { id: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findMany(args?: any): Promise<TRow[]>;
}

/**
 * Options controlling a single page fetch.
 */
export interface PaginateOptions {
  /** Opaque cursor (a row id) to page strictly after. */
  cursor?: string;
  /** Page size (number of rows to return). */
  limit: number;
  /** Sort direction by creation time. */
  order: "asc" | "desc";
  /** Optional Prisma `where` filter to scope the query. */
  where?: unknown;
  /**
   * Optional override for the `orderBy`. Defaults to `createdAt` then `id` in
   * `order` direction (a stable total order suitable for cursoring). Models
   * without a `createdAt` column (e.g. `Deployment`, `CostRecord`) MUST supply
   * their own ordering field here.
   */
  orderBy?: unknown;
  /** Optional Prisma `include` to project relations onto each row. */
  include?: unknown;
  /** Optional Prisma `select` to shape each row. Mutually exclusive with `include`. */
  select?: unknown;
}

/**
 * A single page of results plus the cursor to fetch the following page.
 */
export interface Page<T> {
  /** The rows on this page (length ≤ `limit`). */
  data: T[];
  /** Cursor for the next page, or `null` when this is the last page. */
  nextCursor: string | null;
}

/**
 * Fetch one cursor-paginated page from a Prisma model delegate.
 *
 * @typeParam TRow - The row type (must carry a string `id`).
 * @param delegate - A Prisma model delegate (e.g. `prisma.team`).
 * @param options - Cursor, limit, order, and optional where/orderBy.
 * @returns A {@link Page} with the rows and the next cursor.
 */
export async function paginate<TRow extends { id: string }>(
  delegate: PaginatableDelegate<TRow>,
  options: PaginateOptions,
): Promise<Page<TRow>> {
  const { cursor, limit, order, where, orderBy, include, select } = options;

  const rows = await delegate.findMany({
    ...(where === undefined ? {} : { where }),
    ...(include === undefined ? {} : { include }),
    ...(select === undefined ? {} : { select }),
    orderBy: orderBy ?? [{ createdAt: order }, { id: order }],
    take: limit + 1,
    // When a cursor is supplied, skip the cursor row itself so paging is
    // strictly "after" it.
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  if (rows.length > limit) {
    const nextRow = rows[limit];
    return {
      data: rows.slice(0, limit),
      nextCursor: nextRow ? nextRow.id : null,
    };
  }

  return { data: rows, nextCursor: null };
}
