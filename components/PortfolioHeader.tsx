"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { portfolioInterfaceText } from "../lib/portfolio-world";
import { EditableText } from "./editor/EditableText";

type PortfolioHeaderProps = {
  activeView?: "bradley" | "map" | "index";
  obstacleRef?: (element: HTMLElement | null) => void;
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
  obstacleRef,
  overlay = false,
  onBradleySelect,
  onMapSelect,
}: PortfolioHeaderProps) {
  return (
    <header
      className={`portfolio-header${overlay ? " portfolio-header-overlay" : ""}`}
      ref={obstacleRef}
    >
      {activeView === "bradley" ? (
        <EditableText
          aria-current="page"
          as="span"
          className="wordmark"
          path="interface.header.wordmark"
          value={portfolioInterfaceText["header.wordmark"]}
        />
      ) : (
        <Link
          className="wordmark"
          href="/"
          onClick={(event) => handleLocalNavigation(event, onBradleySelect)}
        >
          <EditableText
            path="interface.header.wordmark"
            value={portfolioInterfaceText["header.wordmark"]}
          />
        </Link>
      )}
      <nav aria-label="Portfolio views">
        {activeView === "map" ? (
          <EditableText
            aria-current="page"
            as="span"
            path="interface.header.mapLink"
            value={portfolioInterfaceText["header.mapLink"]}
          />
        ) : (
          <Link
            href="/?view=graph"
            onClick={(event) => handleLocalNavigation(event, onMapSelect)}
          >
            <EditableText
              path="interface.header.mapLink"
              value={portfolioInterfaceText["header.mapLink"]}
            />
          </Link>
        )}
      </nav>
    </header>
  );
}
