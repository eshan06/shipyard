/**
 * Webhooks router — PUBLIC, signature-authenticated GitHub ingestion.
 *
 * These routes are NOT behind `app.requireAuth` (they are registered in the
 * public scope in `routes/index.ts`). Authentication is by HMAC signature
 * instead: every delivery is verified against `config.GITHUB_WEBHOOK_SECRET`
 * before any work happens.
 *
 * The full pipeline for `POST /webhooks/github`:
 *
 *  1. Read the raw request body + the `X-Hub-Signature-256`, `X-GitHub-Event`
 *     and `X-GitHub-Delivery` headers.
 *  2. Verify the HMAC-SHA256 signature over the raw bytes using a constant-time
 *     comparison (`crypto.timingSafeEqual`). Reject `401` when the secret is
 *     unset or the signature is missing/invalid.
 *  3. Idempotently record the delivery in `WebhookEvent` (keyed on
 *     `deliveryId`). A delivery already marked `PROCESSED` short-circuits with
 *     `{ status: "duplicate" }` and is never reprocessed.
 *  4. For `pull_request` events:
 *     - `opened` / `synchronize` / `reopened`: find the `Project` by
 *       `repository.full_name`; if it exists and has `autoDeployPrs`, upsert the
 *       `PullRequest`, ensure a `Preview` exists (creating one with a slug
 *       derived from the branch), create a `QUEUED` `Deployment`, and enqueue a
 *       deploy job.
 *     - `closed`: mark the `PullRequest` `CLOSED`/`MERGED` and enqueue a destroy
 *       job (`reason: "pr_closed"`) for each of its previews.
 *  5. Mark the `WebhookEvent` `PROCESSED` (or `FAILED` with the error message).
 *
 * Unknown event types / actions are acknowledged with `{ status: "ignored" }`
 * and the delivery is marked `SKIPPED`. The endpoint always responds quickly
 * (`200`/`202`) so GitHub's delivery does not time out.
 *
 * ## Raw-body handling
 *
 * GitHub signs the exact bytes it sends, so the signature MUST be computed over
 * the raw payload — re-serializing a parsed object would change whitespace/key
 * order and break verification. This plugin therefore installs a LOCAL
 * `application/json` content-type parser (scoped to this encapsulated public
 * plugin only) that retains the raw `Buffer` on `request.rawBody` while still
 * producing the parsed `request.body`. No shared/global config is touched.
 *
 * @module
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { canTransitionPreview } from "@shipyard/core";
import { Prisma } from "@shipyard/db";

import { ErrorResponseSchema } from "./schemas.js";

import type { FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Header carrying GitHub's HMAC-SHA256 signature (`sha256=<hex>`). */
const SIGNATURE_HEADER = "x-hub-signature-256";
/** Header carrying the GitHub event name (e.g. `pull_request`). */
const EVENT_HEADER = "x-github-event";
/** Header carrying the unique delivery id used for idempotency. */
const DELIVERY_HEADER = "x-github-delivery";

/** PR actions that should (re)deploy a preview. */
const DEPLOY_ACTIONS = new Set(["opened", "synchronize", "reopened"]);

/**
 * Response schema for an accepted webhook delivery. `status` describes how the
 * delivery was handled so GitHub's redelivery UI and our tests can assert on it.
 */
const WebhookAckSchema = z.object({
  status: z.enum(["processed", "duplicate", "ignored"]),
});

/**
 * The raw `Buffer` GitHub sent, retained by the local content-type parser so we
 * can verify the signature over the exact transmitted bytes.
 */
declare module "fastify" {
  interface FastifyRequest {
    /** Raw request body bytes (set by the webhooks JSON parser). */
    rawBody?: Buffer;
  }
}

/**
 * Constant-time verification of GitHub's `X-Hub-Signature-256` header against
 * the raw body using the configured shared secret.
 *
 * @param secret - The configured `GITHUB_WEBHOOK_SECRET` (or `undefined`).
 * @param signatureHeader - The raw `X-Hub-Signature-256` header value.
 * @param body - The exact raw bytes that were received.
 * @returns `true` only when the secret is set and the signature matches.
 */
