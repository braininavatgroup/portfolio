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
    for (const block of thread.body) {
      if (typeof block === "string") {
        expect(screen.getByText(block)).toBeTruthy();
      }
    }
  });

  it("uses one summary treatment at the start of every record", () => {
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId="systems-consulting" />,
    );

    const node = portfolioWorldNodeById.get("systems-consulting")!;
    expect(screen.getByText(node.summary)).toBeTruthy();
    expect(container.querySelectorAll(".reader-summary")).toHaveLength(1);
    expect(container.querySelector(".reader-principle")).toBeNull();
    expect(screen.queryByText(node.principle!)).toBeNull();
    for (const block of node.body) {
      if (typeof block === "string") {
        expect(screen.getByText(block)).toBeTruthy();
      }
    }
    expect(screen.queryByText("Read the current case study")).toBeNull();
  });

  it("renders unfinished copy and planned visuals as part of the working composition", () => {
    render(
      <PortfolioReader {...baseProps} selectedId="music-practice" />,
    );

    expect(screen.getAllByText("Copy in progress")).toHaveLength(2);
    expect(
      screen.getByLabelText(
        /Planned visual: Show how the service offering developed/,
      ),
    ).toBeTruthy();
    const summary = screen.getByText("[Summary in progress]");
    expect(summary.classList.contains("reader-text-placeholder")).toBe(true);

    for (const label of screen.getAllByText("Copy in progress")) {
      const placeholder = label.closest("aside")!;
      expect(placeholder.classList.contains("reader-text-placeholder")).toBe(true);
      expect(placeholder.classList.contains("reader-draft-placeholder")).toBe(false);
    }

    const visual = screen.getByLabelText(
      /Planned visual: Show how the service offering developed/,
    );
    expect(visual.classList.contains("reader-visual-placeholder")).toBe(true);
    expect(visual.classList.contains("reader-text-placeholder")).toBe(false);
  });

  it("supports a clean review mode without maintaining separate content", () => {
    window.history.replaceState({}, "", "/?view=graph&review=clean#music-practice");
    render(
      <PortfolioReader {...baseProps} selectedId="music-practice" />,
    );

    const reader = screen.getByRole("complementary", {
      name: "Brain in a Vat Music Promotions Agency record",
    });
    expect(reader.classList.contains("portfolio-reader-clean-review")).toBe(true);
    expect(
      reader.querySelectorAll(
        ".reader-text-placeholder, .reader-visual-placeholder",
      ),
    ).toHaveLength(4);
    window.history.replaceState({}, "", "/");
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
