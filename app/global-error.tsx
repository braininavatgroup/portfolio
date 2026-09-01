"use client";

// The last resort: this replaces the root layout, so it renders its own
// <html>/<body> and cannot rely on globals.css having applied.

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          background: "#c5cbd0",
          color: "#201711",
          display: "flex",
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: "38ch" }}>
          <h1 style={{ fontSize: "20px", letterSpacing: "-0.025em", margin: "0 0 8px" }}>
            Something stopped loading.
          </h1>
          <p style={{ fontSize: "13px", lineHeight: 1.5, margin: "0 0 16px" }}>
            This is usually a stale tab after a deploy. Reloading fixes it.
          </p>
          <button
            onClick={reset}
            style={{
              background: "transparent",
              border: "1px solid #201711",
              borderRadius: "4px",
              color: "inherit",
              cursor: "pointer",
              font: "inherit",
              fontSize: "12px",
              padding: "8px 12px",
            }}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
