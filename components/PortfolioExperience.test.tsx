// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

let desktopViewport = true;
let reducedMotionPreference = false;
const mediaListeners = new Set<() => void>();

function mockMatchMedia({ desktop = true, reducedMotion = false } = {}) {
  desktopViewport = desktop;
  reducedMotionPreference = reducedMotion;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      if (query === "(min-width: 1020px)") return desktopViewport;
      return reducedMotionPreference && query.includes("prefers-reduced-motion");
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => mediaListeners.delete(listener),
    dispatchEvent: vi.fn(),
  }));
}

function guideResponse({
  avatarAction = null,
  citation = false,
}: {
  avatarAction?: "swim_lap" | null;
  citation?: boolean;
} = {}) {
  const encoder = new TextEncoder();
  const lines = [
    { type: "effects", effects: { avatarAction, issues: [] } },
    { type: "turn_mode", mode: "portfolio" },
    ...(citation ? [{
      type: "evidence",
      evidence: [{
        excerpt: "A weekly curator workflow.",
        href: "/?view=graph#pitching",
        id: "node:pitching",
        title: "Music promo campaign pitching",
      }],
    }] : []),
    { type: "answer_delta", delta: citation ? "The weekly workflow [E1]." : "Effect ready." },
    { type: "done" },
  ];
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`${lines.map((line) => JSON.stringify(line)).join("\n")}\n`));
        controller.close();
      },
    }),
  );
}

async function renderExperience({ desktop = true } = {}) {
  mockMatchMedia({ desktop });
  window.history.replaceState({}, "", "/?view=graph");
  render(<PortfolioExperience />);
  await act(async () => {});
}

function selectContentsRecord(name: string) {
  const contents = screen.getByRole("navigation", { name: "Portfolio contents" });
  fireEvent.click(within(contents).getByRole("button", { name }));
}

