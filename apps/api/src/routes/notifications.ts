/**
 * Notifications router.
 *
 * Notifications are strictly **user-scoped**: a caller may only see and mutate
 * their own notifications, so authorization is by `request.auth.userId` rather
 * than team RBAC. Reads are paginated; writes mark notifications read.
 *
 * Pipeline mirrors `routes/teams.ts` minus the team-RBAC step:
 *   schema (zod from core) → auth (`app.requireAuth`, applied globally) →
 *   ownership check → Prisma → serialize → response.
 *
 * Endpoints:
 *  - `GET  /notifications`          list the caller's notifications
 *                                   (paginated, `?unread` filter).
 *  - `POST /notifications/:id/read` mark one of the caller's notifications read
 *                                   (404 if missing OR owned by another user, so
 *                                   existence is not disclosed cross-user).
 *  - `POST /notifications/read-all` mark all the caller's notifications read.
 *
 * @module
 */

import { z } from "zod";

import {
  NotFoundError,
  NotificationTypeSchema,
  PaginationQuerySchema,
} from "@shipyard/core";

import { paginate } from "../lib/pagination.js";

import {
  toNotificationDto,
  type NotificationDto,
} from "./notifications.serialize.js";
import { ErrorResponseSchema, listResponse } from "./schemas.js";

import type { Prisma, Notification } from "@shipyard/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Response schema for a single notification DTO. */
const NotificationResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  metadata: z.unknown(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

/**
 * Query schema for `GET /notifications` (pagination + unread filter).
 *
 * `unread` arrives as a string query param; we accept the literal `"true"`/
 * `"false"` rather than `z.coerce.boolean()` (which treats any non-empty
 * string — including `"false"` — as `true`).
 */
const NotificationListQuerySchema = PaginationQuerySchema.extend({
  /** When `true`, return only notifications that have not been read. */
  unread: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

/** Path-params schema for the `:id/read` route. */
const NotificationParamsSchema = z.object({ id: z.string().min(1) });

/** Response schema for `POST /notifications/read-all`. */
const ReadAllResponseSchema = z.object({
  /** Number of notifications transitioned from unread to read. */
  updated: z.number(),
});

/**
 * The notifications router. Mounted under `/api/v1` with `app.requireAuth`.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const notificationsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── List the caller's notifications ───────────────────────────────────────
  app.get(
    "/notifications",
    {
      schema: {
        tags: ["notifications"],
        summary: "List the caller's notifications",
        querystring: NotificationListQuerySchema,
        response: {
          200: listResponse(NotificationResponseSchema),
          401: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = request.auth!.userId;
      const { cursor, limit, order, unread } = request.query;

      const where: Prisma.NotificationWhereInput = { userId };
      if (unread === true) where.readAt = null;

      const page = await paginate(app.prisma.notification, {
        cursor,
        limit,
        order,
        where,
      });

      return {
        data: page.data.map((n: Notification): NotificationDto =>
          toNotificationDto(n),
        ),
        nextCursor: page.nextCursor,
      };
    },
  );

  // ── Mark one of the caller's notifications read ───────────────────────────
  app.post(
    "/notifications/:id/read",
    {
      schema: {
        tags: ["notifications"],
        summary: "Mark a notification as read",
        params: NotificationParamsSchema,
        response: {
          200: NotificationResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = request.auth!.userId;
      const { id } = request.params;

      const existing = await app.prisma.notification.findUnique({
        where: { id },
        select: { userId: true, readAt: true },
      });
      // Treat "not yours" identically to "not found" so an attacker cannot probe
      // which notification ids exist by the 403-vs-404 distinction. (Do not
      // disclose other users' notifications.)
      if (!existing || existing.userId !== userId) {
        throw new NotFoundError("Notification", id);
      }

      // Idempotent: keep the original timestamp if already read.
      const notification = await app.prisma.notification.update({
        where: { id },
        data: { readAt: existing.readAt ?? new Date() },
      });

      return toNotificationDto(notification);
    },
  );

  // ── Mark all the caller's notifications read ──────────────────────────────
  app.post(
    "/notifications/read-all",
    {
      schema: {
        tags: ["notifications"],
        summary: "Mark all the caller's notifications as read",
        response: {
          200: ReadAllResponseSchema,
          401: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = request.auth!.userId;

      const result = await app.prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      });

      return { updated: result.count };
    },
  );
};
