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
  it("opens on the About record as home, titled by its throughline", () => {
    const { container } = render(<PortfolioReader {...baseProps} />);

    const reader = screen.getByRole("complementary", { name: "Portfolio home" });
    expect(reader.getAttribute("data-reader-mode")).toBe("home");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "I make complexity legible enough to act on.",
    );
    expect(container.querySelector(".reader-summary")).toBeNull();
    expect(container.querySelector(".reader-kind")).toBeNull();
    expect(container.querySelector(".reader-topbar")).toBeNull();
    expect(
      container.querySelector(".reader-composed-body > p")?.textContent,
    ).toMatch(/^Hey, I'm Bradley\. I run Brain in a Vat Group/);
    expect(container.querySelector(".reader-index-group")).toBeNull();
    expect(screen.getByRole("link", { name: portfolioContact.email })).toBeTruthy();
    expect(reader.querySelector(".portfolio-reader-footer")).toBeTruthy();
  });

  it("treats Bradley's own node as home rather than a titled record", () => {
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId="bradley" />,
    );

    expect(screen.getByRole("complementary", { name: "Portfolio home" })).toBeTruthy();
    expect(container.querySelector(".reader-topbar")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Bradley Berkman" })).toBeNull();
  });

  it("links About's first sentence to the three practices in their register", () => {
    const onSelect = vi.fn();
    render(<PortfolioReader {...baseProps} onSelect={onSelect} />);

    const links = screen.getAllByRole("button").filter((button) =>
      button.classList.contains("reader-inline-link"),
    );
    expect(links.map((link) => link.textContent)).toEqual([
      "music promotions agency",
      "systems and AI consulting practice",
      "product studio",
    ]);
    expect(links.map((link) => link.getAttribute("data-register"))).toEqual([
      "warm",
      "warm",
      "warm",
    ]);
    expect(screen.queryByText(/\[|\]\(/)).toBeNull();

    fireEvent.click(links[0]);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "music-practice" }),
    );
  });

  it("draws every contact row as an index row with its own mark", () => {
    const { container } = render(<PortfolioReader {...baseProps} />);

    const rows = [...container.querySelectorAll(".reader-contact-row")];
    expect(rows).toHaveLength(5);
    expect(
      rows.map((row) => row.querySelector(".portfolio-node-mark")?.getAttribute("data-contact")),
    ).toEqual(["email", "cv", "linkedin", "github", "instagram"]);
    for (const row of rows) {
      expect(row.classList.contains("reader-index-row")).toBe(true);
      expect(row.querySelector("small")).toBeNull();
      expect(row.parentElement?.tagName).toBe("LI");
    }
  });

  it("lists every row as a ul > li > control with no kind text and one mark", () => {
    const { container } = render(<PortfolioReader {...baseProps} indexOpen />);

    const rows = [...container.querySelectorAll(".reader-index-row")];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.tagName).toBe("BUTTON");
      expect(row.parentElement?.tagName).toBe("LI");
      expect(row.parentElement?.parentElement?.classList.contains("reader-rows")).toBe(true);
      expect(row.querySelector("small")).toBeNull();
      expect(row.querySelectorAll(".portfolio-node-mark")).toHaveLength(1);
    }
    expect(container.querySelector(".reader-kind")).toBeNull();
  });

  it("presents the portfolio sections in the shared editorial order", () => {
    const { container } = render(<PortfolioReader {...baseProps} indexOpen />);

    expect(
      [...container.querySelectorAll(".reader-index-group h2")].map(
        (heading) => heading.textContent,
      ),
    ).toEqual([
      "Threads",
      "Operations",
      "Music promotions systems",
      "Client systems",
      "In Production",
    ]);
    expect(
      screen.queryByText("Operations, systems, and work in production"),
    ).toBeNull();
  });

  it("uses the same compact row contract for Threads as the rest of the Index", () => {
    const { container } = render(<PortfolioReader {...baseProps} indexOpen />);

    for (const thread of portfolioThreads) {
      const row = screen.getByRole("button", { name: thread.title });
      expect(row.classList.contains("reader-index-row")).toBe(true);
      expect(screen.queryByText(thread.lede)).toBeNull();
    }
    expect(container.querySelector(".reader-thread-row")).toBeNull();
    expect(container.querySelectorAll(".portfolio-node-mark")).toHaveLength(16);
    expect(container.textContent).not.toContain("→");
  });

  it("does not add a redundant alternate-index link inside the reader", () => {
    render(<PortfolioReader {...baseProps} />);

    expect(screen.queryByRole("link", { name: "View as list" })).toBeNull();
  });

  it("puts the Index control and the privacy link on one footer row after the content", () => {
    const onOpenIndex = vi.fn();
    render(<PortfolioReader {...baseProps} onOpenIndex={onOpenIndex} />);

    const reader = screen.getByRole("complementary", {
      name: "Portfolio home",
    });
    const footer = reader.querySelector(".portfolio-reader-footer");
    const index = screen.getByRole("button", { name: "Portfolio index" });
    const privacy = screen.getByRole("link", { name: "Privacy" });

    expect(footer).toBeTruthy();
    expect(footer?.contains(index)).toBe(true);
    expect(footer?.contains(privacy)).toBe(true);
    expect(index.textContent).toBe("Index");
    expect(
      index.compareDocumentPosition(privacy) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(reader.lastElementChild).toBe(footer);

    fireEvent.click(index);
    expect(onOpenIndex).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: "Opt out of analytics" }),
    ).toBeNull();
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

  it.each([
    ["authorship", "thread-authorship"],
    ["philosophy", "thread-philosophy"],
  ])("renders the %s Why as copy in progress", (activeThreadId, selectedId) => {
    render(
      <PortfolioReader
        {...baseProps}
        activeThreadId={activeThreadId}
        selectedId={selectedId}
      />,
    );

    expect(screen.getByText("Copy in progress")).toBeTruthy();
  });

  it("uses one summary treatment at the start of every record", () => {
    const { container } = render(
      <PortfolioReader {...baseProps} selectedId="systems-consulting" />,
    );

    const node = portfolioWorldNodeById.get("systems-consulting")!;
    const title = screen.getByRole("heading", { level: 1, name: node.label });
    const summary = screen.getByText(node.summary);
    expect(screen.queryByText(node.kind)).toBeNull();
    expect(container.querySelector(".reader-kind")).toBeNull();
    expect(container.querySelector(".reader-path")).toBeNull();
    expect(
      title.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(summary.classList.contains("reader-summary")).toBe(true);
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

  it("hides the footer's Index control while the index is open", () => {
    render(<PortfolioReader {...baseProps} indexOpen onOpenIndex={() => {}} />);

    expect(screen.getByRole("complementary", { name: "Portfolio index" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Index" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Portfolio index" })).toBeNull();
    expect(screen.getByRole("button", { name: "Portfolio home" }).textContent).toBe("Home");
  });

  it("restores the visitor's Index scroll position after inspecting a record", () => {
    const { rerender } = render(
      <PortfolioReader {...baseProps} indexOpen onOpenIndex={() => {}} />,
    );
    const reader = screen.getByRole("complementary", { name: "Portfolio index" });
    // The content area scrolls, not the aside: the footer band stays put.
    const scroll = reader.querySelector<HTMLElement>(".reader-scroll")!;
    expect(scroll.contains(reader.querySelector(".portfolio-reader-footer"))).toBe(false);
    scroll.scrollTop = 420;
    fireEvent.scroll(scroll);

    rerender(<PortfolioReader {...baseProps} onOpenIndex={() => {}} selectedId="dubs" />);
    expect(screen.queryByRole("button", { name: "Portfolio home" })).toBeNull();
    const indexButton = screen.getByRole("button", { name: "Portfolio index" });
    expect(indexButton.closest("footer")).toBeTruthy();
    expect(indexButton.textContent).toBe("Index");
    expect(scroll.scrollTop).toBe(0);
    scroll.scrollTop = 300;
    rerender(<PortfolioReader {...baseProps} indexOpen onOpenIndex={() => {}} />);

    expect(scroll.scrollTop).toBe(420);
  });

  it("bundles a record's threads and linked records under one Related label", () => {
    const { container } = render(
      <PortfolioReader {...baseProps} activeThreadId="philosophy" selectedId="pitching" />,
    );

    expect(screen.queryByRole("heading", { name: "Threads" })).toBeNull();
    expect(container.querySelector(".reader-path")).toBeNull();
    const sections = [...container.querySelectorAll(".reader-record-section")];
    const related = sections.find((section) => section.querySelector("h2")?.textContent === "Related")!;
    const rows = [...related.querySelectorAll(".reader-index-row")].map((row) => row.textContent);
    const containing = portfolioThreads
      .filter(({ members }) => members.includes("pitching"))
      .map(({ title }) => title);
    expect(containing.length).toBeGreaterThan(0);
    expect(rows.slice(0, containing.length)).toEqual(containing);
    expect(rows.length).toBeGreaterThan(containing.length);
  });

  it("draws a planned visual as a bare frame with its kind, source, and caption", () => {
    render(<PortfolioReader {...baseProps} selectedId="music-practice" />);

    const trigger = screen.getByRole("button", {
      name: /Open gallery visual in map: Show how the service offering developed/,
    });
    const frame = trigger.querySelector(".reader-placeholder-frame")!;
    expect(frame.getAttribute("data-format")).toBe("gallery");
    expect(frame.querySelector(".reader-placeholder-label")?.textContent).toBe("Planned gallery");
    expect(frame.querySelector(".reader-placeholder-count")?.textContent).toBe("1 / 3");
    expect(frame.querySelector(".reader-placeholder-source")?.textContent).toMatch(/·/);
    expect(trigger.querySelector("figcaption strong")).toBeNull();
    expect(trigger.querySelector(".reader-placeholder-meta")).toBeNull();
    expect(trigger.querySelector("figcaption")?.textContent).toMatch(/Show how the service offering developed/);
  });
});
