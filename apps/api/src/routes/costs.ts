/**
 * Costs router.
 *
 * Two read-only views over `CostRecord` rows for the dashboard's spend reports:
 *
 *  - `GET /previews/:id/costs`  per-preview cost history (paginated) plus a
 *    computed `totalUsd` of the returned page. `VIEWER` on the owning team.
 *  - `GET /costs/summary`       a current-month roll-up across the caller's
 *    teams (or a single `?teamId`), aggregating `estimatedUsd` by project and
 *    by day and comparing each team's spend against `Team.budgetUsdMonthly`.
 *    `VIEWER` on each team (callers only ever see teams they belong to).
 *
 * Follows `routes/teams.ts`: schema (zod) → auth (`app.requireAuth`, applied
 * globally) → RBAC (`lib/rbac`) → Prisma → serialize (Decimals → numbers).
 *
 * @module
 */

import { z } from "zod";

import { PaginationQuerySchema, roundUsd } from "@shipyard/core";

import { paginate } from "../lib/pagination.js";
import { requireTeamRole, teamIdForPreview } from "../lib/rbac.js";

import {
  CostSummaryResponseSchema,
  PreviewCostsResponseSchema,
  toCostRecordDto,
} from "./costs.serialize.js";
import { ErrorResponseSchema } from "./schemas.js";

import type { Prisma } from "@shipyard/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Path-params schema for the nested `/previews/:id/costs` route. */
const PreviewParamsSchema = z.object({ id: z.string().min(1) });

/** Query schema for `/costs/summary` (optionally scope to a single team). */
const CostSummaryQuerySchema = z.object({
  /** Restrict the roll-up to one team the caller belongs to. */
  teamId: z.string().min(1).optional(),
});

/**
 * Compute the `[start, end)` bounds of the current calendar month in UTC.
 *
 * @param now - The reference instant (defaults to `new Date()`).
 * @returns The inclusive month start and the exclusive next-month start.
 */
function currentMonthRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
  return { start, end };
}

/** Format a `Date` as a UTC `YYYY-MM-DD` day key for the by-day series. */
function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The costs router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const costsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── Per-preview cost history (VIEWER) ─────────────────────────────────────
  app.get(
    "/previews/:id/costs",
    {
      schema: {
        tags: ["costs"],
        summary: "List a preview's cost records with a page total",
        params: PreviewParamsSchema,
        querystring: PaginationQuerySchema,
        response: {
          200: PreviewCostsResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id: previewId } = request.params;
      const { cursor, limit, order } = request.query;

      // Resolve the owning team (404s if the preview is missing) and enforce
      // read access before exposing cost data.
      const teamId = await teamIdForPreview(app.prisma, previewId);
      await requireTeamRole(app, request, teamId, "VIEWER");

      const page = await paginate(app.prisma.costRecord, {
        cursor,
        limit,
        order,
        where: { previewId },
        // CostRecord has no `createdAt`; order by its billing period instead.
        orderBy: [{ periodStart: order }, { id: order }],
      });

      const data = page.data.map(toCostRecordDto);
      // Sum the page's estimates; round to the DB's 4-dp precision so summing
      // many small Decimals does not surface float artifacts.
      const totalUsd = roundUsd(
        data.reduce((acc, record) => acc + record.estimatedUsd, 0),
      );

      return { data, totalUsd, nextCursor: page.nextCursor };
    },
  );

  // ── Cross-team cost summary for the current month ─────────────────────────
  app.get(
    "/costs/summary",
    {
      schema: {
        tags: ["costs"],
        summary:
          "Aggregate current-month spend by project and day, vs. team budgets",
        querystring: CostSummaryQuerySchema,
        response: {
          200: CostSummaryResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = request.auth!.userId;
      const { teamId } = request.query;

      // Determine which teams the roll-up covers. When `teamId` is supplied we
      // enforce membership (VIEWER); otherwise we include every team the caller
      // belongs to. Either way the caller never sees a team they are not on.
      let teamIds: string[];
      if (teamId) {
        await requireTeamRole(app, request, teamId, "VIEWER");
        teamIds = [teamId];
      } else {
        const memberships = await app.prisma.membership.findMany({
          where: { userId },
          select: { teamId: true },
        });
        teamIds = memberships.map((m) => m.teamId);
      }

      const { start, end } = currentMonthRange();

      // Load the teams (names + budgets) for the budget-vs-spend section.
      const teams = await app.prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, name: true, budgetUsdMonthly: true },
      });

      // Fetch this month's cost records for the in-scope teams, carrying just
      // enough of the project/team relation to bucket by project and team.
      const records =
        teamIds.length === 0
          ? []
          : await app.prisma.costRecord.findMany({
              where: {
                periodStart: { gte: start, lt: end },
                preview: { project: { teamId: { in: teamIds } } },
              },
              select: {
                periodStart: true,
                estimatedUsd: true,
                preview: {
                  select: {
                    project: {
                      select: { id: true, name: true, teamId: true },
                    },
                  },
                },
              },
            });

      // Aggregate in memory: by project, by UTC day, and per team.
      const byProject = new Map<
        string,
        { projectId: string; projectName: string; teamId: string; sum: number }
      >();
      const byDay = new Map<string, number>();
      const teamSpend = new Map<string, number>();
      let total = 0;

      for (const record of records) {
        const usd = (record.estimatedUsd as Prisma.Decimal).toNumber();
        const project = record.preview.project;

        total += usd;

        const existing = byProject.get(project.id);
        if (existing) {
          existing.sum += usd;
        } else {
          byProject.set(project.id, {
            projectId: project.id,
            projectName: project.name,
            teamId: project.teamId,
            sum: usd,
          });
        }

        const day = utcDayKey(record.periodStart);
        byDay.set(day, (byDay.get(day) ?? 0) + usd);

        teamSpend.set(
          project.teamId,
          (teamSpend.get(project.teamId) ?? 0) + usd,
        );
      }

      return {
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        totalUsd: roundUsd(total),
        byProject: [...byProject.values()]
          .map((p) => ({
            projectId: p.projectId,
            projectName: p.projectName,
            teamId: p.teamId,
            estimatedUsd: roundUsd(p.sum),
          }))
          .sort((a, b) => b.estimatedUsd - a.estimatedUsd),
        byDay: [...byDay.entries()]
          .map(([date, sum]) => ({ date, estimatedUsd: roundUsd(sum) }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        teams: teams.map((team) => {
          const spendUsd = roundUsd(teamSpend.get(team.id) ?? 0);
          const budget =
            team.budgetUsdMonthly == null
              ? null
              : team.budgetUsdMonthly.toNumber();
          return {
            teamId: team.id,
            teamName: team.name,
            budgetUsdMonthly: budget,
            spendUsd,
            budgetUsedFraction:
              budget == null || budget === 0
                ? null
                : roundUsd(spendUsd / budget),
            overBudget: budget == null ? false : spendUsd > budget,
          };
        }),
      };
    },
  );
};
