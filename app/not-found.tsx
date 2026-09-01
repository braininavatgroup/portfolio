import Link from "next/link";

export default function NotFound() {
  return (
    <main className="portfolio-composition recovery-page" id="main-content" tabIndex={-1}>
      <h1>No page here.</h1>
      <p>The portfolio is one map with a dossier beside it — start there.</p>
      <div className="recovery-actions">
        <Link href="/">Back to the portfolio</Link>
      </div>
    </main>
  );
}
