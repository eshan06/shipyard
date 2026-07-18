"use client";

import * as React from "react";

/**
 * Global error boundary. This replaces the **root layout** when an error is
 * thrown above the segment boundaries (e.g. in the root layout/providers), so
 * it must render its own `<html>`/`<body>` and cannot depend on the app's
 * stylesheets being loaded — hence the inlined terminal-dark styling.
 *
 * @param props.error - The thrown error (with an optional `digest`).
 * @param props.reset - Attempts to re-render the app.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    console.error("[global] fatal error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0b0f",
          color: "#e8eaf0",
          fontFamily:
            '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 460,
            width: "100%",
            background: "#101218",
            border: "1px solid rgba(255,255,255,0.075)",
            borderRadius: 14,
            padding: "28px 26px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                display: "grid",
                placeItems: "center",
                background: "linear-gradient(160deg,#ff5c8a,#e6396f)",
                color: "#fff",
                fontSize: 18,
              }}
            >
              ⚓
            </span>
            <div style={{ fontSize: 17, fontWeight: 600 }}>
              Shipyard hit a fatal error
            </div>
          </div>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "#9aa1ad",
              margin: "0 0 18px",
            }}
          >
            The application failed to render. Reloading usually resolves it.
            {error.digest ? (
              <>
                <br />
                <span
                  style={{
                    fontFamily:
                      '"JetBrains Mono", ui-monospace, Menlo, monospace',
                    fontSize: 11,
                    color: "#6a7280",
                  }}
                >
                  digest: {error.digest}
                </span>
              </>
            ) : null}
          </p>
          <button
            onClick={reset}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "1px solid #ff7aa3",
              background: "#ff5c8a",
              color: "#14060c",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
