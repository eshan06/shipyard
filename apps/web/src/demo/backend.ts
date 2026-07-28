/**
 * The demo's fake backend.
 *
 * Installs a `fetch` interceptor for `/api/v1/*` and a drop-in `EventSource`
 * replacement, both served from the in-memory {@link db}. Because the app's
 * only two network seams are `fetch` (via the typed client) and `EventSource`
 * (via the SSE hooks), swapping them means every page, SWR cache, mutation and
 * live-update path is the *real* dashboard code — only the server is fake.
 *
 * @module
 */

import {
  cancelDeployment,
  costRecordsFor,
  createToken,
  db,
  deploymentsFor,
  destroyPreview,
  findPreview,
  pinPreview,
  resumeInFlightDeploys,
  revokeToken,
  servicesFor,
  startDeploy,
  stopPreview,
  subscribeLogs,
  subscribeStatus,
} from "./store";

/** Simulated network latency, so loading states are visible but not annoying. */
const LATENCY_MS = 120;

/** JSON response helper. */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The API's standard error envelope. */
function apiError(code: string, message: string, status: number): Response {
  return json({ error: { code, message, httpStatus: status } }, status);
}

/** A cursor-paginated list envelope, honouring `limit`. */
function list<T>(rows: T[], params: URLSearchParams): Response {
  const limit = Number(params.get("limit") ?? 50);
  const sliced = Number.isFinite(limit) && limit > 0 ? rows.slice(0, limit) : rows;
  return json({ data: sliced, nextCursor: null });
}

/** Await the simulated latency. */
function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
}

/**
 * Resolve one API request against the in-memory database.
 *
 * @param method - HTTP method.
 * @param path - Path *after* `/api/v1` (e.g. `/previews/prev_1`).
 * @param params - Parsed query string.
 * @param body - Parsed JSON request body, when present.
 */
