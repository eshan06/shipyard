/**
 * Authentication routes (mounted under `/api/v1/auth`, public — no requireAuth).
 *
 * - `POST /auth/dev-login` — dev-only password-less login for a seeded user.
 * - `POST /auth/logout`    — clear the session cookie.
 * - `GET  /auth/github`    — begin GitHub OAuth (redirect to GitHub).
 * - `GET  /auth/github/callback` — exchange the code, upsert the user, ensure a
 *   team, mint a session, and redirect back to the dashboard.
 *
 * The GitHub routes return a clear 501 when OAuth credentials are not
 * configured, so the service is fully usable in dev via `dev-login`.
 *
 * @module
 */

import { z } from "zod";

import { ForbiddenError, NotFoundError, slugify } from "@shipyard/core";

import { writeAudit } from "../lib/audit.js";
import { toUserDto } from "../lib/serialize.js";
import { clearSessionCookie, setSessionCookie } from "../plugins/auth.js";

import { ErrorResponseSchema, UserResponseSchema } from "./schemas.js";

import type { FastifyInstance } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Cookie name holding the OAuth `state` nonce during the round-trip. */
const OAUTH_STATE_COOKIE = "sy_oauth_state";

/**
 * Schema for the subset of the GitHub `/user` response we consume. Validating
 * (rather than `as`-casting) is security-critical: a non-2xx GitHub response
 * (e.g. `{ "message": "Bad credentials" }`) has no numeric `id`, and casting it
 * would coerce `String(undefined)` into the literal `"undefined"` githubId,
 * collapsing every failed profile fetch onto ONE shared user account.
 */
const GitHubUserSchema = z.object({
  id: z.number().int(),
  login: z.string().min(1),
  name: z.string().nullish(),
  email: z.string().nullish(),
  avatar_url: z.string().nullish(),
});

/**
 * Ensure the user has at least one team membership, creating a personal team
 * (and OWNER membership) when they have none. Idempotent.
 *
 * @param app - The Fastify instance.
 * @param userId - The user to ensure a team for.
 * @param displayName - Used to name/slug the personal team if created.
 */
async function ensureTeamFor(
  app: FastifyInstance,
  userId: string,
  displayName: string,
): Promise<void> {
  const existing = await app.prisma.membership.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (existing) return;

  const base = slugify(displayName) || "team";
  const slug = `${base}-${userId.slice(-6)}`;
  await app.prisma.team.create({
    data: {
      name: `${displayName}'s Team`,
      slug,
      members: { create: { userId, role: "OWNER" } },
    },
  });
}

/**
 * The auth router.
 *
 * @param app - The Fastify instance (zod type provider).
 */
