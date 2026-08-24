"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

type PortfolioHeaderProps = {
  activeView?: "bradley" | "map" | "index";
  overlay?: boolean;
  onBradleySelect?: () => void;
  onMapSelect?: () => void;
};

function handleLocalNavigation(
  event: MouseEvent<HTMLAnchorElement>,
  onSelect: (() => void) | undefined,
) {
  if (
    !onSelect ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  event.preventDefault();
  onSelect();
}

export function PortfolioHeader({
  activeView,
  overlay = false,
  onBradleySelect,
  onMapSelect,
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
        <Link
          className="wordmark"
          href="/"
          onClick={(event) => handleLocalNavigation(event, onBradleySelect)}
        >
          Bradley Berkman
        </Link>
      )}
      <nav aria-label="Portfolio views">
        {activeView === "map" ? (
          <span aria-current="page">Map</span>
        ) : (
          <Link
            href="/?view=graph"
            onClick={(event) => handleLocalNavigation(event, onMapSelect)}
          >
            Map
          </Link>
        )}
      </nav>
    </header>
  );
}
