"use client";

import Link from "next/link";
import { portfolioInterfaceText } from "../lib/portfolio-world";
import { EditableText } from "./editor/EditableText";

export function PortfolioHeader() {
  return (
    <header className="portfolio-header">
      <EditableText
        as={Link}
        className="wordmark"
        href="/"
        path="interface.header.wordmark"
        value={portfolioInterfaceText["header.wordmark"]}
      />
      <nav aria-label="Portfolio views">
        <EditableText
          as={Link}
          href="/?view=graph"
          path="interface.header.mapLink"
          value={portfolioInterfaceText["header.mapLink"]}
        />
      </nav>
    </header>
  );
}