export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── Dev-only password-less login ──────────────────────────────────────────
  app.post(
    "/auth/dev-login",
    {
      schema: {
        tags: ["auth"],
        summary: "Dev-only password-less login for a seeded user",
        body: z.object({ email: z.string().email() }),
        response: {
          200: UserResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          422: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!app.config.DEV_AUTH) {
        throw new ForbiddenError("Dev login is disabled (DEV_AUTH is off)");
      }
      const { email } = request.body;
      const user = await app.prisma.user.findUnique({ where: { email } });
      if (!user) throw new NotFoundError("User", email);

      const token = await app.signSession(user.id);
      setSessionCookie(app, reply, token);

      await writeAudit(app.prisma, {
        actorId: user.id,
        action: "auth.dev_login",
        targetType: "User",
        targetId: user.id,
      });

      return toUserDto(user);
    },
  );

  // ── Logout ────────────────────────────────────────────────────────────────
  app.post(
    "/auth/logout",
    {
      schema: {
        tags: ["auth"],
        summary: "Clear the session cookie",
        response: { 204: z.null() },
      },
    },
    async (_request, reply) => {
      clearSessionCookie(reply);
      reply.status(204);
      return null;
    },
  );

  // ── GitHub OAuth: begin ───────────────────────────────────────────────────
  app.get(
    "/auth/github",
    {
      schema: {
        tags: ["auth"],
        summary: "Begin GitHub OAuth login",
        response: { 302: z.null(), 501: ErrorResponseSchema },
      },
    },
    async (_request, reply) => {
      const clientId = app.config.GITHUB_OAUTH_CLIENT_ID;
      if (!clientId || !app.config.GITHUB_OAUTH_CLIENT_SECRET) {
        reply.status(501).send({
          error: {
            code: "INTERNAL",
            message: "GitHub OAuth is not configured",
            httpStatus: 501,
          },
        });
        return;
      }

      const state = crypto.randomUUID();
      reply.setCookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: "lax",
        secure: app.config.NODE_ENV === "production",
        path: "/",
        maxAge: 600,
      });

      const redirectUri = `${app.config.PUBLIC_API_URL}/api/v1/auth/github/callback`;
      const url = new URL("https://github.com/login/oauth/authorize");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", "read:user user:email");
      url.searchParams.set("state", state);
      reply.redirect(url.toString(), 302);
    },
  );

  // ── GitHub OAuth: callback ────────────────────────────────────────────────
  app.get(
    "/auth/github/callback",
    {
      schema: {
        tags: ["auth"],
        summary: "Complete GitHub OAuth login",
        querystring: z.object({
          code: z.string().min(1).optional(),
          state: z.string().min(1).optional(),
        }),
        response: {
          302: z.null(),
          400: ErrorResponseSchema,
          501: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const clientId = app.config.GITHUB_OAUTH_CLIENT_ID;
      const clientSecret = app.config.GITHUB_OAUTH_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        reply.status(501).send({
          error: {
            code: "INTERNAL",
            message: "GitHub OAuth is not configured",
            httpStatus: 501,
          },
        });
        return;
      }

      const { code, state } = request.query;
      const expectedState = request.cookies[OAUTH_STATE_COOKIE];
      reply.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
      if (!code || !state || !expectedState || state !== expectedState) {
        reply.status(400).send({
          error: {
            code: "VALIDATION",
            message: "Invalid OAuth state or missing code",
            httpStatus: 400,
          },
        });
        return;
      }

      // A single 400 helper for any failure exchanging the code or fetching the
      // profile. We never echo GitHub's response body (it can contain the
      // submitted client_secret in some 422 error shapes).
      const oauthFailed = (message: string): void => {
        reply.status(400).send({
          error: { code: "VALIDATION", message, httpStatus: 400 },
        });
      };

      // Exchange the code for an access token.
      const tokenRes = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
          }),
        },
      );
      if (!tokenRes.ok) {
        oauthFailed("Failed to exchange GitHub authorization code");
        return;
      }
      const tokenJson = (await tokenRes
        .json()
        .catch(() => null)) as { access_token?: string } | null;
      const accessToken = tokenJson?.access_token;
      if (!accessToken) {
        oauthFailed("Failed to obtain GitHub access token");
        return;
      }

      // Fetch the GitHub profile.
      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "shipyard",
        },
      });
      if (!userRes.ok) {
        oauthFailed("Failed to fetch GitHub profile");
        return;
      }
      // Validate the payload: a non-2xx/error body has no numeric id, and we
      // must NOT coerce that into a `githubId: "undefined"` account collision.
      const ghParsed = GitHubUserSchema.safeParse(
        await userRes.json().catch(() => null),
      );
      if (!ghParsed.success) {
        oauthFailed("GitHub profile response was invalid");
        return;
      }
      const gh = ghParsed.data;
      const email = gh.email ?? `${gh.login}@users.noreply.github.com`;

      const name = gh.name ?? null;
      const avatarUrl = gh.avatar_url ?? null;

      // Upsert the user keyed on the stable GitHub id.
      const user = await app.prisma.user.upsert({
        where: { githubId: String(gh.id) },
        create: {
          email,
          name,
          avatarUrl,
          githubId: String(gh.id),
          githubLogin: gh.login,
        },
        update: {
          name,
          avatarUrl,
          githubLogin: gh.login,
        },
      });

      await ensureTeamFor(app, user.id, name ?? gh.login);

      const session = await app.signSession(user.id);
      setSessionCookie(app, reply, session);

      await writeAudit(app.prisma, {
        actorId: user.id,
        action: "auth.github_login",
        targetType: "User",
        targetId: user.id,
      });

      reply.redirect(app.config.PUBLIC_APP_URL, 302);
    },
  );
};
