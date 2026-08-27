// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { portfolioStories } from "../lib/portfolio-world";
import { PortfolioReader } from "./PortfolioReader";

afterEach(cleanup);

describe("PortfolioReader", () => {
  it("uses the same compact row contract for Stories as the rest of the Index", () => {
    const { container } = render(
      <PortfolioReader
        activeStoryId={null}
        onReset={() => {}}
        onSelect={() => {}}
        onSelectStory={() => {}}
        selectedId={null}
      />,
    );

    for (const story of portfolioStories) {
      const row = screen.getByRole("button", { name: story.title });
      expect(row.classList.contains("reader-index-row")).toBe(true);
      expect(screen.queryByText(story.lede)).toBeNull();
    }
    expect(container.querySelector(".reader-story-row")).toBeNull();
  });

  it("keeps the editorial copy on the Story page", () => {
    const story = portfolioStories[0];
    render(
      <PortfolioReader
        activeStoryId={story.id}
        onReset={() => {}}
        onSelect={() => {}}
        onSelectStory={() => {}}
        selectedId={story.nodeId}
      />,
    );

    expect(screen.getByText(story.lede)).toBeTruthy();
    expect(screen.getByText(story.body)).toBeTruthy();
  });

  it("restores the visitor's Index scroll position after inspecting a record", () => {
    const props = {
      activeStoryId: null,
      onReset: () => {},
      onSelect: () => {},
      onSelectStory: () => {},
      selectedId: null,
    };
    const { rerender } = render(<PortfolioReader {...props} />);
    const reader = screen.getByRole("complementary", { name: "Portfolio index" });
    reader.scrollTop = 420;
    fireEvent.scroll(reader);

    rerender(<PortfolioReader {...props} selectedId="dubs" />);
    reader.scrollTop = 0;
    rerender(<PortfolioReader {...props} />);

    expect(reader.scrollTop).toBe(420);
  });
});
