// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AvatarController } from "../lib/avatar/controller";
import { AvatarDirector } from "../lib/avatar/director";
import type { AvatarTargetRegistry } from "../lib/avatar/target-registry";
import type { AvatarToyboxSession } from "./avatar-toybox/useAvatarToyboxSession";
import { PortfolioExperience } from "./PortfolioExperience";

vi.mock("./avatar/AvatarOverlay", async () => {
  const React = await import("react");
  return {
    AvatarOverlay: ({
      controller,
      debug,
      development,
      director,
      enabled,
      onExpandedPanelChange,
      registry,
    }: {
      controller: AvatarController;
      debug?: boolean;
      development?: boolean;
      director?: { stop: () => void; dispose: () => void; setReducedMotion: (value: boolean) => void };
      enabled: boolean;
      onEnabledChange: (enabled: boolean) => void;
      onExpandedPanelChange?: (element: HTMLDivElement | null) => void;
      registry?: AvatarTargetRegistry;
    }) => {
      React.useEffect(() => controller.setVisible(enabled), [controller, enabled]);
      const snapshot = React.useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot,
        controller.getSnapshot,
      );
      const commands = React.useRef<string[]>([]);
      if (registry) {
        Reflect.set(globalThis, "__portfolioTestAvatarRegistry", registry);
      }
      if (director) {
        Reflect.set(globalThis, "__portfolioTestAvatarDirector", director);
      }
      const command = snapshot.currentCommand?.action;
      if (command && commands.current.at(-1) !== command) {
        commands.current.push(command);
      }
      return (
        <section
          aria-label="Test avatar overlay"
          data-enabled={enabled ? "true" : "false"}
        >
          {debug && development ? (
            <div
              aria-label="Avatar Director console"
              ref={onExpandedPanelChange}
            />
          ) : null}
          <output data-testid="avatar-target">{snapshot.target ?? "none"}</output>
          <output data-testid="avatar-state">{snapshot.state}</output>
          <output data-testid="avatar-command-log">
            {commands.current.join(",")}
          </output>
        </section>
      );
    },
  };
});

let reducedMotionPreference = false;
let reducedMotionChange: (() => void) | undefined;

vi.mock("./avatar-toybox/AvatarToyboxOverlay", () => ({
  AvatarToyboxOverlay: ({ session }: { session: AvatarToyboxSession }) => (
    <aside aria-label="Test avatar toybox">
      <output data-testid="toybox-status">{session.status}</output>
      <output data-testid="toybox-roster">{session.roster.map(({ id }) => id).join(",")}</output>
      <button onClick={session.startCollecting} type="button">Start Brain Food</button>
    </aside>
  ),
}));

function mockMatchMedia(reducedMotion = false) {
  reducedMotionPreference = reducedMotion;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return reducedMotionPreference && query.includes("prefers-reduced-motion");
    },
    media: query,
    onchange: null,
    addEventListener: vi.fn((event: string, callback: () => void) => {
      if (event === "change") reducedMotionChange = callback;
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

/**
 * PortfolioExperience mounts both overlays through React.lazy. The modules are
 * mocked above, so nothing heavy loads — but the dynamic import still round-
 * trips through vite's module graph, and under a loaded worker pool that
 * occasionally took longer than findBy's 1000ms default. The symptom was one
 * test out of 537 failing perhaps one run in six with "Unable to find a label
 * with the text of: Test avatar overlay" — a different test each time,
 * depending on which one lost the race — which reads like a component bug and
 * is not one. It was previously misdiagnosed as memory pressure and papered
 * over by capping the worker pool, which only made the race rarer.
 *
 * Resolving the specifiers once, before any test renders, puts them in the
 * module cache before React asks. The lazy boundaries then settle inside the
 * act() flush rather than racing a timer, on every render path in this file
 * rather than only the ones that remember to warm them.
 */
beforeAll(async () => {
  await Promise.all([
    import("./avatar/AvatarOverlay"),
    import("./avatar-toybox/AvatarToyboxOverlay"),
  ]);
});

// The dossier opens on home; the index rows live behind the footer control.
function openIndex() {
    fireEvent.click(screen.getByRole("button", { name: "Portfolio index" }));
}

async function renderExperience() {
  mockMatchMedia();
  if (!window.location.search) {
    window.history.replaceState({}, "", "/?view=graph");
  }
  render(<PortfolioExperience />);
  await act(async () => {});
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, "__portfolioTestAvatarRunner");
  Reflect.deleteProperty(globalThis, "__portfolioTestAvatarRegistry");
  Reflect.deleteProperty(globalThis, "__portfolioTestAvatarDirector");
  reducedMotionChange = undefined;
  window.history.replaceState({}, "", "/");
});

