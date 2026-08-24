import Link from "next/link";

type PortfolioHeaderProps = {
  activeView?: "bradley" | "map" | "index";
  overlay?: boolean;
};

export function PortfolioHeader({
  activeView,
  overlay = false,
}: PortfolioHeaderProps) {
  return (
    <header
      className={`portfolio-header${overlay ? " portfolio-header-overlay" : ""}`}
    >
      {activeView === "bradley" ? (
        <span aria-current="page" className="wordmark">
          Bradley Berkman
        </span>
      ) : (
        <Link className="wordmark" href="/">
          Bradley Berkman
        </Link>
      )}
      <nav aria-label="Portfolio views">
        {activeView === "map" ? (
          <span aria-current="page">Map</span>
        ) : (
          <Link href="/?view=graph">Map</Link>
        )}
        {activeView === "index" ? (
          <span aria-current="page">Index</span>
        ) : (
          <Link href="/index">Index</Link>
        )}
      </nav>
    </header>
  );
}
