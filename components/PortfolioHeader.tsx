import Link from "next/link";

type PortfolioHeaderProps = {
  activeView?: "map" | "work";
  overlay?: boolean;
  onHome?: () => void;
  onReplay?: () => void;
};

export function PortfolioHeader({
  activeView,
  overlay = false,
  onHome,
  onReplay,
}: PortfolioHeaderProps) {
  return (
    <header
      className={`portfolio-header${overlay ? " portfolio-header-overlay" : ""}`}
    >
      <Link className="wordmark" href="/" onClick={onHome}>
        Bradley Berkman
      </Link>
      <nav aria-label="Portfolio views">
        {activeView === "map" ? (
          <span aria-current="page">Map</span>
        ) : (
          <Link href="/?view=graph">Map</Link>
        )}
        {activeView === "work" ? (
          <span aria-current="page">Work</span>
        ) : (
          <Link href="/work">Work</Link>
        )}
        {onReplay ? (
          <button type="button" onClick={onReplay}>
            Replay intro
          </button>
        ) : null}
      </nav>
    </header>
  );
}
