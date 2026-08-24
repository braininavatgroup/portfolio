// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

    expect(screen.getByText("Moving through the glass…")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Explore the work" })).toBeNull();
  });

  it("keeps chat clicks on the landing screen", async () => {
    await renderExperience();

    fireEvent.click(screen.getByLabelText("Ask a question about the portfolio"));
    fireEvent.click(screen.getByText("Find the work behind the question."));

    expect(screen.queryByText("Moving through the glass…")).toBeNull();
    expect(screen.getByRole("button", { name: "Explore the work" })).toBeDefined();
  });

  it("keeps starter-question pointer interactions on the landing screen", async () => {
    await renderExperience();
    const starter = screen.getByRole("button", {
      name: "How does the pitching system preserve human approval?",
    });

    fireEvent.pointerDown(starter);
    fireEvent.click(starter);

    expect(screen.queryByText("Moving through the glass…")).toBeNull();
    expect(screen.getByRole("button", { name: "Explore the work" })).toBeDefined();
  });

  it("keeps frame sampler clicks on the landing screen", async () => {
    await renderExperience();

    fireEvent.click(screen.getByRole("button", { name: "Show performance" }));

    expect(screen.queryByText("Moving through the glass…")).toBeNull();
    expect(screen.getByRole("button", { name: "Hide performance" })).toBeDefined();
  });

  it("keeps a keyboard path through the visible enter button", async () => {
    await renderExperience();
    const user = userEvent.setup();
    const enterButton = screen.getByRole("button", { name: "Explore the work" });

    act(() => enterButton.focus());
    await user.keyboard("{Enter}");

    expect(screen.getByText("Moving through the glass…")).toBeDefined();
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
    expect(screen.getByText("Moving through the glass…")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(screen.getByText("Map")).toBeDefined();
  });
});