function route(
  method: string,
  path: string,
  params: URLSearchParams,
  body: Record<string, unknown> | undefined,
): Response {
  const segments = path.split("/").filter(Boolean);
  const [head, id, sub, subId] = segments;

  // ── Auth + identity ───────────────────────────────────────────────────────
  if (path === "/me") return json(db.me);
  if (path === "/auth/dev-login") return json(db.me.user);
  if (path === "/auth/logout") return new Response(null, { status: 204 });
  if (path === "/telemetry") return new Response(null, { status: 202 });

  // ── Previews ──────────────────────────────────────────────────────────────
  if (head === "previews") {
    if (!id) {
      let rows = db.previews;
      const status = params.get("status");
      const projectId = params.get("projectId");
      if (status) rows = rows.filter((p) => p.status === status);
      if (projectId) rows = rows.filter((p) => p.projectId === projectId);
      // Newest activity first, matching the API's default ordering.
      rows = [...rows].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      return list(rows, params);
    }

    const preview = findPreview(id);
    if (!preview) return apiError("NOT_FOUND", "Preview not found", 404);

    /** A preview plus the relations the detail page needs. */
    const detail = () => ({
      ...findPreview(id)!,
      services: servicesFor(id),
      reviewerCount: db.reviews.filter((r) => r.previewId === id).length,
    });

    if (!sub) return json(detail());
    if (sub === "services") return list(servicesFor(id), params);
    if (sub === "reviews") return list(db.reviews.filter((r) => r.previewId === id), params);
    if (sub === "env") {
      // Preview-scoped view: the owning project's vars, secrets masked.
      const vars = db.envVars.filter((v) => v.projectId === preview.projectId);
      return list(vars, params);
    }
    if (sub === "costs") {
      const records = costRecordsFor(id);
      const totalUsd = Number(
        records.reduce((sum, r) => sum + r.estimatedUsd, 0).toFixed(4),
      );
      return json({ data: records, totalUsd, nextCursor: null });
    }
    if (sub === "deployments") return list(deploymentsFor(id), params);

    if (method === "POST") {
      // DESTROYED is terminal in the real status machine — its containers,
      // network and service rows are gone, so neither redeploy nor stop can
      // legally apply. Refuse the same way the API's CAS guard would.
      if (
        preview.status === "DESTROYED" &&
        (sub === "redeploy" || sub === "stop" || sub === "destroy")
      ) {
        return apiError(
          "CONFLICT",
          "This preview has been destroyed. Reopen or push to the pull request to create a new one.",
          409,
        );
      }
      if (sub === "redeploy") {
        startDeploy(id, "REDEPLOY");
        return json(detail());
      }
      if (sub === "stop") {
        stopPreview(id);
        return json(detail());
      }
      if (sub === "destroy") {
        destroyPreview(id);
        return json(detail());
      }
      if (sub === "pin") {
        pinPreview(id, Boolean(body?.pinned ?? !preview.isPinned));
        return json(detail());
      }
    }
    return apiError("NOT_FOUND", `Unhandled preview route ${path}`, 404);
  }

  // ── Deployments + builds ──────────────────────────────────────────────────
  if (head === "deployments") {
    if (!id) {
      let rows = db.deployments;
      const previewId = params.get("previewId");
      const status = params.get("status");
      if (previewId) rows = rows.filter((d) => d.previewId === previewId);
      if (status) rows = rows.filter((d) => d.status === status);
      rows = [...rows].sort(
        (a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime(),
      );
      return list(rows, params);
    }
    const deployment = db.deployments.find((d) => d.id === id);
    if (!deployment) return apiError("NOT_FOUND", "Deployment not found", 404);
    if (sub === "cancel" && method === "POST") return json(cancelDeployment(id));
    return json(deployment);
  }

  if (head === "builds" && id) {
    const deployment = db.deployments.find((d) => d.build?.id === id);
    if (!deployment?.build) return apiError("NOT_FOUND", "Build not found", 404);
    return json(deployment.build);
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  if (head === "projects") {
    if (!id) return list(db.projects, params);
    const project = db.projects.find((p) => p.id === id);
    if (!project) return apiError("NOT_FOUND", "Project not found", 404);

    // Env vars: full CRUD so the project settings UI actually works.
    if (sub === "env") {
      if (method === "POST") {
        const created = {
          id: `env_${Math.random().toString(36).slice(2, 9)}`,
          projectId: id!,
          key: String(body?.key ?? "NEW_VAR"),
          scope: (body?.scope as "PROJECT" | "PREVIEW") ?? "PROJECT",
          target: (body?.target as "BUILD" | "RUNTIME" | "BOTH") ?? "RUNTIME",
          isSecret: Boolean(body?.isSecret),
          // Secret values are never echoed back, exactly as the API behaves.
          value: body?.isSecret ? null : String(body?.value ?? ""),
        };
        db.envVars.push(created);
        return json(created, 201);
      }
      if (subId && (method === "PATCH" || method === "PUT")) {
        const existing = db.envVars.find((v) => v.id === subId);
        if (!existing) return apiError("NOT_FOUND", "Env var not found", 404);
        if (body?.key !== undefined) existing.key = String(body.key);
        if (body?.target !== undefined) existing.target = body.target as typeof existing.target;
        if (body?.isSecret !== undefined) existing.isSecret = Boolean(body.isSecret);
        if (body?.value !== undefined) {
          existing.value = existing.isSecret ? null : String(body.value);
        }
        return json(existing);
      }
      if (subId && method === "DELETE") {
        db.envVars = db.envVars.filter((v) => v.id !== subId);
        return new Response(null, { status: 204 });
      }
      return list(db.envVars.filter((v) => v.projectId === id), params);
    }

    // Seed templates: create/delete + set-default.
    if (sub === "seeds") {
      if (method === "POST") {
        const created = {
          id: `seed_${Math.random().toString(36).slice(2, 9)}`,
          projectId: id!,
          name: String(body?.name ?? "New seed"),
          kind: (body?.kind as "SQL" | "SCRIPT" | "SNAPSHOT") ?? "SQL",
          source: String(body?.source ?? ""),
          isDefault: Boolean(body?.isDefault),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (created.isDefault) {
          for (const s of db.seeds) if (s.projectId === id) s.isDefault = false;
        }
        db.seeds.push(created);
        return json(created, 201);
      }
      if (subId && method === "DELETE") {
        db.seeds = db.seeds.filter((s) => s.id !== subId);
        return new Response(null, { status: 204 });
      }
      if (subId && (method === "PATCH" || method === "PUT")) {
        const existing = db.seeds.find((s) => s.id === subId);
        if (!existing) return apiError("NOT_FOUND", "Seed template not found", 404);
        if (body?.isDefault) {
          for (const s of db.seeds) if (s.projectId === id) s.isDefault = false;
        }
        Object.assign(existing, body, { updatedAt: new Date().toISOString() });
        return json(existing);
      }
      return list(db.seeds.filter((s) => s.projectId === id), params);
    }

    // Project settings updates (auto-deploy, idle timeout, TTL, archive…).
    if (method === "PATCH" || method === "PUT") {
      Object.assign(project, body, { updatedAt: new Date().toISOString() });
      return json(project);
    }
    if (method === "DELETE") {
      db.projects = db.projects.filter((p) => p.id !== id);
      return new Response(null, { status: 204 });
    }
    return json(project);
  }

  // ── Pull requests ─────────────────────────────────────────────────────────
  if (head === "pull-requests") {
    let rows = db.pullRequests;
    const projectId = params.get("projectId");
    const state = params.get("state");
    if (projectId) rows = rows.filter((pr) => pr.projectId === projectId);
    if (state) rows = rows.filter((pr) => pr.state === state);
    // The API embeds each PR's previews.
    const withPreviews = rows.map((pr) => ({
      ...pr,
      previews: db.previews
        .filter((p) => p.pullRequestId === pr.id)
        .map((p) => ({ id: p.id, slug: p.slug, status: p.status, url: p.url, createdAt: p.createdAt })),
    }));
    return list(withPreviews, params);
  }

  // ── Costs, notifications, audit ───────────────────────────────────────────
  if (path === "/costs/summary") return json(db.costSummary);
  if (head === "notifications") return list(db.notifications, params);
  if (head === "audit") return list(db.auditLogs, params);

  // ── Team API tokens ───────────────────────────────────────────────────────
  if (head === "teams" && sub === "tokens") {
    if (method === "GET") return list(db.tokens.filter((t) => t.teamId === id), params);
    if (method === "POST") {
      const created = createToken(
        id!,
        String(body?.name ?? "New token"),
        (body?.scopes as string[] | undefined) ?? ["previews:read"],
      );
      return json(created, 201);
    }
    if (method === "DELETE" && subId) {
      revokeToken(subId);
      return new Response(null, { status: 204 });
    }
  }

  return apiError("NOT_FOUND", `No demo handler for ${method} ${path}`, 404);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fake EventSource
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A minimal `EventSource` stand-in wired to the in-memory store.
 *
 * Implements only what the SSE hooks use (`onopen`, `onmessage`, `onerror`,
 * `close`, `readyState`), and pushes the same `data:`-JSON payload shape the
 * real API emits, so `useDeploymentLogs` / `usePreviewStatus` are unmodified.
 */
class DemoEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readonly url: string;
  readonly withCredentials = true;
  readyState: number = DemoEventSource.CONNECTING;

  onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
  onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null;
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;

  /** Detaches this stream from the store. */
  private unsubscribe: (() => void) | undefined;

  constructor(url: string | URL) {
    super();
    this.url = String(url);

    // Connect on a microtask-ish delay so consumers can attach handlers first.
    setTimeout(() => this.connect(), 40);
  }

  /** Resolve the URL to a store subscription and start pushing events. */
  private connect(): void {
    if (this.readyState === DemoEventSource.CLOSED) return;
    this.readyState = DemoEventSource.OPEN;
    this.onopen?.call(this as unknown as EventSource, new Event("open"));

    const push = (payload: unknown): void => {
      if (this.readyState !== DemoEventSource.OPEN) return;
      const event = new MessageEvent("message", { data: JSON.stringify(payload) });
      this.onmessage?.call(this as unknown as EventSource, event);
      this.dispatchEvent(event);
    };

    const path = this.url.replace(/^.*\/api\/v1/, "");
    const logs = /^\/deployments\/([^/]+)\/logs/.exec(path);
    if (logs) {
      this.unsubscribe = subscribeLogs(logs[1]!, push);
      return;
    }
    const previewLogs = /^\/previews\/([^/]+)\/logs/.exec(path);
    if (previewLogs) {
      // Mirror the API: resolve the preview's latest deployment, stream that.
      const latest = deploymentsFor(previewLogs[1]!)[0];
      if (latest) this.unsubscribe = subscribeLogs(latest.id, push);
      return;
    }
    const status = /^\/previews\/([^/]+)\/status/.exec(path);
    if (status) {
      this.unsubscribe = subscribeStatus(status[1]!, push);
      return;
    }
    // Unknown stream: behave like a failed connection.
    this.onerror?.call(this as unknown as EventSource, new Event("error"));
  }

  /** Close the stream and detach from the store. */
  close(): void {
    this.readyState = DemoEventSource.CLOSED;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Installation
// ─────────────────────────────────────────────────────────────────────────────

/** Guard so repeated imports (Fast Refresh, re-mounts) install exactly once. */
let installed = false;

/**
 * Patch `window.fetch`, `window.EventSource` and `navigator.sendBeacon` so all
 * `/api/v1` traffic is served locally. Requests to any other origin (fonts,
 * assets) pass through untouched.
 */
export function installDemoBackend(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    const match = /\/api\/v1(\/[^?]*)(\?.*)?$/.exec(url);
    if (!match) return originalFetch(input as RequestInfo, init);

    const path = match[1]!;
    const params = new URLSearchParams(match[2] ?? "");

    let body: Record<string, unknown> | undefined;
    const raw = init?.body;
    if (typeof raw === "string" && raw.length > 0) {
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        body = undefined;
      }
    }

    await delay();
    try {
      return route(method, path, params, body);
    } catch (error) {
      return apiError(
        "INTERNAL",
        error instanceof Error ? error.message : "demo backend error",
        500,
      );
    }
  };

  (window as unknown as { EventSource: unknown }).EventSource = DemoEventSource;

  // The seeded snapshot has one preview mid-build; let it finish on its own so
  // a visitor sees a live build go green instead of a permanently stuck row.
  resumeInFlightDeploys();

  // Analytics uses sendBeacon on unload; swallow it rather than 404.
  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const originalBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null): boolean =>
      String(url).includes("/api/v1") ? true : originalBeacon(url, data);
  }
}
