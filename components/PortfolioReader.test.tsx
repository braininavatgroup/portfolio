// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  portfolioContact,
  portfolioThreads,
  portfolioWorldNodeById,
} from "../lib/portfolio-world";
import { PortfolioReader } from "./PortfolioReader";

afterEach(cleanup);

const baseProps = {
  activeThreadId: null,
  onReset: () => {},
  onSelect: () => {},
  onSelectThread: () => {},
  selectedId: null,
};

describe("PortfolioReader", () => {
  it("presents the portfolio sections in the shared editorial order", () => {
    const { container } = render(<PortfolioReader {...baseProps} />);

    expect(
      [...container.querySelectorAll(".reader-index-group h2")].map(
        (heading) => heading.textContent,
      ),
    ).toEqual([
      "About",
      "Threads",
      "Operations",
      "Music promotions systems",
      "Client systems",
      "Personal systems",
      "In Production",
    ]);
    expect(
      screen.queryByText("Operations, systems, and work in production"),
    ).toBeNull();
  });

  it("uses the same compact row contract for Threads as the rest of the Index", () => {
    const { container } = render(<PortfolioReader {...baseProps} />);

    for (const thread of portfolioThreads) {
      const row = screen.getByRole("button", { name: thread.title });
      expect(row.classList.contains("reader-index-row")).toBe(true);
      expect(screen.queryByText(thread.lede)).toBeNull();
    }
    expect(container.querySelector(".reader-thread-row")).toBeNull();
  });

  it("does not add a redundant alternate-index link inside the reader", () => {
    render(<PortfolioReader {...baseProps} />);

    expect(screen.queryByRole("link", { name: "View as list" })).toBeNull();
  });

  it("keeps the editorial copy on the Thread page", () => {
    const thread = portfolioThreads[0];
    render(
      <PortfolioReader
        {...baseProps}
        activeThreadId={thread.id}
        selectedId={thread.nodeId}
      />,
    );

    expect(screen.getByText(thread.lede)).toBeTruthy();
    for (const paragraph of thread.body) {
      expect(screen.getByText(paragraph)).toBeTruthy();
    }
  });

  it("renders the complete record", () => {
    render(<PortfolioReader {...baseProps} selectedId="pitching" />);

    const node = portfolioWorldNodeById.get("pitching")!;
    expect(screen.getByText(node.principle!)).toBeTruthy();
    for (const paragraph of node.body) {
      expect(screen.getByText(paragraph)).toBeTruthy();
    }
    expect(screen.queryByText("Read the current case study")).toBeNull();
  });

  it("shows contact details only on the Bradley record", () => {
    render(<PortfolioReader {...baseProps} selectedId="bradley" />);
    expect(
      screen.getByRole("link", { name: portfolioContact.email }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: portfolioContact.cv.label }),
    ).toBeTruthy();

    cleanup();
    render(<PortfolioReader {...baseProps} selectedId="dubs" />);
    expect(screen.queryByText(portfolioContact.email)).toBeNull();
  });

  it("restores the visitor's Index scroll position after inspecting a record", () => {
    const { rerender } = render(<PortfolioReader {...baseProps} />);
    const reader = screen.getByRole("complementary", { name: "Portfolio index" });
    reader.scrollTop = 420;
    fireEvent.scroll(reader);

    rerender(<PortfolioReader {...baseProps} selectedId="dubs" />);
    reader.scrollTop = 0;
    rerender(<PortfolioReader {...baseProps} />);

    expect(reader.scrollTop).toBe(420);
  });
});
