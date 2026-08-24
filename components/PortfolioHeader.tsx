import Link from "next/link";

export type PortfolioView = "map" | "index" | "case-study" | null;

export function PortfolioHeader({
  currentView,
  onWordmarkClick,
}: {
  currentView: PortfolioView;
  onWordmarkClick?: () => void;
}) {
  return (
    <header className="portfolio-header">
      <Link className="wordmark" href="/" onClick={onWordmarkClick}>
        Bradley Berkman
      </Link>
      <nav aria-label="Portfolio views">
        <Link
          aria-current={currentView === "map" ? "page" : undefined}
          href="/?view=graph"
        >
          Map
        </Link>
        <Link
          aria-current={currentView === "index" ? "page" : undefined}
          href="/work"
        >
          Project index
        </Link>
      </nav>
    </header>
  );
}