function effectsResponse(
  effects: Record<string, unknown>,
) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({ type: "effects", effects })}\n${JSON.stringify({ type: "turn_mode", mode: "portfolio" })}\n${JSON.stringify({ type: "answer_delta", delta: "Effect ready." })}\n${JSON.stringify({ type: "done" })}\n`,
          ),
        );
        controller.close();
      },
    }),
  );
}

async function askExperience(question: string) {
  const trigger = screen.queryByRole("button", {
    name: "Open portfolio assistant",
  });
  if (trigger) fireEvent.click(trigger);
  const input = screen.getByLabelText("Ask a question about the portfolio");
  fireEvent.change(input, { target: { value: question } });
  fireEvent.submit(document.getElementById("portfolio-question-form")!);
  await act(async () => {});
}

describe("spatial self-portrait", () => {
  it("uses one phone control for the combined map, avatar, and chat view", async () => {
    vi.stubGlobal("innerWidth", 390);
    await renderExperience();
    const experience = document.getElementById("main-content")!;
    const avatar = await screen.findByLabelText("Test avatar overlay");

    expect(experience.classList.contains("portfolio-mobile-map-open")).toBe(false);
    expect(avatar.getAttribute("data-enabled")).toBe("false");
    const mapToggle = screen.getByRole("button", { name: "Show portfolio map" });
    expect(mapToggle.textContent).toBe("");
    expect(mapToggle.querySelector("svg[aria-hidden='true']")).toBeTruthy();
    fireEvent.click(mapToggle);
    expect(experience.classList.contains("portfolio-mobile-map-open")).toBe(true);
    expect(avatar.getAttribute("data-enabled")).toBe("true");
    expect(
      (document.querySelector(".portfolio-chat-panel") as HTMLElement).hidden,
    ).toBe(false);

    const back = screen.getByRole("button", { name: "Back to portfolio home" });
    await waitFor(() => expect(document.activeElement).toBe(back));
    fireEvent.click(back);
    expect(experience.classList.contains("portfolio-mobile-map-open")).toBe(false);
    expect(avatar.getAttribute("data-enabled")).toBe("false");
    expect(
      (document.querySelector(".portfolio-chat-panel") as HTMLElement).hidden,
    ).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(mapToggle));
  });

  it("clears the combined phone mode when it closes after crossing the breakpoint", async () => {
    vi.stubGlobal("innerWidth", 390);
    await renderExperience();
    const experience = document.getElementById("main-content")!;

    fireEvent.click(screen.getByRole("button", { name: "Show portfolio map" }));
    expect(experience.classList.contains("portfolio-mobile-map-open")).toBe(true);

    vi.stubGlobal("innerWidth", 1024);
    fireEvent.click(
      screen.getByRole("button", { name: "Minimize portfolio assistant" }),
    );
    vi.stubGlobal("innerWidth", 390);

    expect(experience.classList.contains("portfolio-mobile-map-open")).toBe(false);
  });

  it("opens a reader visual in the map surface and returns to the record", async () => {
    await renderExperience();
    const experience = document.getElementById("main-content")!;
    openIndex();

    fireEvent.click(screen.getByRole("button", { name: "Dubs" }));
    expect(
      screen.getByRole("complementary", { name: "Dubs record" }),
    ).toBeTruthy();

    const visualTrigger = screen.getByRole("button", {
      name: /Open video visual in map: Demonstrate the listen/,
    });
    visualTrigger.focus();
    fireEvent.click(visualTrigger);

    expect(experience.classList.contains("portfolio-visual-open")).toBe(true);
    expect(experience.classList.contains("portfolio-mobile-map-open")).toBe(true);
    expect(
      screen.getByRole("region", {
        name: /Visual in map: Demonstrate the listen/,
      }),
    ).toBeTruthy();

    const closeButton = screen.getByRole("button", {
      name: "Close visual in map",
    });
    await waitFor(() => expect(document.activeElement).toBe(closeButton));

    const coveredNode = document.querySelector<HTMLButtonElement>(
      '[data-world-node="dubs"]',
    )!;
    expect(coveredNode.disabled).toBe(true);
    fireEvent.click(coveredNode);
    expect(experience.classList.contains("portfolio-visual-open")).toBe(true);

    fireEvent.click(closeButton);

    expect(experience.classList.contains("portfolio-visual-open")).toBe(false);
    expect(experience.classList.contains("portfolio-mobile-map-open")).toBe(false);
    expect(
      screen.getByRole("complementary", { name: "Dubs record" }),
    ).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(visualTrigger));
  });

  it("runs ambient avatar motion only while the assistant pair is visible", async () => {
    const startAmbient = vi.spyOn(AvatarDirector.prototype, "startAmbient");
    const stop = vi.spyOn(AvatarDirector.prototype, "stop");

    await renderExperience();

    expect(startAmbient).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Open portfolio assistant" }),
    );
    await waitFor(() => expect(startAmbient).toHaveBeenCalledTimes(1));

    fireEvent.click(
      screen.getByRole("button", { name: "Minimize portfolio assistant" }),
    );
    await waitFor(() => expect(stop).toHaveBeenCalled());

    fireEvent.click(
      screen.getByRole("button", { name: "Open portfolio assistant" }),
    );
    await waitFor(() => expect(startAmbient).toHaveBeenCalledTimes(2));
  });

  it("reveals and minimizes the avatar with the assistant panel", async () => {
    await renderExperience();

    const avatar = await screen.findByLabelText("Test avatar overlay");
    expect(avatar.getAttribute("data-enabled")).toBe("false");
    expect(
      (document.querySelector(".portfolio-chat-panel") as HTMLElement).hidden,
    ).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: "Open portfolio assistant" }),
    );
    expect(avatar.getAttribute("data-enabled")).toBe("true");
    expect(
      (document.querySelector(".portfolio-chat-panel") as HTMLElement).hidden,
    ).toBe(false);

    fireEvent.click(
      screen.getByRole("button", { name: "Minimize portfolio assistant" }),
    );
    expect(avatar.getAttribute("data-enabled")).toBe("false");
    expect(
      (document.querySelector(".portfolio-chat-panel") as HTMLElement).hidden,
    ).toBe(true);
  });

  it("docks the desktop avatar to the left of the opened chat panel", async () => {
    const refreshStage = vi.spyOn(AvatarController.prototype, "refreshStage");
    await renderExperience();

    fireEvent.click(
      screen.getByRole("button", { name: "Open portfolio assistant" }),
    );

    await waitFor(() =>
      expect(refreshStage).toHaveBeenCalledWith(true, {
        side: "left",
        target: "portfolio:chat",
      }),
    );
  });

  it("preserves mobile chat attention while the opened pair settles", async () => {
    const refreshStage = vi.spyOn(AvatarController.prototype, "refreshStage");
    vi.stubGlobal("innerWidth", 390);
    await renderExperience();

    fireEvent.click(screen.getByRole("button", { name: "Show portfolio map" }));
    fireEvent.focus(
      screen.getByLabelText("Ask a question about the portfolio"),
    );
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    expect(screen.getByTestId("avatar-state").textContent).toBe("listening");
    expect(refreshStage).toHaveBeenCalledWith(true, {
      placement: "top",
      target: "portfolio:chat",
    });
  });

  it("re-homes before replaying a non-chat target after the viewport changes", async () => {
    const refreshStage = vi.spyOn(AvatarController.prototype, "refreshStage");
    const execute = vi.spyOn(AvatarController.prototype, "execute");
    await renderExperience();
    await screen.findByLabelText("Test avatar overlay");
    fireEvent.click(
      screen.getByRole("button", { name: "Open portfolio assistant" }),
    );
    const director = Reflect.get(
      globalThis,
      "__portfolioTestAvatarDirector",
    ) as AvatarDirector;
    await director.runOperatorSequence([
      { action: "lookAt", target: "portfolio:index" },
    ]);
    refreshStage.mockClear();
    execute.mockClear();

    fireEvent(window, new Event("resize"));

    expect(refreshStage).toHaveBeenCalledWith(true, {
      side: "left",
      target: "portfolio:chat",
    });
    expect(execute).toHaveBeenCalledWith({
      action: "lookAt",
      target: "portfolio:index",
    });
    expect(refreshStage.mock.invocationCallOrder[0]).toBeLessThan(
      execute.mock.invocationCallOrder[0],
    );
  });

  it("renders the accepted one-world composition with its shared reader", async () => {
    await renderExperience();

    expect(document.querySelector(".portfolio-world")).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "Portfolio home" }),
    ).toBeTruthy();
    openIndex();
    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Making work playable" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "From argument to instrument" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Authorship" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Philosophy" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Move portfolio panel")).toBeNull();
  });

  it("uses the index and world as two controls for the same thread state", async () => {
    await renderExperience();
    openIndex();

    fireEvent.click(
      screen.getByRole("button", { name: "Making work playable" }),
    );

    expect(window.location.hash).toBe("#thread/making-work-playable");

    expect(
      screen.getByRole("complementary", {
        name: "Making work playable thread",
      }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Thread Making work playable" })
      .getAttribute("aria-pressed"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Dubs" }));
    expect(window.location.hash).toBe("#thread/making-work-playable/dubs");
    expect(
      screen.getByRole("complementary", { name: "Dubs record" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "In Production Dubs" }));
    expect(window.location.hash).toBe("#thread/making-work-playable");
    expect(
      screen.getByRole("complementary", { name: "Making work playable thread" }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Thread Making work playable" }),
    );
    expect(window.location.hash).toBe("");
    expect(
      screen.getByRole("complementary", { name: "Portfolio home" }),
    ).toBeTruthy();

    openIndex();
    fireEvent.click(screen.getByRole("button", { name: "Dubs" }));

    fireEvent.click(screen.getByRole("button", { name: "Portfolio home" }));
    expect(window.location.hash).toBe("");
    expect(
      screen.getByRole("complementary", { name: "Portfolio home" }),
    ).toBeTruthy();
  });

  it("uses the canonical arc identity in navigation state", async () => {
    await renderExperience();
    openIndex();

    fireEvent.click(
      screen.getByRole("button", { name: "From argument to instrument" }),
    );

    expect(window.location.hash).toBe("#thread/from-argument-to-instrument");
    expect(
      screen.getByRole("complementary", {
        name: "From argument to instrument thread",
      }),
    ).toBeTruthy();
  });

  it("does not add duplicate history when reset is already at overview", async () => {
    await renderExperience();
    const push = vi.spyOn(window.history, "pushState");

    fireEvent.keyDown(window, { key: "Escape" });

    expect(push).not.toHaveBeenCalled();
  });

  it("restores a direct thread and node state from the canonical thread link", async () => {
    window.history.replaceState(
      {},
      "",
      "/?view=graph#thread/philosophy/pitching",
    );
    await renderExperience();

    expect(
      screen.getByRole("complementary", {
        name: "Music promo campaign pitching record",
      }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Thread Philosophy" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(document.querySelector(".reader-path")?.textContent).toContain(
      "Philosophy",
    );
    expect(document.querySelector(".scene-shell")?.classList).toContain(
      "scene-shell-node-open",
    );

    const director = Reflect.get(
      globalThis,
      "__portfolioTestAvatarDirector",
    ) as AvatarDirector;
    const handle = vi.spyOn(director, "handle");
    fireEvent.click(screen.getByRole("button", { name: "Portfolio home" }));
    await waitFor(() =>
      expect(handle).toHaveBeenCalledWith({ type: "record_close" }),
    );
  });

  it("opens the Avatar Director over the canvas with Shift+A and exposes no mode buttons", async () => {
    await renderExperience();
    const before = window.location.href;

    expect(screen.queryByRole("button", { name: "Avatar Director" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Game mode" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hide assistant" })).toBeNull();
    fireEvent.keyDown(document, { key: "A", shiftKey: true });

    expect(window.location.href).toBe(before);
    expect(document.querySelector(".portfolio-world")).toBeTruthy();
    expect(await screen.findByLabelText("Avatar Director console")).toBeTruthy();
  });

  it("keeps agent chat and the live canvas mounted while Director is open", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        effectsResponse({
          avatarSequence: [
            { action: "play", animation: "wave_one_hand" },
          ],
        }),
      ),
    );
    mockMatchMedia();
    const { container } = render(<PortfolioExperience />);
    await act(async () => {});

    fireEvent.keyDown(document, { key: "A", shiftKey: true });
    expect(await screen.findByLabelText("Test avatar overlay")).toBeTruthy();
    expect(await screen.findByLabelText("Avatar Director console")).toBeTruthy();
    expect(container.querySelector(".portfolio-world")).toBeTruthy();
    expect(container.querySelector(".portfolio-reader")).toBeTruthy();
    expect(container.querySelector(".portfolio-chat")).toBeTruthy();
    expect(
      screen.getByLabelText("Ask a question about the portfolio"),
    ).toBeTruthy();

    await askExperience("Show me a wave");
    await waitFor(() =>
      expect(screen.getByTestId("avatar-command-log").textContent).toContain(
        "play",
      ),
    );
  });

  it("opens straight onto the map with the reader index", async () => {
    await renderExperience();

    expect(document.querySelector(".portfolio-composition")).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "Portfolio home" }),
    ).toBeTruthy();
  });

  it("keeps the map primary while the shared reader supplies the index", async () => {
    await renderExperience();

    expect(
      screen.getByRole("complementary", { name: "Portfolio home" }),
    ).toBeTruthy();
    openIndex();
    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Threads" })).toBeTruthy();
    expect(screen.queryByLabelText("Move portfolio panel")).toBeNull();
  });

  it("lets a direct map visit bypass the landing transition", async () => {
    await renderExperience();

    expect(screen.queryByRole("button", { name: "Enter map" })).toBeNull();
    expect(screen.queryByText("Moving through the glass…")).toBeNull();
  });

  it("lands on home from Bradley's map node, since About is the home state", async () => {
    await renderExperience();
    openIndex();
    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();

    fireEvent.click(document.querySelector('[data-world-node="bradley"]')!);
    await act(async () => {});

    expect(
      screen.getByRole("complementary", { name: "Portfolio home" }),
    ).toBeTruthy();
    expect(document.querySelector(".reader-topbar")).toBeNull();
  });

  it("renders the locked mark grammar at one optical scale", async () => {
    await renderExperience();

    expect(document.querySelector(".portfolio-world canvas")).toBeTruthy();
    expect(document.querySelectorAll('.portfolio-world-node[data-family="identity"]')).toHaveLength(1);
    expect(document.querySelectorAll('.portfolio-world-node[data-family="story"]')).toHaveLength(4);
    expect(document.querySelectorAll('.portfolio-world-node[data-family="operation"]')).toHaveLength(4);
    expect(document.querySelectorAll('.portfolio-world-node[data-family="component"]')).toHaveLength(3);
    expect(document.querySelectorAll('.portfolio-world-node[data-family="engagement"]')).toHaveLength(2);
    expect(document.querySelectorAll('.portfolio-world-node[data-family="product"]')).toHaveLength(3);
  });

  it("opens a What record in the reader and restores the index", async () => {
    await renderExperience();
    openIndex();

    fireEvent.click(screen.getByRole("button", { name: "Dubs" }));

    expect(
      screen.getByRole("complementary", { name: "Dubs record" }),
    ).toBeTruthy();
    expect(screen.getByText(/human thinking in the age of agents/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Portfolio home" }));

    expect(
      screen.getByRole("complementary", { name: "Portfolio home" }),
    ).toBeTruthy();
    expect(window.location.hash).toBe("");
  });

  it("connects chat attention and direct record navigation to the avatar director", async () => {
    // Catches the contextual director existing in isolation without owning real interface events.
    await renderExperience();
    openIndex();
    fireEvent.click(
      screen.getByRole("button", { name: "Open portfolio assistant" }),
    );
    const input = screen.getByLabelText("Ask a question about the portfolio");

    fireEvent.focus(input);
    await waitFor(() =>
      expect(screen.getByTestId("avatar-state").textContent).toBe("listening"),
    );
    expect(screen.getByTestId("avatar-target").textContent).toBe(
      "portfolio:chat",
    );

    fireEvent.click(screen.getByRole("button", { name: "Dubs" }));
    await waitFor(() =>
      expect(screen.getByTestId("avatar-command-log").textContent).toContain(
        "walkTo",
      ),
    );
    expect(screen.getByTestId("avatar-target").textContent).toBe("portfolio:record:dubs");

    expect(
      screen.getByRole("complementary", { name: "Dubs record" }),
    ).toBeTruthy();
  });

  it("keeps the reader fixed when selection changes its contents", async () => {
    await renderExperience();
    const panel = screen.getByRole("complementary", {
      name: "Portfolio home",
    });
    openIndex();
    fireEvent.click(screen.getByRole("button", { name: "Dubs" }));

    const recordPanel = screen.getByRole("complementary", {
      name: "Dubs record",
    });
    expect(recordPanel).toBe(panel);
    expect(screen.queryByLabelText("Move portfolio panel")).toBeNull();
  });

  it("resolves the live chat and index semantic targets", async () => {
    // Catches semantic IDs registering wrappers or missing DOM.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const { question } = JSON.parse(String(init?.body)) as {
          question: string;
        };
        const target = question.includes("chat")
            ? "portfolio:chat"
            : "portfolio:index";
        return effectsResponse({
          avatarSequence: [{ action: "lookAt", target }],
        });
      }),
    );
    await renderExperience();

    await askExperience("Look at chat");
    await screen.findByText("portfolio:chat", {
      selector: '[data-testid="avatar-target"]',
    });
    await askExperience("Look at index");
    await screen.findByText("portfolio:index", {
      selector: '[data-testid="avatar-target"]',
    });
  });




  it("does not resume an in-flight effect sequence after a new turn starts", async () => {
    // Catches an older effect callback starting its sequence after the newer turn already canceled avatar work.
    vi.useFakeTimers();
    const fetchImplementation = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const { question } = JSON.parse(String(init?.body)) as {
          question: string;
        };
        return question === "First question"
          ? effectsResponse({
              avatarSequence: [{ action: "play", animation: "cheer_with_both_hands" }],
            })
          : effectsResponse({});
      },
    );
    vi.stubGlobal("fetch", fetchImplementation);
    mockMatchMedia();
    render(<PortfolioExperience />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const input = screen.getByLabelText("Ask a question about the portfolio");
    const form = document.getElementById("portfolio-question-form")!;
    fireEvent.change(input, { target: { value: "First question" } });
    fireEvent.submit(form);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(input, { target: { value: "Second question" } });
    fireEvent.submit(form);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("avatar-command-log").textContent).not.toContain(
      "play",
    );
  });


  it("keeps the resting composition free of avatar and mode control pills", async () => {
    await renderExperience();

    expect(screen.queryByRole("button", { name: "Hide assistant" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Show assistant" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Avatar Director" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Game mode" })).toBeNull();
    expect(screen.getByLabelText("Ask a question about the portfolio")).toBeTruthy();
  });

  it("cancels active travel before applying a reduced-motion policy", async () => {
    mockMatchMedia(false);
    render(<PortfolioExperience />);
    await act(async () => {});
    await screen.findByLabelText("Test avatar overlay");
    const director = Reflect.get(
      globalThis,
      "__portfolioTestAvatarDirector",
    ) as { stop: () => void; setReducedMotion: (value: boolean) => void };
    const stop = vi.spyOn(director, "stop");
    const setReducedMotion = vi.spyOn(director, "setReducedMotion");

    reducedMotionPreference = true;
    act(() => reducedMotionChange?.());

    await waitFor(() => expect(stop).toHaveBeenCalled());
    expect(setReducedMotion).toHaveBeenCalledWith(true);
    expect(stop.mock.invocationCallOrder[0]).toBeLessThan(
      setReducedMotion.mock.invocationCallOrder[0]!,
    );
  });

  it("unregisters stage elements and disposes the director exactly once on unmount", async () => {
    mockMatchMedia();
    const rendered = render(<PortfolioExperience />);
    await act(async () => {});
    await screen.findByLabelText("Test avatar overlay");
    fireEvent.keyDown(document, { key: "A", shiftKey: true });
    const registry = Reflect.get(
      globalThis,
      "__portfolioTestAvatarRegistry",
    ) as AvatarTargetRegistry;
    const director = Reflect.get(
      globalThis,
      "__portfolioTestAvatarDirector",
    ) as { dispose: () => void };
    const dispose = vi.spyOn(director, "dispose");

    expect(registry.resolveStageMap().obstacles.map(({ obstacle }) => obstacle)).toContain(
      "avatar:director-console",
    );
    rendered.unmount();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(registry.resolveStageMap().targets).toEqual([]);
    expect(registry.resolveStageMap().obstacles).toEqual([]);
  });

  it("hands keyboard and avatar rendering to a canonical toybox session, then restores them", async () => {
    mockMatchMedia();
    const shell = document.body.appendChild(document.createElement("div"));
    shell.id = "app-shell";
    const portal = document.body.appendChild(document.createElement("div"));
    portal.id = "avatar-toybox-root";
    render(<PortfolioExperience />, { container: shell });
    await act(async () => {});

    expect(
      await screen.findByLabelText("Test avatar overlay", {}, { timeout: 5000 }),
    ).toBeTruthy();
    fireEvent.keyDown(document, { key: "g", shiftKey: true });
    expect(
      (await screen.findByTestId("toybox-status")).textContent,
    ).toBe("choosing");
    expect(screen.getByLabelText("Test avatar overlay")).toBeTruthy();
    expect(screen.getByTestId("toybox-roster").textContent?.split(",")).toEqual([
      "kickoff",
      "pitching",
      "reporting",
      "real-estate",
      "touring",
      "dubs",
      "writ",
      "yoohoo",
    ]);

    fireEvent.click(screen.getByText("Start Brain Food"));
    expect(screen.getByTestId("toybox-status").textContent).toBe("collecting");
    expect(document.querySelector('[aria-label="Test avatar overlay"]')).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByLabelText("Test avatar toybox")).toBeNull();
    expect(await screen.findByLabelText("Test avatar overlay")).toBeTruthy();
  });

  it("lets Shift+G open the game while the assistant pair is minimized", async () => {
    mockMatchMedia();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    const shell = document.body.appendChild(document.createElement("div"));
    shell.id = "app-shell";
    const portal = document.body.appendChild(document.createElement("div"));
    portal.id = "avatar-toybox-root";
    render(<PortfolioExperience />, { container: shell });
    await act(async () => {});
    await screen.findByLabelText("Test avatar overlay");

    fireEvent.keyDown(document, { key: "g", shiftKey: true });

    expect((await screen.findByTestId("toybox-status")).textContent).toBe("choosing");
  });
});
