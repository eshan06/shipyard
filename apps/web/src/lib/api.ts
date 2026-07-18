/**
 * Typed Shipyard API client.
 *
 * All requests go to the **same-origin** `/api/v1` base, which Next rewrites to
 * the real API (`NEXT_PUBLIC_API_URL`). Same-origin is important: it lets the
 * browser attach the `sy_session` cookie automatically (`credentials:
 * "include"`) and — critically — lets `EventSource` (SSE) authenticate, since
 * `EventSource` cannot send credentials cross-origin.
 *
 * Every method throws an {@link ApiError} parsed from the standard error
 * envelope on non-2xx responses.
 *
 * @module
 */

import type {
  ApiToken,
  AuditLog,
  Build,
  CostSummary,
  CreatedApiToken,
  Deployment,
  EnvVar,
  ErrorResponse,
  ListResponse,
  MeResponse,
  Notification,
  Preview,
  PreviewCostsResponse,
  PreviewDetail,
  Project,
  PullRequest,
  Review,
  SeedTemplate,
  Service,
  User,
} from "./api-types";
import type {
  DeploymentStatus,
  PreviewStatus,
  PullRequestState,
} from "@shipyard/core";

/**
 * The same-origin API base. The Next rewrite in `next.config.mjs` forwards this
 * to the real API service so cookies and SSE stay first-party.
 */
export const API_BASE = "/api/v1";

/** Common pagination/list query options. */
export interface ListQuery {
  cursor?: string;
  limit?: number;
  order?: "asc" | "desc";
  /**
   * Index signature so a `ListQuery` (and its intersections with extra
   * string/number filter fields) is assignable to the {@link qs} query builder.
   */
  [key: string]: string | number | undefined;
}

/**
 * A typed error thrown for non-2xx API responses, carrying the parsed error
 * envelope fields.
 */
export class ApiError extends Error {
  /** Machine-readable error code from the envelope (e.g. `"NOT_FOUND"`). */
  readonly code: string;
  /** The HTTP status code. */
  readonly status: number;
  /** Optional structured details (e.g. zod field issues). */
  readonly details?: unknown;

