"use client";

/**
 * Server-Sent Events (SSE) helpers for live deployment logs and preview status.
 *
 * `EventSource` only sends credentials (the `sy_session` cookie) for
 * **same-origin** requests, so these hooks connect to the same-origin
 * `/api/v1/...` path, which the Next rewrite forwards to the API. The API SSE
 * endpoints emit each event as a single `data:` JSON line.
 *
 * @module
 */

import { type MutableRefObject, useEffect, useRef, useState } from "react";
import { mutate } from "swr";

import { api, API_BASE, ApiError } from "./api";

import type { LogEvent, PreviewStatusEvent } from "./api-types";

/** Min gap between auth probes so a broken stream can't hammer `/me`. */
const AUTH_PROBE_THROTTLE_MS = 4000;

/**
 * Handle an `EventSource` error by distinguishing a *transient* connection
 * problem (let it auto-reconnect) from an *expired session* (401). On a 401 we
 * close the stream and revalidate `/me`, which makes the mounted `AuthGuard`
 * redirect to `/login?next=...` instead of the stream retrying forever.
 *
 * Throttled + latched via the passed refs so a rapidly-firing `onerror` never
 * spins up a tight probe loop.
 *
 * @param source - The erroring `EventSource` (closed on confirmed expiry).
 * @param expiredRef - Latch: set once a 401 is confirmed (stops further probes).
 * @param lastProbeRef - Timestamp of the last probe (throttle guard).
 */
function handleStreamError(
  source: EventSource,
  expiredRef: MutableRefObject<boolean>,
  lastProbeRef: MutableRefObject<number>,
): void {
  if (expiredRef.current) return;
  const now = Date.now();
  if (now - lastProbeRef.current < AUTH_PROBE_THROTTLE_MS) return;
  lastProbeRef.current = now;

  // Probe an authenticated endpoint once. 200 → session fine, allow reconnect.
  // 401 → session expired: stop and surface the auth path. Network/5xx → treat
  // as transient and allow the normal `EventSource` reconnect.
  void api.me().catch((err: unknown) => {
    if (err instanceof ApiError && err.isUnauthorized) {
      expiredRef.current = true;
      source.close();
      // Revalidate the `/me` cache so AuthGuard observes the 401 and redirects
      // to /login (carrying ?next).
      void mutate("/me");
    }
  });
}

/** Connection lifecycle state for an SSE stream. */
export type StreamState = "connecting" | "open" | "closed" | "error";

/** Result of the {@link useDeploymentLogs} hook. */
export interface DeploymentLogsResult {
  /** All log lines received so far, in arrival order. */
  logs: LogEvent[];
  /** The connection state. */
  state: StreamState;
  /** Clear the buffered logs (does not affect the connection). */
  clear: () => void;
}

/** Maximum buffered log lines before older lines are dropped (memory guard). */
const MAX_LOG_LINES = 5000;

/**
 * Subscribe to a deployment's live log stream via SSE.
 *
 * Backfilled persisted chunks arrive first, then live lines. Pass `null`/
 * `undefined` (or `enabled: false`) to keep the stream closed (e.g. while the
 * id is still loading or the user paused the tail).
 *
 * @param deploymentId - The deployment to stream, or nullish to stay closed.
 * @param options - `{ enabled }` to gate the connection (default enabled).
 * @returns The buffered {@link LogEvent}s, the {@link StreamState}, and `clear`.
 */
export function useDeploymentLogs(
  deploymentId: string | null | undefined,
  options: { enabled?: boolean } = {},
): DeploymentLogsResult {
  const enabled = options.enabled ?? true;
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [state, setState] = useState<StreamState>("connecting");
  const seqRef = useRef<Set<number>>(new Set());
  const authExpiredRef = useRef(false);
  const lastProbeRef = useRef(0);

  useEffect(() => {
    if (!deploymentId || !enabled) {
      setState("closed");
      return;
    }

    setState("connecting");
    seqRef.current = new Set();
    setLogs([]);
    authExpiredRef.current = false;
    lastProbeRef.current = 0;

    const url = `${API_BASE}/deployments/${deploymentId}/logs`;
    const source = new EventSource(url, { withCredentials: true });

    source.onopen = () => setState("open");

    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as LogEvent;
        // De-dupe by seq (backfill + a reconnect can re-send lines).
        if (seqRef.current.has(parsed.seq)) return;
        seqRef.current.add(parsed.seq);
        setLogs((prev) => {
          const next = [...prev, parsed];
          return next.length > MAX_LOG_LINES
            ? next.slice(next.length - MAX_LOG_LINES)
            : next;
        });
      } catch {
        // Ignore malformed lines (heartbeats are comment lines, not data).
      }
    };

    source.onerror = () => {
      // EventSource auto-reconnects; surface the transient error state and
      // probe for an expired session (401) so we don't retry forever.
      setState("error");
      handleStreamError(source, authExpiredRef, lastProbeRef);
    };

    return () => {
      source.close();
      setState("closed");
    };
  }, [deploymentId, enabled]);

  return {
    logs,
    state,
    clear: () => {
      seqRef.current = new Set();
      setLogs([]);
    },
  };
}

/** Result of the {@link usePreviewStatus} hook. */
export interface PreviewStatusResult {
  /** The latest streamed status event, or `null` before the first event. */
  event: PreviewStatusEvent | null;
  /** The connection state. */
  state: StreamState;
}

/**
 * Subscribe to a preview's live status stream via SSE.
 *
 * The current status is delivered immediately on connect, then live transitions
 * follow. Pass `null`/`undefined` (or `enabled: false`) to keep it closed.
 *
 * @param previewId - The preview to stream, or nullish to stay closed.
 * @param options - `{ enabled }` to gate the connection (default enabled).
 * @returns The latest {@link PreviewStatusEvent} and the {@link StreamState}.
 */
export function usePreviewStatus(
  previewId: string | null | undefined,
  options: { enabled?: boolean } = {},
): PreviewStatusResult {
  const enabled = options.enabled ?? true;
  const [event, setEvent] = useState<PreviewStatusEvent | null>(null);
  const [state, setState] = useState<StreamState>("connecting");
  const authExpiredRef = useRef(false);
  const lastProbeRef = useRef(0);

  useEffect(() => {
    if (!previewId || !enabled) {
      setState("closed");
      return;
    }

    setState("connecting");
    authExpiredRef.current = false;
    lastProbeRef.current = 0;
    const url = `${API_BASE}/previews/${previewId}/status`;
    const source = new EventSource(url, { withCredentials: true });

    source.onopen = () => setState("open");
    source.onmessage = (e) => {
      try {
        setEvent(JSON.parse(e.data) as PreviewStatusEvent);
        setState("open");
      } catch {
        // Ignore malformed/heartbeat lines.
      }
    };
    source.onerror = () => {
      // Surface the error and probe for an expired session (401).
      setState("error");
      handleStreamError(source, authExpiredRef, lastProbeRef);
    };

    return () => {
      source.close();
      setState("closed");
    };
  }, [previewId, enabled]);

  return { event, state };
}
