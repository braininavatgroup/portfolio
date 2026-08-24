// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortfolioExperience } from "./PortfolioExperience";

vi.mock("./scene/PortfolioCanvas", () => ({
  PortfolioCanvas: () => <div data-testid="scene-canvas" />,
}));

function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reducedMotion && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

async function renderExperience({ reducedMotion = false } = {}) {
  mockMatchMedia(reducedMotion);
  render(<PortfolioExperience />);
  await act(async () => {});
  return screen.getByTestId("scene-canvas");
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("landing entry", () => {
  it("enters from any plain click on the landing canvas", async () => {
    const canvas = await renderExperience();

    fireEvent.click(canvas);

    expect(screen.queryByText("Moving through the glass…")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show performance" })).toBeNull();
  });

  it("keeps chat clicks on the landing screen", async () => {
    await renderExperience();

    fireEvent.click(screen.getByLabelText("Ask a question about the portfolio"));
    fireEvent.click(screen.getByText("Find the work behind the question."));

    expect(screen.queryByText("Moving through the glass…")).toBeNull();
  });

  it("completes the transition into the graph after the travel duration", async () => {
    vi.useFakeTimers();
    const canvas = await renderExperience();

    fireEvent.click(canvas);
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText("Map")).toBeDefined();
    expect(
      screen.getByText(/Brain graph open/),
    ).toBeDefined();

    fireEvent.click(canvas);
    expect(screen.getByText("Map")).toBeDefined();
  });

  it("uses the short crossfade for reduced motion", async () => {
    vi.useFakeTimers();
    const canvas = await renderExperience({ reducedMotion: true });

    fireEvent.click(canvas);
    expect(screen.queryByText("Moving through the glass…")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(screen.getByText("Map")).toBeDefined();
  });
});
