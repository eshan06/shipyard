/**
 * Runtime same-origin API proxy.
 *
 * The dashboard talks to the API **same-origin** (`/api/v1/...`) so the browser
 * attaches the `sy_session` cookie automatically and — critically — so
 * `EventSource` (SSE) can authenticate, since it cannot send credentials
 * cross-origin.
 *
 * This is a catch-all Route Handler (not a `next.config` rewrite) on purpose:
 * `next build` freezes `rewrites()` into the routes manifest, so a rewrite
 * destination reads its env at BUILD time — the runtime `API_URL` in prod
 * compose/k8s would have no effect. A Route Handler reads
 * `process.env.API_URL` on every request, at RUNTIME, which is what a
 * container-configured deploy needs.
 *
 * It forwards every method, streams request/response bodies (Web streams — so
 * `text/event-stream` SSE is never buffered), forwards the incoming `cookie`
 * header and query string, and passes the upstream `set-cookie` header(s) and
 * status straight back so the session cookie round-trips first-party.
 *
 * @module
 */

import type { NextRequest } from "next/server";

/** Read the upstream API origin at runtime (never baked into the bundle). */
function apiOrigin(): string {
  const raw =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000";
  return raw.replace(/\/+$/, "");
}

/** Request/response headers that must not be copied verbatim when proxying. */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  // `content-length` is recomputed by the runtime; `host` must match the target.
  "content-length",
  "host",
]);

/**
 * Forward one request to the upstream API and stream the response back.
 *
 * @param request - The incoming Next request.
 * @param path - The captured `[...path]` segments after `/api/v1/`.
 */
async function proxy(
  request: NextRequest,
  path: string[],
): Promise<Response> {
  const target = `${apiOrigin()}/api/v1/${path
    .map((p) => encodeURIComponent(p))
    .join("/")}${request.nextUrl.search}`;

  // Copy inbound headers (incl. `cookie`) minus hop-by-hop / host.
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers,
    // Preserve auth/OAuth redirects (e.g. `/auth/github`) as-is instead of
    // following them server-side.
    redirect: "manual",
  };
  if (hasBody) {
    init.body = request.body;
    // Required by the Node/undici fetch when the body is a stream.
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return new Response(
      JSON.stringify({
        error: { code: "BAD_GATEWAY", message: "Upstream API unreachable" },
      }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  // Rebuild response headers: drop hop-by-hop + `content-encoding`/`length`
  // (undici already decoded the body stream we forward), and re-attach each
  // `set-cookie` individually so the `sy_session` cookie is not mangled.
  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "set-cookie") return;
    if (lower === "content-encoding" || lower === "content-length") return;
    if (HOP_BY_HOP.has(lower)) return;
    outHeaders.set(key, value);
  });
  const setCookies = upstream.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) outHeaders.append("set-cookie", cookie);

  // Return the upstream body stream directly so SSE (`text/event-stream`) is
  // passed through unbuffered.
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

/** Next 15 passes route params as a promise. */
type Ctx = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { path } = await ctx.params;
  return proxy(request, path ?? []);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;

/** Read config + cookies at request time; never statically cache the proxy. */
export const dynamic = "force-dynamic";
/** Node runtime: streaming request bodies + `getSetCookie()` need it. */
export const runtime = "nodejs";
