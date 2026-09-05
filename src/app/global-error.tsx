"use client";

import * as React from "react";

/**
 * Last-resort boundary for errors thrown by the root layout itself, which
 * `app/error.tsx` cannot catch because it renders *inside* that layout.
 *
 * It therefore has to supply its own <html> and <body>, and it cannot rely
 * on the theme provider, the i18n provider, fonts or any app component,
 * since the failure may be the very thing that would have provided them.
 * Everything here is inline and self-contained on purpose.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Root layout error:", error);
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
          padding: "2rem",
          background: "#141419",
          color: "#f4f4f5",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", opacity: 0.7, margin: "0 0 1.25rem" }}>
            The application failed to start rendering. The error has been recorded on the server.
          </p>

          {error.digest && (
            <p
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.75rem",
                wordBreak: "break-all",
                border: "1px solid #2a2a33",
                borderRadius: "0.5rem",
                padding: "0.75rem",
                margin: "0 0 1.25rem",
              }}
            >
              {error.digest}
            </p>
          )}

          <button
            onClick={reset}
            style={{
              cursor: "pointer",
              border: "1px solid #3f3f4a",
              borderRadius: "0.375rem",
              background: "transparent",
              color: "inherit",
              font: "inherit",
              padding: "0.5rem 1rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
