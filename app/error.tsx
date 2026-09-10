"use client";

// Route-level recovery. Without this, a render throw or a stale lazy chunk
// after a deploy unwound to the framework default and the portfolio was gone.

import Link from "next/link";
import { useEffect } from "react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("Route error", error);
    }
  }, [error]);

  return (
    <main className="portfolio-composition recovery-page" id="main-content" tabIndex={-1}>
      <h1>Something stopped loading.</h1>
      <p>
        This is usually a stale tab after a deploy. Reloading fixes it.
      </p>
      <div className="recovery-actions">
        <button onClick={reset} type="button">
          Try again
        </button>
        <Link href="/">Back to the portfolio</Link>
      </div>
    </main>
  );
}
