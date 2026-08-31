// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AvatarController } from "../lib/avatar/controller";
import { AvatarDirector } from "../lib/avatar/director";
import type { AvatarSequenceRunner } from "../lib/avatar/sequence-runner";
import type { SiteActionExecutor } from "../lib/avatar/site-actions";
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
      runner,
    }: {
      controller: AvatarController;
      debug?: boolean;
      development?: boolean;
      director?: { stop: () => void; dispose: () => void; setReducedMotion: (value: boolean) => void };
      enabled: boolean;
      onEnabledChange: (enabled: boolean) => void;
      onExpandedPanelChange?: (element: HTMLDivElement | null) => void;
      registry?: AvatarTargetRegistry;
      runner?: AvatarSequenceRunner;
      siteActionExecutor?: SiteActionExecutor;
    }) => {
      React.useEffect(() => controller.setVisible(enabled), [controller, enabled]);
      const snapshot = React.useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot,
        controller.getSnapshot,
      );
      const commands = React.useRef<string[]>([]);
      if (runner) {
        Reflect.set(globalThis, "__portfolioTestAvatarRunner", runner);
      }
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
  it("switches the phone composition between Index and Map", async () => {
    await renderExperience();
    const experience = document.getElementById("main-content")!;

    expect(experience.classList.contains("portfolio-mobile-map-open")).toBe(false);
    const mapToggle = screen.getByRole("button", { name: "Show portfolio map" });
    expect(mapToggle.textContent).toBe("");
    expect(mapToggle.querySelector("svg[aria-hidden='true']")).toBeTruthy();
    fireEvent.click(mapToggle);
    expect(experience.classList.contains("portfolio-mobile-map-open")).toBe(true);
    expect(
      screen.getByRole("button", { name: "Show portfolio index" }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "In Production Dubs" }),
    );
    expect(experience.classList.contains("portfolio-mobile-map-open")).toBe(false);
    expect(
      screen.getByRole("complementary", { name: "Dubs record" }),
    ).toBeTruthy();
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

  it("renders the accepted one-world composition with its shared reader", async () => {
    await renderExperience();

    expect(document.querySelector(".portfolio-world")).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Making work playable" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Choosing what not to automate" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "From argument to instrument" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Move portfolio panel")).toBeNull();
  });

  it("uses the index and world as two controls for the same thread state", async () => {
    await renderExperience();

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
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dubs" }));

    fireEvent.click(screen.getByRole("button", { name: "Portfolio index" }));
    expect(window.location.hash).toBe("");
    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();
  });

  it("does not add duplicate history when reset is already at overview", async () => {
    await renderExperience();
    const push = vi.spyOn(window.history, "pushState");

    fireEvent.keyDown(window, { key: "Escape" });

    expect(push).not.toHaveBeenCalled();
  });

  it("restores a direct thread and node state from a legacy story link", async () => {
    window.history.replaceState(
      {},
      "",
      "/?view=graph#story/choosing-what-not-to-automate/pitching",
    );
    await renderExperience();

    expect(
      screen.getByRole("complementary", { name: "Campaign pitching record" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Thread Choosing what not to automate" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(document.querySelector(".reader-path")?.textContent).toContain(
      "Choosing what not to automate",
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
          siteActions: [],
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

    expect(document.querySelector(".experience-graph")).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();
  });

  it("keeps the map primary while the shared reader supplies the index", async () => {
    await renderExperience();

    const navigation = screen.getByRole("navigation", {
      name: "Portfolio views",
    });
    expect(navigation.querySelector('[aria-current="page"]')?.textContent).toBe(
      "Map",
    );
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

  it("opens the About record from the header wordmark instead of leaving the map", async () => {
    await renderExperience();

    expect(document.querySelector(".experience-graph")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Bradley Berkman" }));
    await act(async () => {});

    expect(document.querySelector(".experience-graph")).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "Bradley Berkman record" }),
    ).toBeTruthy();
  });

  it("renders the locked mark grammar at one optical scale", async () => {
    await renderExperience();

    expect(document.querySelector(".portfolio-world canvas")).toBeTruthy();
    expect(document.querySelectorAll('[data-family="identity"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-family="story"]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-family="operation"]')).toHaveLength(4);
    expect(document.querySelectorAll('[data-family="component"]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-family="personal"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-family="engagement"]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-family="product"]')).toHaveLength(3);
  });

  it("opens a project record in the reader and restores the index", async () => {
    await renderExperience();

    fireEvent.click(screen.getByRole("button", { name: "Dubs" }));

    expect(
      screen.getByRole("complementary", { name: "Dubs record" }),
    ).toBeTruthy();
    expect(screen.getByText(/human thinking in the age of agents/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Portfolio index" }));

    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();
  });

  it("connects chat attention and direct project navigation to the avatar director", async () => {
    // Catches the contextual director existing in isolation without owning real interface events.
    await renderExperience();
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
    expect(screen.getByTestId("avatar-target").textContent).toBe("project:dubs");

    expect(
      screen.getByRole("complementary", { name: "Dubs record" }),
    ).toBeTruthy();
  });

  it("keeps the reader fixed when selection changes its contents", async () => {
    await renderExperience();
    const panel = screen.getByRole("complementary", {
      name: "Portfolio index",
    });
    fireEvent.click(screen.getByRole("button", { name: "Dubs" }));

    const projectPanel = screen.getByRole("complementary", {
      name: "Dubs record",
    });
    expect(projectPanel).toBe(panel);
    expect(screen.queryByLabelText("Move portfolio panel")).toBeNull();
  });

  it("resolves hero, real chat, and current dossier semantic targets", async () => {
    // Catches semantic IDs registering wrappers, missing DOM, or stale dossier elements.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const { question } = JSON.parse(String(init?.body)) as {
          question: string;
        };
        const target = question.includes("hero")
          ? "hero"
          : question.includes("chat")
            ? "portfolio:chat"
            : "portfolio:index";
        return effectsResponse({
          avatarSequence: [{ action: "lookAt", target }],
        });
      }),
    );
    await renderExperience();

    await askExperience("Look at hero");
    await screen.findByText("hero", { selector: '[data-testid="avatar-target"]' });
    await askExperience("Look at chat");
    await screen.findByText("portfolio:chat", {
      selector: '[data-testid="avatar-target"]',
    });
    await askExperience("Look at index");
    await screen.findByText("portfolio:index", {
      selector: '[data-testid="avatar-target"]',
    });
  });

  it("runs project open, tab, scroll, and close actions through current spatial selection", async () => {
    // Catches layout-changing actions leaving later semantic actions on stale dossier targets.
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { question: string };
        return body.question === "Close it"
          ? effectsResponse({
              siteActions: [
                { type: "closeProject" },
                { type: "scrollTo", target: "portfolio:index" },
              ],
            })
          : effectsResponse({
              siteActions: [
                { type: "openProject", target: "project:dubs" },
                { type: "activateTab", tab: "output" },
                { type: "scrollTo", target: "project:dubs" },
              ],
            });
      }),
    );
    await renderExperience();

    await askExperience("Open Dubs output");
    expect(
      await screen.findByRole("complementary", {
        name: "Dubs record",
      }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "In Production Dubs" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(scrollTo).toHaveBeenCalledTimes(1);

    await askExperience("Close it");
    expect(
      await screen.findByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("moves and clears the semantic dossier spotlight", async () => {
    // Catches spotlight classes sticking to stale dossier content across selection changes.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const { question } = JSON.parse(String(init?.body)) as {
          question: string;
        };
        if (question === "Spotlight index") {
          return effectsResponse({
            siteActions: [{ type: "spotlight", target: "portfolio:index" }],
          });
        }
        if (question === "Spotlight Dubs") {
          return effectsResponse({
            siteActions: [
              { type: "openProject", target: "project:dubs" },
              { type: "spotlight", target: "project:dubs" },
            ],
          });
        }
        return effectsResponse({ siteActions: [{ type: "clearSpotlight" }] });
      }),
    );
    await renderExperience();

    await askExperience("Spotlight index");
    await waitFor(() =>
      expect(
        screen.getByRole("complementary", { name: "Portfolio index" }).className,
      ).toContain("avatar-spotlight"),
    );

    await askExperience("Spotlight Dubs");
    const project = await screen.findByRole("complementary", {
      name: "Dubs record",
    });
    await waitFor(() =>
      expect(project.className).toContain("avatar-spotlight"),
    );

    await askExperience("Clear spotlight");
    await waitFor(() =>
      expect(project.className).not.toContain("avatar-spotlight"),
    );
  });

  it("adapts avatar travel for reduced motion while preserving project actions", async () => {
    // Catches reduced motion dropping essential site actions or retaining dramatic travel commands.
    mockMatchMedia(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        effectsResponse({
          siteActions: [{ type: "openProject", target: "project:dubs" }],
          avatarSequence: [
            { action: "enter", from: "left" },
            { action: "wait", durationMs: 500 },
            { action: "walkTo", target: "project:dubs" },
          ],
        }),
      ),
    );
    render(<PortfolioExperience />);
    await act(async () => {});

    await askExperience("Open Dubs gently");

    expect(
      await screen.findByRole("complementary", {
        name: "Dubs record",
      }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId("avatar-command-log").textContent).toContain(
        "lookAt",
      ),
    );
    await waitFor(() => {
      expect(screen.getByTestId("avatar-command-log").textContent).not.toContain(
        "enter",
      );
      expect(screen.getByTestId("avatar-target").textContent).toBe("project:dubs");
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
              siteActions: [
                { type: "spotlight", target: "portfolio:index" },
              ],
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

  it("invalidates delayed avatar effects when the experience unmounts", async () => {
    // Catches cleanup canceling the current runner while allowing delayed effect work to start it again.
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        effectsResponse({
          siteActions: [{ type: "spotlight", target: "portfolio:index" }],
          avatarSequence: [{ action: "play", animation: "cheer_with_both_hands" }],
        }),
      ),
    );
    mockMatchMedia();
    const rendered = render(<PortfolioExperience />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const runner = Reflect.get(
      globalThis,
      "__portfolioTestAvatarRunner",
    ) as AvatarSequenceRunner;
    const run = vi.spyOn(runner, "run");

    const input = screen.getByLabelText("Ask a question about the portfolio");
    fireEvent.change(input, { target: { value: "Question" } });
    fireEvent.submit(document.getElementById("portfolio-question-form")!);
    await act(async () => {
      await vi.advanceTimersToNextTimerAsync();
    });
    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }).className,
    ).toContain("avatar-spotlight");

    rendered.unmount();
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(
      run.mock.calls.some(([commands]) =>
        commands.some((command) => command.action === "play"),
      ),
    ).toBe(false);
  });

  it("keeps the resting composition free of avatar and mode control pills", async () => {
    await renderExperience();

    expect(screen.queryByRole("button", { name: "Hide assistant" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Show assistant" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Avatar Director" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Game mode" })).toBeNull();
    expect(screen.getByLabelText("Ask a question about the portfolio")).toBeTruthy();
  });

  it("registers the visible header as a stage obstacle without exposing it as a target", async () => {
    await renderExperience();
    await screen.findByLabelText("Test avatar overlay");
    const registry = Reflect.get(
      globalThis,
      "__portfolioTestAvatarRegistry",
    ) as AvatarTargetRegistry;

    expect(registry.resolveStageMap().obstacles.map(({ obstacle }) => obstacle)).toContain(
      "portfolio:header",
    );
    expect(registry.resolveAll().map(({ target }) => target)).not.toContain(
      "portfolio:header",
    );
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
      (await screen.findByTestId("toybox-status", {}, { timeout: 5000 })).textContent,
    ).toBe("choosing");
    expect(screen.getByLabelText("Test avatar overlay")).toBeTruthy();
    expect(screen.getByTestId("toybox-roster").textContent?.split(",").every((id) => id.endsWith(":output"))).toBe(true);

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
