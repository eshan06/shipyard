/**
 * Authentication plugin.
 *
 * Populates `request.auth` on every request from one of two schemes:
 *
 * 1. **Session cookie** (`sy_session`) — a signed HS256 JWT carrying `userId`,
 *    used by the browser dashboard.
 * 2. **Bearer token** (`Authorization: Bearer <token>`) — a SHA-256-hashed API
 *    token looked up in `ApiToken`, used by the CLI/CI.
 *
 * It also decorates `app.signSession` (mint a session JWT), `app.requireAuth`
 * (a preHandler that 401s anonymous callers), and exports cookie helpers so the
 * auth routes can set/clear the session cookie consistently.
 *
 * @module
 */

import fp from "fastify-plugin";
import { SignJWT, jwtVerify } from "jose";

import { UnauthorizedError } from "@shipyard/core";

import { hashToken } from "../lib/tokens.js";

import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from "fastify";

/** Name of the session cookie. */
export const SESSION_COOKIE = "sy_session";
/** JWT `alg` used for session tokens. */
const JWT_ALG = "HS256";
/** Session lifetime. */
const SESSION_TTL = "30d";
/** Session cookie max-age in seconds (must match {@link SESSION_TTL}). */
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Derive the symmetric signing key for session JWTs from the session secret.
 *
 * @param secret - The configured `SESSION_SECRET`.
 * @returns The key bytes as a `Uint8Array` (jose's expected form for HS256).
 */
function sessionKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Set the session cookie on a reply (httpOnly, sameSite=lax, secure in prod).
 *
 * @param app - The Fastify instance (for config + cookie plugin).
 * @param reply - The reply to attach the cookie to.
 * @param token - The signed session JWT.
 */
export function setSessionCookie(
  app: FastifyInstance,
  reply: FastifyReply,
  token: string,
): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: app.config.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Clear the session cookie on a reply.
 *
 * @param reply - The reply to clear the cookie on.
 */
export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

/**
 * Extract a bearer token from the `Authorization` header, if present.
 *
 * @param request - The incoming request.
 * @returns The raw token, or `undefined` when no bearer header is present.
 */
function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1];
}

/**
 * Register the auth plugin.
 *
 * @param app - The Fastify instance.
 */
async function authPlugin(app: FastifyInstance): Promise<void> {
  const key = sessionKey(app.config.SESSION_SECRET);

  app.decorate("signSession", async (userId: string): Promise<string> => {
    return new SignJWT({})
      .setProtectedHeader({ alg: JWT_ALG })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(SESSION_TTL)
      .sign(key);
  });

  const requireAuth: preHandlerHookHandler = async (request) => {
    if (!request.auth) {
      throw new UnauthorizedError();
    }
  };
  app.decorate("requireAuth", requireAuth);

  // Populate request.auth before any route/preHandler runs.
  app.addHook("onRequest", async (request: FastifyRequest) => {
    request.auth = null;

    // 1. Session cookie.
    const cookie = request.cookies[SESSION_COOKIE];
    if (cookie) {
      try {
        const { payload } = await jwtVerify(cookie, key, {
          algorithms: [JWT_ALG],
        });
        if (typeof payload.sub === "string" && payload.sub.length > 0) {
          request.auth = { userId: payload.sub, kind: "session" };
          return;
        }
      } catch {
        // Invalid/expired session — fall through to bearer / anonymous.
      }
    }

    // 2. Bearer API token.
    const raw = bearerToken(request);
    if (raw) {
      const token = await app.prisma.apiToken.findUnique({
        where: { hashedToken: hashToken(raw) },
        select: { id: true, userId: true, revokedAt: true, expiresAt: true },
      });
      const now = new Date();
      const valid =
        token &&
        token.userId &&
        token.revokedAt === null &&
        (token.expiresAt === null || token.expiresAt > now);
      if (valid && token.userId) {
        request.auth = {
          userId: token.userId,
          kind: "token",
          tokenId: token.id,
        };
        // Best-effort last-used bookkeeping; never block the request on it.
        void app.prisma.apiToken
          .update({ where: { id: token.id }, data: { lastUsedAt: now } })
          .catch(() => undefined);
        return;
      }
    }

    // 3. Anonymous (request.auth stays null).
  });
}

export default fp(authPlugin, { name: "auth", dependencies: ["prisma"] });