function verifySignature(
  secret: string | undefined,
  signatureHeader: string | undefined,
  body: Buffer,
): boolean {
  if (!secret || !signatureHeader) return false;

  const expected = `sha256=${createHmac("sha256", secret)
    .update(body)
    .digest("hex")}`;

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so length-check first. A length
  // mismatch is itself a non-match, so returning false is correct and safe.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Read a single string header value (the first if an array was sent). */
function header(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Derive a DNS-safe preview slug from a branch name plus the PR number, so it
 * fits the `<slug>.<domain>` URL scheme and is unique per PR.
 *
 * @param branch - The PR head branch (e.g. `feat/Login-Page`).
 * @param prNumber - The pull-request number.
 * @returns A lowercase, hyphenated, length-bounded slug (e.g. `pr-42-feat-login-page`).
 */
function slugForPreview(branch: string, prNumber: number): string {
  const cleaned = branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  const base = cleaned.length > 0 ? cleaned : "branch";
  return `pr-${prNumber}-${base}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal GitHub `pull_request` payload shapes (only the fields we consume).
// ─────────────────────────────────────────────────────────────────────────────

/** A GitHub label object (we only keep its `name`). */
const GithubLabelSchema = z.object({ name: z.string() });

/** The subset of a GitHub `pull_request` webhook payload we rely on. */
const PullRequestPayloadSchema = z.object({
  action: z.string(),
  repository: z.object({ full_name: z.string() }),
  pull_request: z.object({
    number: z.number().int(),
    title: z.string().default(""),
    html_url: z.string().default(""),
    merged: z.boolean().optional(),
    user: z
      .object({
        login: z.string().default("unknown"),
        avatar_url: z.string().nullish(),
      })
      .default({ login: "unknown" }),
    head: z.object({ ref: z.string(), sha: z.string() }),
    base: z.object({ ref: z.string() }),
    labels: z.array(GithubLabelSchema).default([]),
  }),
});

/**
 * The webhooks router. Mounted under `/api/v1` WITHOUT `app.requireAuth`.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const webhooksRoutes: FastifyPluginAsyncZod = async (app) => {
  // Local, scoped JSON parser: keep the raw bytes (for HMAC) while still
  // producing a parsed body. Encapsulation keeps this off every other router.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (request, body, done) => {
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
      request.rawBody = buf;
      if (buf.length === 0) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(buf.toString("utf8")) as unknown);
      } catch (err) {
        const error = err as Error & { statusCode?: number };
        error.statusCode = 400;
        done(error, undefined);
      }
    },
  );

  app.post(
    "/webhooks/github",
    {
      // GitHub delivers webhooks from its own (shared) IP ranges, so the
      // global per-IP rate limiter would lump every org's deliveries into one
      // bucket and start returning 429s on busy repos — GitHub treats those as
      // failed deliveries and eventually drops the event, silently losing
      // deploy/destroy triggers. The HMAC signature is the sole authenticator
      // here, so disable IP rate limiting for this route.
      config: { rateLimit: false },
      // Payloads are arbitrary GitHub JSON we parse defensively ourselves after
      // verifying the signature, so we document only the responses here.
      schema: {
        tags: ["webhooks"],
        summary: "Ingest a signature-verified GitHub webhook delivery",
        response: {
          200: WebhookAckSchema,
          202: WebhookAckSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const raw = request.rawBody ?? Buffer.alloc(0);

      // 1 + 2. Verify the signature over the raw bytes (constant-time).
      const signature = header(request, SIGNATURE_HEADER);
      if (!verifySignature(app.config.GITHUB_WEBHOOK_SECRET, signature, raw)) {
        reply.status(401);
        return reply.send({
          error: {
            code: "UNAUTHENTICATED",
            message: "Invalid or missing webhook signature",
            httpStatus: 401,
          },
        });
      }

      const eventType = header(request, EVENT_HEADER) ?? "unknown";
      const deliveryId = header(request, DELIVERY_HEADER);
      if (!deliveryId) {
        reply.status(400);
        return reply.send({
          error: {
            code: "VALIDATION",
            message: "Missing X-GitHub-Delivery header",
            httpStatus: 400,
          },
        });
      }

      const body = (request.body ?? {}) as Record<string, unknown>;
      const action =
        typeof body.action === "string" ? body.action : undefined;

      // 3. Idempotency: record the delivery (idempotent on deliveryId), then
      // ATOMICALLY claim it by transitioning RECEIVED -> PROCESSING. Only one
      // request can win that conditional update, so concurrent redeliveries of
      // the SAME delivery (e.g. GitHub re-sends while the first is still
      // in-flight past its ~10s timeout) cannot both proceed and create
      // duplicate deployments.
      const event = await app.prisma.webhookEvent.upsert({
        where: { deliveryId },
        create: {
          deliveryId,
          provider: "GITHUB",
          eventType,
          action,
          payload: body as Prisma.InputJsonValue,
          status: "RECEIVED",
        },
        update: {},
      });

      // A delivery already finished (PROCESSED/SKIPPED) is a sequential
      // redelivery — acknowledge as a duplicate without reprocessing. FAILED is
      // left reclaimable so GitHub's retry can re-run a failed delivery.
      if (event.status === "PROCESSED" || event.status === "SKIPPED") {
        reply.status(200);
        return { status: "duplicate" as const };
      }

      // Claim the delivery: succeeds (count === 1) only for the single request
      // that flips it out of RECEIVED/FAILED. A concurrent in-flight claim
      // (already PROCESSING) yields count === 0 and is treated as a duplicate.
      const claim = await app.prisma.webhookEvent.updateMany({
        where: { id: event.id, status: { in: ["RECEIVED", "FAILED"] } },
        data: { status: "PROCESSING" },
      });
      if (claim.count !== 1) {
        reply.status(200);
        return { status: "duplicate" as const };
      }

      // Only `pull_request` events drive deploy/destroy; everything else is
      // acknowledged and skipped (still idempotently recorded).
      if (eventType !== "pull_request") {
        await app.prisma.webhookEvent.update({
          where: { id: event.id },
          data: { status: "SKIPPED", processedAt: new Date() },
        });
        reply.status(200);
        return { status: "ignored" as const };
      }

      try {
        const handled = await processPullRequest(app, body);
        await app.prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            status: handled ? "PROCESSED" : "SKIPPED",
            processedAt: new Date(),
          },
        });
        reply.status(handled ? 202 : 200);
        return {
          status: handled ? ("processed" as const) : ("ignored" as const),
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "webhook processing failed";
        request.log.error({ err, deliveryId }, "webhook processing failed");
        await app.prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            status: "FAILED",
            error: message.slice(0, 1000),
            processedAt: new Date(),
          },
        });
        // GitHub treats 5xx as "retry later"; surface a 500 so it redelivers.
        reply.status(500);
        return reply.send({
          error: {
            code: "INTERNAL",
            message: "Webhook processing failed",
            httpStatus: 500,
          },
        });
      }
    },
  );
};

/**
 * Apply a verified `pull_request` webhook to our data model: upsert the PR and,
 * depending on the action, ensure a preview + enqueue a deploy, or tear the
 * preview(s) down.
 *
 * @param app - The Fastify instance (Prisma + queues).
 * @param body - The raw parsed webhook payload.
 * @returns `true` when the event resulted in real work (deploy/destroy/state
 *   change), `false` when it was ignored (unknown action, unknown repo, or
 *   `autoDeployPrs` disabled).
 */
async function processPullRequest(
  app: Parameters<FastifyPluginAsyncZod>[0],
  body: Record<string, unknown>,
): Promise<boolean> {
  const parsed = PullRequestPayloadSchema.safeParse(body);
  if (!parsed.success) return false;

  const { action, repository, pull_request: pr } = parsed.data;

  const project = await app.prisma.project.findUnique({
    where: {
      provider_repoFullName: {
        provider: "GITHUB",
        repoFullName: repository.full_name,
      },
    },
  });
  if (!project) return false;

  const labels = pr.labels.map((l) => l.name);

  // ── Close / merge: mark state + tear down previews ─────────────────────────
  if (action === "closed") {
    const state = pr.merged ? "MERGED" : "CLOSED";
    const closedAt = new Date();
    const record = await app.prisma.pullRequest.upsert({
      where: { projectId_number: { projectId: project.id, number: pr.number } },
      create: {
        projectId: project.id,
        number: pr.number,
        title: pr.title,
        authorLogin: pr.user.login,
        authorAvatar: pr.user.avatar_url ?? null,
        headRef: pr.head.ref,
        baseRef: pr.base.ref,
        headSha: pr.head.sha,
        url: pr.html_url,
        labels,
        state,
        closedAt,
      },
      update: {
        title: pr.title,
        headSha: pr.head.sha,
        labels,
        state,
        // NB: `closedAt` is intentionally NOT updated here — see below. We stamp
        // it once on the first close so a redelivered "closed" event (or a later
        // benign row mutation) cannot reset the destroy-TTL clock.
      },
      include: { previews: true },
    });

    // Anchor the destroy TTL on the first close/merge instant only.
    if (record.closedAt === null) {
      await app.prisma.pullRequest.update({
        where: { id: record.id },
        data: { closedAt },
      });
      record.closedAt = closedAt;
    }

    const live = record.previews.filter(
      (p) => p.status !== "DESTROYED" && p.status !== "DESTROYING",
    );
    for (const preview of live) {
      await app.queues.enqueueDestroy({
        previewId: preview.id,
        reason: "pr_closed",
      });
    }

    await app.prisma.auditLog.create({
      data: {
        teamId: project.teamId,
        action: "webhook.pr.closed",
        targetType: "PullRequest",
        targetId: record.id,
        metadata: {
          repo: repository.full_name,
          number: pr.number,
          state,
          previewsTornDown: live.length,
        },
      },
    });
    return true;
  }

  // ── Open / sync / reopen: upsert PR, ensure preview, enqueue deploy ─────────
  if (!DEPLOY_ACTIONS.has(action)) return false;
  if (!project.autoDeployPrs) return false;

  const pullRequest = await app.prisma.pullRequest.upsert({
    where: { projectId_number: { projectId: project.id, number: pr.number } },
    create: {
      projectId: project.id,
      number: pr.number,
      title: pr.title,
      authorLogin: pr.user.login,
      authorAvatar: pr.user.avatar_url ?? null,
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      headSha: pr.head.sha,
      url: pr.html_url,
      labels,
      state: "OPEN",
    },
    update: {
      title: pr.title,
      authorLogin: pr.user.login,
      authorAvatar: pr.user.avatar_url ?? null,
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      headSha: pr.head.sha,
      url: pr.html_url,
      labels,
      state: "OPEN",
    },
    include: { previews: true },
  });

  // Ensure a (non-destroyed) preview exists for this PR.
  let preview = pullRequest.previews.find(
    (p) => p.status !== "DESTROYED" && p.status !== "DESTROYING",
  );
  if (!preview) {
    preview = await ensurePreview(app, {
      projectId: project.id,
      pullRequestId: pullRequest.id,
      number: pr.number,
      branch: pr.head.ref,
      commitSha: pr.head.sha,
      autoStopMinutes: project.autoStopMinutes,
    });
  } else {
    // A push to an existing preview should re-queue a deploy when the preview is
    // idle (STOPPED) or previously FAILED. Route that through the core state
    // machine instead of hand-rolling the transition, so the webhook path obeys
    // the same rules as the worker and never moves a preview into an illegal
    // state underneath a freshly-created QUEUED deployment.
    const reQueue =
      (preview.status === "STOPPED" || preview.status === "FAILED") &&
      canTransitionPreview(preview.status, "QUEUED");
    preview = await app.prisma.preview.update({
      where: { id: preview.id },
      data: {
        commitSha: pr.head.sha,
        branch: pr.head.ref,
        status: reQueue ? "QUEUED" : preview.status,
        lastActivityAt: new Date(),
      },
    });
  }

  const trigger = action === "synchronize" ? "PR_SYNC" : "PR_OPENED";
  const deployment = await app.prisma.deployment.create({
    data: {
      previewId: preview.id,
      commitSha: pr.head.sha,
      trigger,
      status: "QUEUED",
    },
  });

  await app.queues.enqueueDeploy({
    deploymentId: deployment.id,
    previewId: preview.id,
    projectId: project.id,
    commitSha: pr.head.sha,
    trigger,
  });

  await app.prisma.auditLog.create({
    data: {
      teamId: project.teamId,
      action: "webhook.pr.deploy",
      targetType: "Deployment",
      targetId: deployment.id,
      metadata: {
        repo: repository.full_name,
        number: pr.number,
        action,
        trigger,
        previewId: preview.id,
      },
    },
  });

  return true;
}

/** Arguments for {@link ensurePreview}. */
interface EnsurePreviewArgs {
  projectId: string;
  pullRequestId: string;
  number: number;
  branch: string;
  commitSha: string;
  autoStopMinutes: number;
}

/**
 * Create a `Preview` for a PR, retrying once with a uniqueness-disambiguated
 * slug if the derived slug collides (the `Preview.slug` column is globally
 * unique).
 *
 * @param app - The Fastify instance (Prisma).
 * @param args - The owning project/PR plus branch + commit info.
 * @returns The created `Preview` row.
 */
async function ensurePreview(
  app: Parameters<FastifyPluginAsyncZod>[0],
  args: EnsurePreviewArgs,
) {
  const baseSlug = slugForPreview(args.branch, args.number);
  const data = {
    projectId: args.projectId,
    pullRequestId: args.pullRequestId,
    name: `PR #${args.number}`,
    status: "QUEUED" as const,
    branch: args.branch,
    commitSha: args.commitSha,
    autoStopMinutes: args.autoStopMinutes,
  };

  try {
    return await app.prisma.preview.create({
      data: { ...data, slug: baseSlug },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Slug collided with another preview — disambiguate with a short suffix.
      const suffix = Math.random().toString(36).slice(2, 8);
      return app.prisma.preview.create({
        data: { ...data, slug: `${baseSlug}-${suffix}` },
      });
    }
    throw err;
  }
}