  /**
   * @param code - Machine-readable error code.
   * @param message - Human-readable message.
   * @param status - HTTP status code.
   * @param details - Optional structured details.
   */
  constructor(
    code: string,
    message: string,
    status: number,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** Whether this error is an authentication failure (HTTP 401). */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/** Build a query string from a record, skipping nullish values. */
function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}

/**
 * Core fetch wrapper: sends/receives JSON, includes credentials, and converts
 * non-2xx responses into a typed {@link ApiError}.
 *
 * @param path - The path under {@link API_BASE} (e.g. `/previews`).
 * @param init - Standard `fetch` init.
 * @returns The parsed JSON body, or `undefined` for 204 responses.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    // Spread `init` first so a caller's `headers` can't clobber
    // Content-Type/Accept and `credentials` can't be overridden: defaults are
    // merged under the caller's headers, and credentials is always included.
    credentials: "include",
    headers: {
      // Only advertise a JSON body when there actually is one. A bodyless
      // request (GET, and crucially DELETE) that still sends
      // `Content-Type: application/json` makes the API's JSON body parser reject
      // it with 400 "Body cannot be empty" — which silently broke every revoke /
      // delete action.
      ...(init?.body != null ? { "Content-Type": "application/json" } : {}),
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const envelope = body as Partial<ErrorResponse> | null;
    const err = envelope?.error;
    throw new ApiError(
      err?.code ?? "INTERNAL",
      err?.message ?? res.statusText ?? "Request failed",
      err?.httpStatus ?? res.status,
      err?.details,
    );
  }

  return body as T;
}

/**
 * The Shipyard API client. A small surface of named methods for the views built
 * now, plus generic `get/post/patch/del` so later waves can extend it without
 * touching this module.
 */
export const api = {
  /** Low-level GET. */
  get: <T>(path: string): Promise<T> => request<T>(path),
  /** Low-level POST with an optional JSON body. */
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  /** Low-level PATCH with a JSON body. */
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  /** Low-level DELETE. */
  del: <T>(path: string): Promise<T> =>
    request<T>(path, { method: "DELETE" }),

  // ── Auth ──────────────────────────────────────────────────────────────────
  /** Dev-only password-less login for a seeded user. */
  devLogin: (email: string): Promise<User> =>
    request<User>("/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  /** Clear the session cookie. */
  logout: (): Promise<void> =>
    request<void>("/auth/logout", { method: "POST" }),
  /** URL to begin GitHub OAuth (full navigation, not fetch). */
  githubAuthUrl: (): string => `${API_BASE}/auth/github`,
  /** Get the current user + memberships. */
  me: (): Promise<MeResponse> => request<MeResponse>("/me"),

  // ── Previews ────────────────────────────────────────────────────────────--
  /** List previews, optionally filtered by project/status. */
  listPreviews: (
    query: ListQuery & { projectId?: string; status?: PreviewStatus } = {},
  ): Promise<ListResponse<Preview>> =>
    request<ListResponse<Preview>>(
      `/previews${qs({
        cursor: query.cursor,
        limit: query.limit,
        order: query.order,
        projectId: query.projectId,
        status: query.status,
      })}`,
    ),
  /** Get a preview with full detail. */
  getPreview: (id: string): Promise<PreviewDetail> =>
    request<PreviewDetail>(`/previews/${id}`),
  /** Re-deploy a preview's current commit. */
  redeployPreview: (id: string): Promise<PreviewDetail> =>
    request<PreviewDetail>(`/previews/${id}/redeploy`, { method: "POST" }),
  /** Stop a running preview (idle teardown). */
  stopPreview: (id: string): Promise<PreviewDetail> =>
    request<PreviewDetail>(`/previews/${id}/stop`, { method: "POST" }),
  /** Permanently destroy a preview. */
  destroyPreview: (id: string): Promise<PreviewDetail> =>
    request<PreviewDetail>(`/previews/${id}/destroy`, { method: "POST" }),
  /** Pin or unpin a preview. */
  pinPreview: (id: string, pinned: boolean): Promise<PreviewDetail> =>
    request<PreviewDetail>(`/previews/${id}/pin`, {
      method: "POST",
      body: JSON.stringify({ pinned }),
    }),
  /** List the services of a preview. */
  listPreviewServices: (
    id: string,
    query: ListQuery = {},
  ): Promise<ListResponse<Service>> =>
    request<ListResponse<Service>>(`/previews/${id}/services${qs(query)}`),
  /** List the reviewers of a preview. */
  listPreviewReviews: (
    id: string,
    query: ListQuery = {},
  ): Promise<ListResponse<Review>> =>
    request<ListResponse<Review>>(`/previews/${id}/reviews${qs(query)}`),
  /** List a preview's env vars (secrets masked). */
  listPreviewEnv: (
    id: string,
    query: ListQuery = {},
  ): Promise<ListResponse<EnvVar>> =>
    request<ListResponse<EnvVar>>(`/previews/${id}/env${qs(query)}`),
  /** Get a preview's cost records (with total). */
  getPreviewCosts: (
    id: string,
    query: ListQuery = {},
  ): Promise<PreviewCostsResponse> =>
    request<PreviewCostsResponse>(`/previews/${id}/costs${qs(query)}`),

  // ── Deployments ──────────────────────────────────────────────────────────-
  /** List deployments, optionally filtered by preview/status. */
  listDeployments: (
    query: ListQuery & { previewId?: string; status?: DeploymentStatus } = {},
  ): Promise<ListResponse<Deployment>> =>
    request<ListResponse<Deployment>>(
      `/deployments${qs({
        cursor: query.cursor,
        limit: query.limit,
        order: query.order,
        previewId: query.previewId,
        status: query.status,
      })}`,
    ),
  /** Get a deployment by id (incl. build + preview ref). */
  getDeployment: (id: string): Promise<Deployment> =>
    request<Deployment>(`/deployments/${id}`),
  /** Cancel an in-flight deployment. */
  cancelDeployment: (id: string): Promise<Deployment> =>
    request<Deployment>(`/deployments/${id}/cancel`, { method: "POST" }),

  // ── Builds ──────────────────────────────────────────────────────────────--
  /** Get a build by id. */
  getBuild: (id: string): Promise<Build> => request<Build>(`/builds/${id}`),

  // ── Projects ────────────────────────────────────────────────────────────--
  /** List projects, optionally filtered by team. */
  listProjects: (
    query: ListQuery & { teamId?: string } = {},
  ): Promise<ListResponse<Project>> =>
    request<ListResponse<Project>>(`/projects${qs(query)}`),
  /** Get a project by id. */
  getProject: (id: string): Promise<Project> =>
    request<Project>(`/projects/${id}`),
  /** List a project's env vars. */
  listProjectEnv: (
    id: string,
    query: ListQuery = {},
  ): Promise<ListResponse<EnvVar>> =>
    request<ListResponse<EnvVar>>(`/projects/${id}/env${qs(query)}`),
  /** List a project's seed templates. */
  listProjectSeeds: (
    id: string,
    query: ListQuery = {},
  ): Promise<ListResponse<SeedTemplate>> =>
    request<ListResponse<SeedTemplate>>(`/projects/${id}/seeds${qs(query)}`),

  // ── Pull requests ──────────────────────────────────────────────────────--
  /** List tracked pull requests. */
  listPullRequests: (
    query: ListQuery & { projectId?: string; state?: PullRequestState } = {},
  ): Promise<ListResponse<PullRequest>> =>
    request<ListResponse<PullRequest>>(
      `/pull-requests${qs({
        cursor: query.cursor,
        limit: query.limit,
        order: query.order,
        projectId: query.projectId,
        state: query.state,
      })}`,
    ),

  // ── Costs ───────────────────────────────────────────────────────────────--
  /** Get the dashboard cost summary for the current month. */
  costsSummary: (): Promise<CostSummary> =>
    request<CostSummary>("/costs/summary"),

  // ── Notifications ──────────────────────────────────────────────────────--
  /** List the current user's notifications. */
  listNotifications: (
    query: ListQuery = {},
  ): Promise<ListResponse<Notification>> =>
    request<ListResponse<Notification>>(`/notifications${qs(query)}`),

  // ── Audit ───────────────────────────────────────────────────────────────--
  /** List audit log entries. */
  listAudit: (query: ListQuery = {}): Promise<ListResponse<AuditLog>> =>
    request<ListResponse<AuditLog>>(`/audit${qs(query)}`),

  // ── Teams / tokens ──────────────────────────────────────────────────────--
  /** List a team's API tokens. */
  listTeamTokens: (teamId: string): Promise<ListResponse<ApiToken>> =>
    request<ListResponse<ApiToken>>(`/teams/${teamId}/tokens`),
  /**
   * Mint a team API token. The raw secret is returned **exactly once** in
   * `token`; only its hash/prefix are persisted server-side, so it can never be
   * retrieved again.
   */
  createTeamToken: (
    teamId: string,
    body: { name: string; scopes?: string[]; expiresAt?: string },
  ): Promise<CreatedApiToken> =>
    request<CreatedApiToken>(`/teams/${teamId}/tokens`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  /** Revoke (delete) a team API token. */
  revokeTeamToken: (teamId: string, tokenId: string): Promise<void> =>
    request<void>(`/teams/${teamId}/tokens/${tokenId}`, { method: "DELETE" }),
};

/** The shape of the {@link api} client (handy for typing props/mocks). */
export type ApiClient = typeof api;