function submitGuide(question: string) {
  const input = screen.getByLabelText("Ask a question about the portfolio");
  fireEvent.change(input, { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}

beforeAll(async () => {
  await import("./avatar/AvatarOverlay");
});

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  mediaListeners.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("PortfolioExperience Reading Room integration", () => {
  it("renders one controlled Contents, Reader, Map, and docked Guide with the default Guide avatar visible", async () => {
    await renderExperience();

    expect(screen.getAllByRole("navigation", { name: "Portfolio contents" })).toHaveLength(1);
    expect(screen.getAllByRole("complementary", { name: "Portfolio home" })).toHaveLength(1);
    expect(document.querySelectorAll(".portfolio-world")).toHaveLength(1);
    expect(screen.getAllByRole("region", { name: "Portfolio Guide" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /open portfolio assistant/i })).toBeNull();
    expect((await screen.findByLabelText("Test avatar overlay")).dataset.visible).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Hide lower view" }));
    expect(screen.queryByLabelText("Test avatar overlay")?.dataset.visible ?? "false").toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Show lower view" }));
    expect((await screen.findByLabelText("Test avatar overlay")).dataset.visible).toBe("true");
  });

  it("plays the fixed answer reaction before a requested swim lap", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => guideResponse({ avatarAction: "swim_lap" })));
    mockMatchMedia();
    window.history.replaceState({}, "", "/?view=graph");
    render(<PortfolioExperience />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    submitGuide("Take a leisurely swim.");
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

  it("runs Brain Food on the live Map and restores the selected Reader record on Escape", async () => {
    await renderExperience();
    selectContentsRecord("Dubs");
    expect(screen.getByRole("complementary", { name: "Dubs record" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "G", shiftKey: true });

    expect(await screen.findByText(/Brain Food · 16 left/)).toBeTruthy();
    expect(document.querySelector(".avatar-toybox")).toBeNull();
    expect(document.querySelector('[data-world-node="bradley"]')).toBeTruthy();
    expect((document.querySelector('[data-world-node="bradley"]') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText("Test avatar overlay").dataset.phase).toBe("brain-food");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByText(/Brain Food ·/)).toBeNull());
    expect(screen.getByRole("complementary", { name: "Dubs record" })).toBeTruthy();
    expect(screen.getByLabelText("Test avatar overlay").dataset.visible).toBe("true");
  });

  it("uses the mobile Reader default and fixed Map/Guide tab instead of the obsolete combined toggle", async () => {
    await renderExperience({ desktop: false });
    const experience = document.getElementById("main-content")!;

    expect(screen.getByRole("button", { name: "Reader tab" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByLabelText("Test avatar overlay")?.dataset.visible ?? "false").toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Map tab" }));
    expect(screen.getByRole("button", { name: "Map tab" }).getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector(".portfolio-reading-room-mobile-map")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Portfolio Guide" })).toBeTruthy();
    expect((await screen.findByLabelText("Test avatar overlay")).dataset.visible).toBe("true");
    expect(experience.classList).not.toContain("portfolio-mobile-map-open");
    expect(screen.queryByRole("button", { name: "Show portfolio map" })).toBeNull();
  });

  it("keeps record selection, URL history, and popstate in the Experience owner", async () => {
    await renderExperience();
    selectContentsRecord("Dubs");

    expect(window.location.hash).toBe("#dubs");
    expect(screen.getByRole("complementary", { name: "Dubs record" })).toBeTruthy();
    expect(document.querySelector(".portfolio-world")).toBeTruthy();

    window.history.pushState({}, "", "/?view=graph#yoohoo");
    fireEvent.popState(window);
    await waitFor(() => expect(screen.getByRole("complementary", { name: "Yoohoo record" })).toBeTruthy());
  });

  it("routes a Guide citation into owner selection while mobile remains on Map", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => guideResponse({ citation: true })));
    await renderExperience({ desktop: false });
    fireEvent.click(screen.getByRole("button", { name: "Map tab" }));
    submitGuide("Tell me about pitching.");
    const citation = await screen.findByRole("button", {
      name: "[E1] Music promo campaign pitching",
    });

    fireEvent.click(citation);

    expect(window.location.hash).toBe("#pitching");
    expect(screen.getByRole("button", { name: "Map tab" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Read Music promo campaign pitching" })).toBeTruthy();
  });

  it("gives visual and Guide-thread Escape priority before returning the Reader to About", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => guideResponse()));
    await renderExperience({ desktop: false });
    fireEvent.click(screen.getByRole("button", { name: "Contents tab" }));
    selectContentsRecord("Dubs");
    const visual = screen.getAllByRole("button", { name: /Open .* visual in map:/ })[0]!;
    fireEvent.click(visual);
    expect(screen.getByRole("button", { name: "Map tab" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Reader tab" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("complementary", { name: "Dubs record" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Map tab" }));
    submitGuide("Keep this thread.");
    await screen.findByText("Effect ready.");
    await waitFor(() => expect(document.querySelector(".portfolio-reading-room-mobile-guide")?.getAttribute("data-has-thread")).toBe("true"));
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("Keep this thread.")).toBeNull());
    await waitFor(() => expect(document.querySelector(".portfolio-reading-room-mobile-guide")?.getAttribute("data-has-thread")).toBe("false"));
    expect(screen.getByRole("button", { name: "Read Dubs" })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("complementary", { name: "Portfolio home" })).toBeTruthy();
  });

  it("keeps the docked Guide mounted while a reader visual is open", async () => {
    await renderExperience();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Portfolio contents" })).getByRole("button", { name: "Dubs" }));

    const visualTrigger = screen.getByRole("button", {
      name: /Open gallery visual in map: Catch the thought where it happens/,
    });
    const guide = screen.getByRole("region", { name: "Portfolio Guide" });

    visualTrigger.focus();
    fireEvent.click(visualTrigger);

    // The Guide is a docked slot, not a floating surface: nothing hides it.
    expect(guide.hidden).toBe(false);
    expect(screen.getByRole("region", { name: "Portfolio Guide" })).toBe(guide);

    const closeButton = screen.getByRole("button", {
      name: "Close visual in map",
    });
    await waitFor(() => expect(document.activeElement).toBe(closeButton));
    fireEvent.click(closeButton);

    expect(screen.getByRole("region", { name: "Portfolio Guide" })).toBe(guide);
    await waitFor(() => expect(document.activeElement).toBe(visualTrigger));
  });

  it("opens a Dubs gallery group at its own first image", async () => {
    await renderExperience();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Portfolio contents" })).getByRole("button", { name: "Dubs" }));

    fireEvent.click(screen.getByRole("button", {
      name: /Open gallery visual in map: What accumulates/,
    }));

    const stage = screen.getByRole("region", {
      name: /Visual in map:/,
    });
    expect(within(stage).getByAltText("The Dubs library showing saved documents and listening progress")).toBeTruthy();
    expect(within(stage).queryByAltText("Dubs controls available from the iPhone Lock Screen")).toBeNull();
  });

  it("exposes neither the old toybox nor the Director shortcut", async () => {
    await renderExperience();
    fireEvent.keyDown(document, { key: "A", shiftKey: true });

    expect(screen.queryByLabelText("Avatar Director console")).toBeNull();
    expect(screen.queryByLabelText("Avatar toybox")).toBeNull();
    expect(document.querySelector(".portfolio-world")).toBeTruthy();
  });
});
