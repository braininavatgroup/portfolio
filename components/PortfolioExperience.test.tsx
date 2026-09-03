// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { AvatarRuntime } from "../lib/avatar/runtime";
import { PortfolioExperience } from "./PortfolioExperience";

vi.mock("./avatar/AvatarOverlay", async () => {
  const React = await import("react");
  return {
    AvatarOverlay: ({ runtime }: { runtime: AvatarRuntime }) => {
      const snapshot = React.useSyncExternalStore(
        runtime.subscribe,
        runtime.getSnapshot,
        runtime.getSnapshot,
      );
      return (
        <section
          aria-label="Test avatar overlay"
          data-animation={snapshot.animation}
          data-phase={snapshot.phase}
          data-visible={snapshot.visible ? "true" : "false"}
        />
      );
    },
  };
});

let reducedMotionPreference = false;
function mockMatchMedia(reducedMotion = false) {
  reducedMotionPreference = reducedMotion;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return reducedMotionPreference && query.includes("prefers-reduced-motion");
    },
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function effectsResponse(avatarAction: "swim_lap" | null) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({ type: "effects", effects: { avatarAction, issues: [] } })}\n${JSON.stringify({ type: "turn_mode", mode: "portfolio" })}\n${JSON.stringify({ type: "answer_delta", delta: "Effect ready." })}\n${JSON.stringify({ type: "done" })}\n`,
          ),
        );
        controller.close();
      },
    }),
  );
}

async function renderExperience() {
  mockMatchMedia();
  window.history.replaceState({}, "", "/?view=graph");
  render(<PortfolioExperience />);
  await act(async () => {});
}

beforeAll(async () => {
  await import("./avatar/AvatarOverlay");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("PortfolioExperience", () => {
  it("shows an idle avatar with chat and hides it when chat closes", async () => {
    await renderExperience();
    const avatar = await screen.findByLabelText("Test avatar overlay");

    expect(avatar.dataset.visible).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Open portfolio assistant" }));
    expect(avatar.dataset.visible).toBe("true");
    expect(avatar.dataset.phase).toBe("idle");
    expect(avatar.dataset.animation).toBe("idle_3");

    fireEvent.click(screen.getByRole("button", { name: "Minimize portfolio assistant" }));
    expect(avatar.dataset.visible).toBe("false");
    expect(avatar.dataset.phase).toBe("hidden");
  });

  it("plays the fixed answer reaction before a requested swim lap", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => effectsResponse("swim_lap")));
    mockMatchMedia();
    window.history.replaceState({}, "", "/?view=graph");
    render(<PortfolioExperience />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Open portfolio assistant" }));
    const input = screen.getByLabelText("Ask a question about the portfolio");
    fireEvent.change(input, { target: { value: "Take a leisurely swim." } });
    fireEvent.submit(document.getElementById("portfolio-question-form")!);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const avatar = screen.getByLabelText("Test avatar overlay");
    expect(avatar.dataset.phase).toBe("reacting");
    expect(avatar.dataset.animation).toBe("agree_gesture");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600);
    });
    expect(avatar.dataset.phase).toBe("swimming");
    expect(avatar.dataset.animation).toBe("swim_forward");
  });

  it("runs Brain Food on the live map and restores the prior map state on Escape", async () => {
    await renderExperience();
    await screen.findByLabelText("Test avatar overlay");
    fireEvent.click(screen.getByRole("button", { name: "Portfolio index" }));
    fireEvent.click(screen.getByRole("button", { name: "Dubs" }));
    expect(screen.getByRole("complementary", { name: "Dubs record" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "G", shiftKey: true });

    expect(await screen.findByText(/Brain Food · 16 left/)).toBeTruthy();
    expect(document.querySelector(".avatar-toybox")).toBeNull();
    expect(document.querySelector('[data-world-node="bradley"]')).toBeTruthy();
    expect(
      (document.querySelector('[data-world-node="bradley"]') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((await screen.findByLabelText("Test avatar overlay")).dataset.phase).toBe("brain-food");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByText(/Brain Food ·/)).toBeNull());
    expect(screen.getByRole("complementary", { name: "Dubs record" })).toBeTruthy();
    expect(screen.getByLabelText("Test avatar overlay").dataset.visible).toBe("false");
  });

  it("keeps the existing combined mobile map and chat control", async () => {
    vi.stubGlobal("innerWidth", 390);
    await renderExperience();
    const experience = document.getElementById("main-content")!;

    const mapToggle = screen.getByRole("button", { name: "Show portfolio map" });
    fireEvent.click(mapToggle);
    expect(experience.classList).toContain("portfolio-mobile-map-open");
    expect(
      (document.querySelector(".portfolio-chat-panel") as HTMLElement).hidden,
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Back to portfolio home" }));
    expect(experience.classList).not.toContain("portfolio-mobile-map-open");
  });

  it("keeps record routing and the shared reader intact", async () => {
    await renderExperience();
    fireEvent.click(screen.getByRole("button", { name: "Portfolio index" }));
    fireEvent.click(screen.getByRole("button", { name: "Dubs" }));

    expect(window.location.hash).toBe("#dubs");
    expect(screen.getByRole("complementary", { name: "Dubs record" })).toBeTruthy();
    expect(document.querySelector(".portfolio-world")).toBeTruthy();
  });

  it("exposes neither the old toybox nor the Director shortcut", async () => {
    await renderExperience();
    fireEvent.keyDown(document, { key: "A", shiftKey: true });

    expect(screen.queryByLabelText("Avatar Director console")).toBeNull();
    expect(screen.queryByLabelText("Avatar toybox")).toBeNull();
    expect(document.querySelector(".portfolio-world")).toBeTruthy();
  });
});
