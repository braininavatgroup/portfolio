// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    expect(container.querySelectorAll(".portfolio-node-mark")).toHaveLength(17);
    expect(container.textContent).not.toContain("→");
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
    const title = screen.getByRole("heading", { name: node.label });
    const kind = screen.getByText(node.kind);
    const summary = screen.getByText(node.summary);
    expect(
      title.compareDocumentPosition(kind) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      kind.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
      screen.getByRole("button", {
        name: /Open gallery visual in map: Show how the service offering developed/,
      }),
    ).toBeTruthy();
    const summary = screen.getByText("[Summary in progress]");
    expect(summary.classList.contains("reader-text-placeholder")).toBe(true);

    for (const label of screen.getAllByText("Copy in progress")) {
      const placeholder = label.closest("aside")!;
      expect(placeholder.classList.contains("reader-text-placeholder")).toBe(true);
      expect(placeholder.classList.contains("reader-draft-placeholder")).toBe(false);
    }

    const visual = screen.getByRole("button", {
      name: /Open gallery visual in map: Show how the service offering developed/,
    });
    expect(visual.classList.contains("reader-visual-draft")).toBe(true);
    expect(visual.classList.contains("reader-text-placeholder")).toBe(false);
    expect(visual.querySelector(".reader-visual-placeholder")).toBeTruthy();
  });

  it("opens image, video, and gallery blocks through the same map control", () => {
    const onOpenVisual = vi.fn();

    const cases = [
      {
        id: "bradley",
        format: "image",
        purpose: /Find the right documentary image or artifact/,
      },
      {
        id: "dubs",
        format: "video",
        purpose: /Demonstrate the listen, inline voice or text capture/,
      },
      {
        id: "music-practice",
        format: "gallery",
        purpose: /Show how the service offering developed/,
      },
    ] as const;

    for (const { id, format, purpose } of cases) {
      const { unmount } = render(
        <PortfolioReader
          {...baseProps}
          onOpenVisual={onOpenVisual}
          selectedId={id}
        />,
      );
      const trigger = screen.getByRole("button", {
        name: new RegExp(`Open ${format} visual in map: ${purpose.source}`, "i"),
      });
      expect(trigger.getAttribute("data-format")).toBe(format);
      fireEvent.click(trigger);
      expect(onOpenVisual).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "visual", format }),
        trigger,
      );
      unmount();
    }
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
        ".reader-text-placeholder, .reader-visual-draft",
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
    const indexButton = screen.getByRole("button", { name: "Portfolio index" });
    expect(indexButton.closest("h1")).toBeTruthy();
    expect(indexButton.querySelector("[data-index-mark]")).toBeNull();
    expect(indexButton.textContent).toBe("Index");
    reader.scrollTop = 0;
    rerender(<PortfolioReader {...baseProps} />);

    expect(reader.scrollTop).toBe(420);
  });
});
