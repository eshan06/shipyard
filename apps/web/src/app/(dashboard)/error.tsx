"use client";

import { AlertTriangle } from "lucide-react";
import * as React from "react";

/**
 * Route-level error boundary for the dashboard segment. A render/runtime
 * exception in any dashboard route is caught here and shown as a recoverable,
 * terminal-styled panel with a "Try again" reset — instead of blanking the
 * whole route with Next's default error screen.
 *
 * @param props.error - The thrown error (with an optional `digest`).
 * @param props.reset - Re-renders the segment to attempt recovery.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    // Surface for local debugging / server log correlation via `digest`.
    console.error("[dashboard] render error:", error);
  }, [error]);

  return (
    <div className="page fade-in">
      <div
        className="panel"
        style={{
          maxWidth: 560,
          margin: "8vh auto 0",
          padding: "26px 26px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <span
            className="stat-ic"
            style={{
              color: "var(--red)",
              background: "var(--red-soft)",
              borderColor: "var(--red-line)",
            }}
          >
            <AlertTriangle size={16} />
          </span>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            Something went wrong
          </div>
        </div>
        <p
          className="mono"
          style={{ fontSize: 12, color: "var(--tx-dim)", lineHeight: 1.6 }}
        >
          This view hit an unexpected error and couldn&apos;t render. Your
          session is unaffected — you can retry or navigate elsewhere.
        </p>
        {error.message ? (
          <div
            className="term"
            style={{ marginTop: 14 }}
            role="alert"
          >
            <div className="term-body" style={{ maxHeight: 120 }}>
              <div className="term-line">
                <span className="t-red">{error.message}</span>
              </div>
              {error.digest ? (
                <div className="term-line">
                  <span className="t-dim">digest: {error.digest}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={reset}>
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
