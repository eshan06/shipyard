/**
 * API-token scope enforcement (least-privilege for bearer tokens).
 *
 * Team RBAC (`lib/rbac.requireTeamRole`) answers "does this *user* have the role
 * this action needs on the owning team?". It does NOT look at the granular
 * scopes an API token was minted with — so, historically, a token minted with
 * read-only scopes (or none at all) could still perform every write/destructive
 * action its owner's role allowed. This module closes that gap: it maps each
 * route to a required {@link ApiScope} and enforces the token carries it.
 *
 * ## Semantics
 *
 * - **Session cookies** (`kind === "session"`) are the browser dashboard acting
 *   as the full user; scopes do not apply and every check passes.
 * - **API tokens** (`kind === "token"`) are checked against their `scopes`
 *   allowlist. Scopes are a *strict allowlist*: a token grants only the actions
 *   whose scope it lists. A token with `scopes: []` therefore has no API
 *   permissions on any scope-gated route (it can still hit the identity/self
 *   endpoints that are intentionally not gated — see below).
 * - A `*` or `admin` scope is a **wildcard** that grants everything. The token
 *   mint path (`POST /teams/:id/tokens`) accepts arbitrary scope strings, so an
 *   operator who wants a full-access token issues one with `["*"]`.
 * - A `<resource>:write` scope **implies** `<resource>:read` (write is strictly
 *   more privileged than read), so a `previews:write` token can also list/read
 *   previews without also listing `previews:read`. This is the "or a broader
 *   one" rule for read routes.
 *
 * ## Scope catalog
 *
 * Scope names follow the `<resource>:<action>` convention documented on
 * `@shipyard/core`'s `ApiTokenCreateSchema` (`previews:read`, `previews:write`,
 * …) and used by the seed (`packages/db/prisma/seed.ts`:
 * `["previews:read", "previews:write", "deployments:write"]`). No new naming
 * convention is invented; the read/write actions are mirrored across the six
 * resource groups the API exposes:
 *
 *   previews:{read,write}  deployments:{read,write}  env:{read,write}
 *   projects:{read,write}  teams:{read,write}        tokens:{read,write}
 *
 * ## Route → scope mapping (enforced via {@link requireScope} preHandlers)
 *
 *   previews:read   GET  /previews, GET /previews/:id,
 *                   GET  /previews/:id/services, /reviews, /costs,
 *                   GET  /previews/:id/logs, /status (SSE),
 *                   GET  /pull-requests, GET /pull-requests/:id
 *   previews:write  POST /previews, PATCH /previews/:id,
 *                   POST /previews/:id/redeploy, /stop, /destroy, /pin
 *   deployments:read   GET /deployments, GET /deployments/:id,
 *                      GET /deployments/:id/logs (SSE), GET /builds/:id
 *   deployments:write  POST /deployments/:id/cancel
 *   env:read        GET  /projects/:id/env, GET /previews/:id/env
 *   env:write       POST /projects/:id/env, POST /previews/:id/env,
 *                   PATCH /env/:id, DELETE /env/:id
 *   projects:read   GET  /projects, GET /projects/:id, GET /projects/:id/seeds
 *   projects:write  POST /projects, PATCH /projects/:id, DELETE /projects/:id,
 *                   POST /projects/:id/seeds, PATCH /seeds/:id, DELETE /seeds/:id
 *   teams:read      GET  /teams, GET /teams/:id, GET /teams/:id/tokens (list),
 *                   GET  /audit, GET /costs/summary
 *   teams:write     POST /teams, PATCH /teams/:id, DELETE /teams/:id
 *   tokens:read     GET  /teams/:id/tokens
 *   tokens:write    POST /teams/:id/tokens, DELETE /teams/:id/tokens/:tokenId
 *
 * Intentionally NOT scope-gated (self-service, not team-resource access): the
 * identity endpoint `GET /me`, the caller's own `/notifications*`, and
 * `POST /telemetry`. Any authenticated principal — session or token — may call
 * these; they expose nothing of another team's data.
 *
 * Note: `GET /teams/:id/tokens` lists token metadata (a team read) and so is
 * satisfied by either `teams:read` or `tokens:read`; it is gated with
 * `tokens:read` to keep token management under the `tokens:*` scopes.
 *
 * @module
 */

import { ForbiddenError, UnauthorizedError } from "@shipyard/core";

import type { preHandlerHookHandler } from "fastify";

/**
 * The canonical set of API-token scopes. `<resource>:<action>` with `read` and
 * `write` actions across the six resource groups the API exposes.
 */
export type ApiScope =
  | "previews:read"
  | "previews:write"
  | "deployments:read"
  | "deployments:write"
  | "env:read"
  | "env:write"
  | "projects:read"
  | "projects:write"
  | "teams:read"
  | "teams:write"
  | "tokens:read"
  | "tokens:write";

/** Scopes that grant every action regardless of the required scope. */
const WILDCARD_SCOPES: readonly string[] = ["*", "admin"];

/**
 * Does a token's granted scopes satisfy `required`?
 *
 * A wildcard (`*`/`admin`) satisfies anything; an exact match satisfies; and a
 * `<resource>:write` grant satisfies the corresponding `<resource>:read`
 * requirement (write implies read).
 *
 * @param granted - The scopes the token carries (`request.auth.scopes`).
 * @param required - The scope the route requires.
 * @returns `true` when the token is authorized for `required`.
 */
export function hasScope(
  granted: readonly string[],
  required: ApiScope,
): boolean {
  if (granted.some((scope) => WILDCARD_SCOPES.includes(scope))) return true;
  if (granted.includes(required)) return true;
  // write implies read on the same resource.
  if (required.endsWith(":read")) {
    const writeVariant = `${required.slice(0, -":read".length)}:write`;
    if (granted.includes(writeVariant)) return true;
  }
  return false;
}

/**
 * Build a preHandler that enforces `scope` on a route.
 *
 * Sessions pass unconditionally (full user privileges). API tokens must carry a
 * scope that satisfies `scope` (see {@link hasScope}) or the request is rejected
 * with a 403 `ForbiddenError`. Anonymous requests never reach here on gated
 * routes (the `app.requireAuth` onRequest hook 401s them first), but this guards
 * defensively regardless.
 *
 * @param scope - The scope the route requires.
 * @returns A Fastify preHandler enforcing the scope.
 */
export function requireScope(scope: ApiScope): preHandlerHookHandler {
  return async (request) => {
    const auth = request.auth;
    if (!auth) throw new UnauthorizedError();
    // Session cookies are the full user; scopes only constrain API tokens.
    if (auth.kind !== "token") return;
    if (!hasScope(auth.scopes ?? [], scope)) {
      throw new ForbiddenError(
        `This API token is missing the required '${scope}' scope`,
      );
    }
  };
}
