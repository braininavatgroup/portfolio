// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { avatarClips, type AvatarClip, type AvatarRuntime } from "../lib/avatar/runtime";
import { startPrivacySafeReplay } from "../lib/portfolio-analytics";
import { portfolioWorldNodeById, portfolioWorldNodes } from "../lib/portfolio-world";
import { PortfolioExperience } from "./PortfolioExperience";

const avatarLoading = vi.hoisted(() => ({
  defer: false,
  finish: undefined as (() => void) | undefined,
}));

vi.mock("./avatar/AvatarOverlay", async () => {
  const React = await import("react");
  return {
    AvatarOverlay: ({ runtime }: { runtime: AvatarRuntime }) => {
      React.useEffect(() => {
        const finish = () => runtime.setAvailableClips(new Set(Object.keys(avatarClips) as AvatarClip[]));
        if (avatarLoading.defer) avatarLoading.finish = finish;
        else finish();
      }, [runtime]);
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
          data-ready={snapshot.ready ? "true" : "false"}
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
  evidenceTarget,
}: {
  avatarAction?: "swim_lap" | "turn" | "dance" | "wave" | "brain_food" | null;
  citation?: boolean;
  evidenceTarget?: { id: string; title: string };
} = {}) {
  const evidenceId = evidenceTarget?.id ?? "pitching";
  const evidenceTitle = evidenceTarget?.title ?? "Music Promo Campaign Pitching";
  const encoder = new TextEncoder();
  const lines = [
    { type: "effects", effects: { avatarAction, issues: [] } },
    { type: "turn_mode", mode: "portfolio" },
    ...(citation ? [{
      type: "evidence",
      evidence: [{
        excerpt: "A weekly curator workflow.",
        href: `/?view=graph#${evidenceId}`,
        id: `node:${evidenceId}`,
        title: evidenceTitle,
      }],
    }] : []),
    { type: "answer_delta", delta: citation ? "The [weekly workflow][E1]." : "Effect ready." },
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

async function renderExperience({ desktop = true, url = "/?view=graph" } = {}) {
  mockMatchMedia({ desktop });
  window.history.replaceState({}, "", url);
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
  avatarLoading.defer = false;
  avatarLoading.finish = undefined;
  mediaListeners.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.head.innerHTML = "";
  delete window.clarity;
  window.history.replaceState({}, "", "/");
});

describe("PortfolioExperience Reading Room integration", () => {
  it("opens a canonical project URL without relying on a fragment", async () => {
    await renderExperience({ url: "/index/dubs" });
    expect(screen.getByRole("complementary", { name: "Dubs record" })).toBeTruthy();
    selectContentsRecord("Writ");
    expect(window.location.pathname).toBe("/index/writ");
    expect(window.location.hash).toBe("");
    window.history.pushState({}, "", "/index/dubs");
    fireEvent.popState(window);
    await waitFor(() => expect(screen.getByRole("complementary", { name: "Dubs record" })).toBeTruthy());
  });

  it("attributes a content open to the UI location that selected it", async () => {
    const node = portfolioWorldNodes.find(
      (candidate) => candidate.id !== "bradley" && candidate.outlineType !== "why",
    )!;
    startPrivacySafeReplay({
      context: "external",
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });
    window.clarity!.q = [];
    await renderExperience();

    selectContentsRecord(node.label);

    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_content_id",
      node.id,
    ]);
    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_selection_source",
      "contents",
    ]);
    expect(window.clarity?.q?.some((call) => call[0] === "event")).toBe(true);
  });

  it("attributes a valid deep-linked record open to the URL", async () => {
    const node = portfolioWorldNodes.find(
      (candidate) => candidate.id !== "bradley" && candidate.outlineType !== "why",
    )!;
    startPrivacySafeReplay({
      context: "external",
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });
    window.clarity!.q = [];

    await renderExperience({ url: `/?view=graph#${node.id}` });

    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_content_id",
      node.id,
    ]);
    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_selection_source",
      "url",
    ]);
  });

  it("reports accepted Guide evidence by its arbitrary target ID", async () => {
    const node = portfolioWorldNodes.find(
      (candidate) => candidate.id !== "bradley" && candidate.outlineType !== "why",
    )!;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => guideResponse({
        citation: true,
        evidenceTarget: { id: node.id, title: node.label },
      })),
    );
    startPrivacySafeReplay({
      context: "external",
      hostname: "bradleyberkman.com",
      projectId: "abc123",
    });
    window.clarity!.q = [];
    await renderExperience();

    submitGuide("Show the evidence.");
    fireEvent.click(await screen.findByRole("link", {
      name: "weekly workflow",
    }));

    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_evidence_source",
      "guide",
    ]);
    expect(window.clarity?.q).toContainEqual([
      "set",
      "portfolio_target_id",
      node.id,
    ]);
  });

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

  it.each([["wave", "waving", "wave"], ["swim_lap", "swimming", "swim_forward"], ["turn", "turning", "full_turn_left"], ["dance", "dancing", "step_hip_hop_dance"]] as const)("plays the answer reaction before requested %s", async (action, phase, clip) => {
    // Leave React's scheduler and browser frame callbacks on real time.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.stubGlobal("fetch", vi.fn(async () => guideResponse({ avatarAction: action })));
    mockMatchMedia();
    window.history.replaceState({}, "", "/?view=graph");
    render(<PortfolioExperience />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    submitGuide(action === "wave" ? "Wave hello" : action === "dance" ? "Can you dance?" : action === "turn" ? "Turn around." : "Take a leisurely swim.");
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    const avatar = screen.getByLabelText("Test avatar overlay");
    expect(avatar.dataset.animation).toBe("agree_gesture");
    await act(async () => { await vi.advanceTimersByTimeAsync(1_600); });
    expect(avatar.dataset.phase).toBe(phase);
    expect(avatar.dataset.animation).toBe(clip);
  });

  it("starts Brain Food from a Guide suggestion and restores the selected page and layout on exit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => guideResponse({avatarAction: "brain_food"})));
    await renderExperience();
    selectContentsRecord("Dubs");
    const beforeUrl = window.location.href;
    const slots = () => Array.from(document.querySelectorAll<HTMLElement>("[data-reading-room-slot]")).map(element => [element.dataset.readingRoomSlot, element.dataset.view, element.dataset.collapsed]);
    const beforeSlots = slots();
    fireEvent.click(await screen.findByRole("button", {name: "Play Brain Food"}));
    await waitFor(() => expect(screen.getByLabelText("Test avatar overlay").dataset.phase).toBe("brain-food"));
    expect(document.querySelector('[data-reading-room-slot="main"]')?.getAttribute("data-view")).toBe("map");
    fireEvent.click(screen.getByRole("button", {name: "Exit Brain Food"}));
    await waitFor(() => expect(screen.queryByRole("button", {name: "Exit Brain Food"})).toBeNull());
    expect(slots()).toEqual(beforeSlots);
    expect(window.location.href).toBe(beforeUrl);
    expect(screen.getByRole("complementary", {name: "Dubs record"})).toBeTruthy();
  });

  it("runs Brain Food on the live Map and restores the selected Reader record on Escape", async () => {
    avatarLoading.defer = true;
    await renderExperience();
    selectContentsRecord("Dubs");
    expect(screen.getByRole("complementary", { name: "Dubs record" })).toBeTruthy();

    const avatar = await screen.findByLabelText("Test avatar overlay");
    expect(avatar.dataset.ready).toBe("false");
    fireEvent.keyDown(document, { key: "G", shiftKey: true });
    expect(screen.queryByText(/Brain Food ·/)).toBeNull();

    // Mounting the lazy overlay does not mean its animation assets are ready.
    // Control readiness explicitly instead of racing the effect on a busy runner.
    await waitFor(() => expect(avatarLoading.finish).toBeTypeOf("function"));
    act(() => avatarLoading.finish!());
    await waitFor(() => expect(avatar.dataset.ready).toBe("true"));
    fireEvent.keyDown(document, { key: "G", shiftKey: true });

    expect(await screen.findByText(/Brain Food · 13 left/)).toBeTruthy();
    expect(document.querySelector(".avatar-toybox")).toBeNull();
    expect(document.querySelector('[data-world-node="bradley"]')).toBeTruthy();
    expect((document.querySelector('[data-world-node="bradley"]') as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(screen.getByLabelText("Test avatar overlay").dataset.phase).toBe("brain-food"));

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

    expect(window.location.pathname).toBe("/index/dubs");
    expect(screen.getByRole("complementary", { name: "Dubs record" })).toBeTruthy();
    expect(document.querySelector(".portfolio-world")).toBeTruthy();

    window.history.pushState({}, "", "/?view=graph#writ");
    fireEvent.popState(window);
    await waitFor(() => expect(screen.getByRole("complementary", { name: "Writ record" })).toBeTruthy());
  });

  it("routes a Guide citation into owner selection while mobile remains on Map", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => guideResponse({ citation: true })));
    await renderExperience({ desktop: false });
    fireEvent.click(screen.getByRole("button", { name: "Map tab" }));
    submitGuide("Tell me about pitching.");
    const citation = await screen.findByRole("link", {
      name: "weekly workflow",
    });

    fireEvent.click(citation);

    expect(window.location.pathname).toBe("/index/pitching");
    expect(screen.getByRole("button", { name: "Map tab" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Read Music Promo Campaign Pitching" })).toBeTruthy();
  });

  it("gives reader visual and Guide-thread Escape priority before returning the Reader to About", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => guideResponse()));
    await renderExperience({ desktop: false });
    fireEvent.click(screen.getByRole("button", { name: "Contents tab" }));
    selectContentsRecord("Dubs");
    const visual = screen.getAllByRole("button", { name: /Open .* visual in reader:/ })[0]!;
    fireEvent.click(visual);
    expect(screen.getByRole("dialog", { name: /Visual in reader:/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reader tab" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /Visual in reader:/ })).toBeNull();
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
      name: /Open gallery visual in reader: Catch the thought where it happens/,
    });
    const guide = screen.getByRole("region", { name: "Portfolio Guide" });

    visualTrigger.focus();
    fireEvent.click(visualTrigger);

    // The Guide is a docked slot, not a floating surface: nothing hides it.
    expect(guide.hidden).toBe(false);
    expect(screen.getByRole("region", { name: "Portfolio Guide" })).toBe(guide);

    const closeButton = screen.getByRole("button", {
      name: "Close visual in reader",
    });
    await waitFor(() => expect(document.activeElement).toBe(closeButton));
    fireEvent.click(closeButton);

    expect(screen.getByRole("region", { name: "Portfolio Guide" })).toBe(guide);
    await waitFor(() => expect(document.activeElement).toBe(visualTrigger));
  });

  it("keeps the collapsed desktop Map closed when a Reader visual opens", async () => {
    await renderExperience();
    fireEvent.click(screen.getByRole("button", { name: "Hide side panes" }));
    const mapPane = document.querySelector('[data-reading-room-slot][data-view="map"]')!;
    expect(mapPane.querySelector<HTMLElement>(".portfolio-reading-room-pane-body")!.hidden).toBe(true);
    selectContentsRecord("Dubs");

    fireEvent.click(screen.getAllByRole("button", { name: /Open .* visual in reader:/ })[0]!);

    expect(document.querySelector<HTMLElement>('[data-reading-room-slot][data-view="map"] .portfolio-reading-room-pane-body')!.hidden).toBe(true);
    expect(screen.getByRole("dialog", { name: /Visual in reader:/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show side panes" })).toBeTruthy();
  });

  it("does not push history when a visual closes at the home URL", async () => {
    // The About body carries no visual today; lend it one so the home state
    // can open a visual without first selecting a record.
    const home = portfolioWorldNodeById.get("bradley")!;
    const visual = portfolioWorldNodeById.get("dubs")!.body.find((block) => (
      typeof block === "object" && block.type === "visual"
    ))!;
    const homeBody = home.body as unknown[];
    homeBody.push(visual);
    try {
      await renderExperience();
      const pushState = vi.spyOn(window.history, "pushState");
      fireEvent.click(screen.getByRole("button", { name: "Hide Contents" }));
      fireEvent.click(screen.getAllByRole("button", { name: /Open .* visual in reader:/ })[0]!);
      expect(screen.getByRole("dialog", { name: /Visual in reader:/ })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Close visual in reader" }));

      expect(screen.queryByRole("dialog", { name: /Visual in reader:/ })).toBeNull();
      expect(pushState).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Show Contents" }));
      selectContentsRecord("Dubs");
      expect(pushState).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getAllByRole("button", { name: /Open .* visual in reader:/ })[0]!);
      fireEvent.click(screen.getByRole("button", { name: "Hide Contents" }));
      fireEvent.click(screen.getByRole("button", { name: "Return to About" }));

      expect(pushState).toHaveBeenCalledTimes(2);
      expect(window.location.hash).toBe("");
    } finally {
      homeBody.pop();
    }
  });

  it("opens a Dubs gallery group at its own first image", async () => {
    await renderExperience();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Portfolio contents" })).getByRole("button", { name: "Dubs" }));

    fireEvent.click(screen.getByRole("button", {
      name: /Open gallery visual in reader: What accumulates/,
    }));

    const stage = screen.getByRole("dialog", {
      name: /Visual in reader:/,
    });
    expect(within(stage).getByAltText("Dubs library with documents, tags, threads, markups, and Perspectives.")).toBeTruthy();
    expect(within(stage).queryByAltText("Dubs playback, Highlight, and Inline Note controls on the iPhone Lock Screen.")).toBeNull();
  });

  it("exposes neither the old toybox nor the Director shortcut", async () => {
    await renderExperience();
    fireEvent.keyDown(document, { key: "A", shiftKey: true });

    expect(screen.queryByLabelText("Avatar Director console")).toBeNull();
    expect(screen.queryByLabelText("Avatar toybox")).toBeNull();
    expect(document.querySelector(".portfolio-world")).toBeTruthy();
  });
});
