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
  it("uses the same compact row contract for Threads as the rest of the Index", () => {
    const { container } = render(<PortfolioReader {...baseProps} />);

    for (const thread of portfolioThreads) {
      const row = screen.getByRole("button", { name: thread.title });
      expect(row.classList.contains("reader-index-row")).toBe(true);
      expect(screen.queryByText(thread.lede)).toBeNull();
    }
    expect(container.querySelector(".reader-thread-row")).toBeNull();
    expect(
      screen.getByRole("link", { name: "View as list" }).getAttribute("href"),
    ).toBe("/index");
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
    expect(screen.getByText(thread.body)).toBeTruthy();
  });

  it("renders the complete mini-study for a record", () => {
    render(<PortfolioReader {...baseProps} selectedId="pitching" />);

    const node = portfolioWorldNodeById.get("pitching")!;
    expect(screen.getByText(node.principle!)).toBeTruthy();
    for (const paragraph of node.body) {
      expect(screen.getByText(paragraph)).toBeTruthy();
    }
    expect(screen.getAllByText("Evidence needed").length).toBeGreaterThan(0);
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
