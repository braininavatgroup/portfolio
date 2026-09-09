// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  portfolioThreads,
  portfolioWorldIndexSections,
  portfolioWorldNodeById,
} from "../lib/portfolio-world";
import { PortfolioContents } from "./PortfolioContents";

afterEach(cleanup);

const baseProps = {
  activeThreadId: null,
  onHome: () => {},
  onSelect: () => {},
  onSelectThread: () => {},
  selectedId: null,
};

describe("PortfolioContents", () => {
  it("renders Home as the mast above the shared editorial groups", () => {
    const { container } = render(<PortfolioContents {...baseProps} />);

    const home = screen.getByRole("button", { name: "Portfolio home" });
    const mast = home.closest(".portfolio-contents-mast")!;
    expect(home.textContent).toContain("Bradley Berkman");
    expect(mast.querySelector('[data-control="sidebarLeft"]')).toBeTruthy();
    expect(home.querySelector(".portfolio-node-mark")).toBeNull();
    expect(mast.querySelectorAll("button")).toHaveLength(2);
    expect(
      [...container.querySelectorAll(".portfolio-contents-group > h2")].map(
        (heading) => heading.textContent,
      ),
    ).toEqual(portfolioWorldIndexSections.map(({ title }) => title));
  });

  it("uses one responsive Contents row contract with trailing 18px marks", async () => {
    const { container } = render(<PortfolioContents {...baseProps} />);

    const rows = [...container.querySelectorAll(".portfolio-contents-row")];
    expect(rows).toHaveLength(13);
    for (const row of rows) {
      expect(row.tagName).toBe("BUTTON");
      expect(row.parentElement?.tagName).toBe("LI");
      expect(row.querySelectorAll(".portfolio-node-mark")).toHaveLength(1);
      expect(row.lastElementChild?.classList.contains("portfolio-node-mark")).toBe(true);
    }

    const stylesheet = await readFile(resolve(process.cwd(), "app/globals.css"), "utf8");
    const desktopRule = stylesheet.match(/\.portfolio-contents-row,\s*\.reader-index-row\s*\{([^}]*)\}/)?.[1];
    const mobileRule = stylesheet.match(
      /@media \(max-width: 1019px\)\s*\{\s*\.portfolio-contents-row,\s*\.reader-index-row\s*\{([^}]*)\}/,
    )?.[1];

    expect(desktopRule?.match(/\bheight:\s*([^;]+);/)?.[1]).toBe("28px");
    expect(mobileRule?.match(/\bheight:\s*([^;]+);/)?.[1]).toBe("36px");
  });

  it("uses the Reader paper token for the embedded Reader surface", async () => {
    const stylesheet = await readFile(resolve(process.cwd(), "app/globals.css"), "utf8");
    const readerRule = stylesheet.match(/^\.portfolio-reader\s*\{([^}]*)\}/m)?.[1];

    expect(readerRule?.match(/\bbackground:\s*([^;]+);/)?.[1]).toBe(
      "var(--reader-paper)",
    );
  });

  it("uses the handoff's compact intent without replacing authoritative labels", () => {
    render(<PortfolioContents {...baseProps} />);

    expect(screen.getByRole("button", { name: "Brain in a Vat Music Promotions Agency" }).textContent).toContain(
      "Music Promotions Agency",
    );
    expect(screen.getByRole("button", { name: "Brain in a Vat Systems & AI Consulting" }).textContent).toContain(
      "Systems & AI Consulting",
    );
    expect(screen.getByRole("button", { name: "Music Promo Campaign Kickoff" }).textContent).toContain(
      "Music Promo Campaign Kickoff",
    );
  });

  it("marks the selected record with its native register", () => {
    const selected = portfolioWorldNodeById.get("kickoff")!;
    render(<PortfolioContents {...baseProps} selectedId={selected.id} />);

    const row = screen.getByRole("button", { name: selected.label });
    expect(row.getAttribute("data-selected")).toBe("true");
    expect(row.getAttribute("data-register")).toBe(selected.register);
    expect(row.querySelector(".portfolio-node-mark")?.getAttribute("data-register")).toBe(
      selected.register,
    );
  });

  it("routes record and thread rows through their distinct selection callbacks", () => {
    const onSelect = vi.fn();
    const onSelectThread = vi.fn();
    const record = portfolioWorldNodeById.get("dubs")!;
    const thread = portfolioThreads[0];
    render(
      <PortfolioContents
        {...baseProps}
        activeThreadId={thread.id}
        onSelect={onSelect}
        onSelectThread={onSelectThread}
      />,
    );

    const threadGroup = screen.getByRole("heading", { name: "Themes" }).closest("section")!;
    const threadRow = within(threadGroup).getByRole("button", { name: thread.title });
    expect(threadRow.getAttribute("data-selected")).toBe("true");
    fireEvent.click(threadRow);
    expect(onSelectThread).toHaveBeenCalledWith(thread.id);

    fireEvent.click(screen.getByRole("button", { name: record.label }));
    expect(onSelect).toHaveBeenCalledWith(record);
  });

  it("hands Home and row selections to the mobile Reader when requested", () => {
    const onHome = vi.fn();
    const onNavigate = vi.fn();
    const record = portfolioWorldNodeById.get("writ")!;
    render(
      <PortfolioContents
        {...baseProps}
        onHome={onHome}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: record.label }));
    expect(onNavigate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Portfolio home" }));
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledTimes(2);
  });

  it("lets its Reading Room owner collapse Contents without resetting selection", () => {
    const onClose = vi.fn();
    const onHome = vi.fn();
    render(
      <PortfolioContents
        {...baseProps}
        onClose={onClose}
        onHome={onHome}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide Contents" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onHome).not.toHaveBeenCalled();
  });
});
