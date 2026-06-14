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

import { useEffect, useRef, useState } from "react";

import { API_BASE } from "./api";

import type { LogEvent, PreviewStatusEvent } from "./api-types";

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

  useEffect(() => {
    if (!deploymentId || !enabled) {
      setState("closed");
      return;
    }

    setState("connecting");
    seqRef.current = new Set();
    setLogs([]);

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
      // EventSource auto-reconnects; surface the transient error state.
      setState((prev) => (prev === "open" ? "error" : "error"));
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

  useEffect(() => {
    if (!previewId || !enabled) {
      setState("closed");
      return;
    }

    setState("connecting");
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
    source.onerror = () => setState("error");

    return () => {
      source.close();
      setState("closed");
    };
  }, [previewId, enabled]);

  return { event, state };
}
