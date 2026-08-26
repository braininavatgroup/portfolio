// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AvatarController } from "../lib/avatar/controller";
import type { AvatarSequenceRunner } from "../lib/avatar/sequence-runner";
import type { SiteActionExecutor } from "../lib/avatar/site-actions";
import type { AvatarTargetRegistry } from "../lib/avatar/target-registry";
import type { SpatialGraphNode } from "../lib/spatial-graph";
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
      onEnabledChange,
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
        <section aria-label="Test avatar overlay">
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
          <button
            onClick={() => onEnabledChange(!enabled)}
            type="button"
          >
            {enabled ? "Hide assistant" : "Show assistant"}
          </button>
        </section>
      );
    },
  };
});

vi.mock("./scene/PortfolioCanvas", () => ({
  PortfolioCanvas: ({
    nodes,
    onEnter,
    onNodeSelect,
  }: {
    nodes: readonly SpatialGraphNode[];
    onEnter: () => void;
    onNodeSelect: (node: SpatialGraphNode) => void;
  }) => (
    <div data-testid="scene-canvas">
      <output data-testid="visible-node-roles">
        {nodes.map(({ role }) => role).join(",")}
      </output>
      <button onClick={onEnter} type="button">
        Select Bradley body
      </button>
      <button
        onClick={() => {
          const domain = nodes.find(
            (node) => node.role === "domain" && node.groupId === "music",
          );
          if (domain) onNodeSelect(domain);
        }}
        type="button"
      >
        Select Music domain
      </button>
      <button
        onClick={() =>
          onNodeSelect({
            id: "dubs:approach",
            label: "Product spec and build process",
            detail: "Connect the product spec to implementation.",
            role: "approach",
            position: [0, 0, 0],
            entityIds: ["dubs:spec", "dubs:system"],
            projectId: "project:dubs",
            projectSlug: "dubs",
            href: "/index/dubs",
            groupId: "development",
          })
        }
        type="button"
      >
        Select Dubs approach
      </button>
    </div>
  ),
}));

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

let portfolioStorageValues: Map<string, string>;

beforeEach(() => {
  portfolioStorageValues = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => portfolioStorageValues.get(key) ?? null,
    setItem: (key: string, value: string) =>
      portfolioStorageValues.set(key, value),
  });
});

async function renderExperience(initialPhase: "body" | "graph" = "graph") {
  mockMatchMedia();
  render(<PortfolioExperience initialPhase={initialPhase} />);
  await act(async () => {});
}

afterEach(() => {
  cleanup();
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
  const input = screen.getByLabelText("Ask a question about the portfolio");
  fireEvent.change(input, { target: { value: question } });
  fireEvent.submit(document.getElementById("portfolio-question-form")!);
  await act(async () => {});
}

describe("spatial self-portrait", () => {
  it("offers the Avatar Director from the normal development portfolio", async () => {
    await renderExperience("body");

    const directorLink = screen.getByRole("link", { name: "Avatar Director" });
    expect(directorLink.getAttribute("href")).toBe("/?avatarLab=1");
  });

  it("keeps agent chat in the isolated development avatar lab", async () => {
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
    const { container } = render(
      <PortfolioExperience avatarLab initialPhase="graph" />,
    );
    await act(async () => {});

    expect(
      screen.getByRole("main", { name: "Avatar lab" }).className,
    ).toContain("avatar-lab");
    expect(await screen.findByLabelText("Test avatar overlay")).toBeTruthy();
    expect(await screen.findByLabelText("Avatar Director console")).toBeTruthy();
    expect(screen.queryByText("Avatar developer controls")).toBeNull();
    expect(container.querySelector(".portfolio-header")).toBeNull();
    expect(container.querySelector(".scene-shell")).toBeNull();
    expect(container.querySelector(".portfolio-chat")).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Avatar stage targets" }),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Ask a question about the portfolio"),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Back to portfolio" }).getAttribute("href"),
    ).toBe("/");
    expect(screen.queryByTestId("scene-canvas")).toBeNull();
    expect(
      screen.queryByText(
        "I find where judgment matters, then build the system around it.",
      ),
    ).toBeNull();

    await askExperience("Show me a wave");
    await waitFor(() =>
      expect(screen.getByTestId("avatar-command-log").textContent).toContain(
        "play",
      ),
    );
  });

  it("opens on Bradley and enters the map from the figure without exposing graph UI early", async () => {
    vi.useFakeTimers();
    await renderExperience("body");

    expect(
      screen.getByText("Bradley Berkman").getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.getByRole("link", { name: "Map" }).getAttribute("href")).toBe(
      "/?view=graph",
    );
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByLabelText("Keyboard map navigation")).toBeNull();
    expect(screen.queryByRole("button", { name: "Enter map" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Select Bradley body" }));

    expect(document.querySelector(".experience-entering")).toBeTruthy();
    expect(window.location.search).toBe("?view=graph");

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(document.querySelector(".experience-graph")).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();
  });

  it("keeps the map primary while exposing the standalone index as a list fallback", async () => {
    await renderExperience();

    const navigation = screen.getByRole("navigation", {
      name: "Portfolio views",
    });
    expect(navigation.querySelector('[aria-current="page"]')?.textContent).toBe(
      "Map",
    );
    expect(screen.queryByRole("link", { name: "Index" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "View as list" }).getAttribute("href"),
    ).toBe("/index");
    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();
  });

  it("lets a direct map visit bypass the landing transition", async () => {
    await renderExperience();

    expect(screen.queryByRole("button", { name: "Enter map" })).toBeNull();
    expect(screen.queryByText("Moving through the glass…")).toBeNull();
  });

  it("reverses into the Bradley landing from the header without remounting the scene", async () => {
    vi.useFakeTimers();
    await renderExperience("graph");

    expect(document.querySelector(".experience-graph")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Bradley Berkman" }));

    expect(document.querySelector(".experience-returning")).toBeTruthy();
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(document.querySelector(".experience-body")).toBeTruthy();
    expect(
      screen.getByText("Bradley Berkman").getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("starts with the compact hierarchy and lets a domain hub focus its projects", async () => {
    await renderExperience();

    expect(screen.getByTestId("visible-node-roles").textContent).toBe(
      [
        "root",
        "domain",
        "domain",
        "domain",
        "output",
        "output",
        "output",
        "output",
        "output",
        "output",
        "output",
        "output",
        "output",
      ].join(","),
    );

    fireEvent.click(screen.getByRole("button", { name: "Select Music domain" }));

    expect(screen.getByTestId("visible-node-roles").textContent).toBe(
      ["root", "domain", "output", "output", "output"].join(","),
    );
    expect(
      screen
        .getByRole("button", { name: "Music promotion" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("opens a complete project dossier and restores the index from its back control", async () => {
    await renderExperience();

    fireEvent.click(screen.getByRole("button", { name: "Select Dubs approach" }));

    expect(
      screen.getByRole("complementary", { name: "Dubs project dossier" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Approach" })
        .getAttribute("aria-expanded"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: /Portfolio index/ }));

    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }),
    ).toBeTruthy();
  });

  it("connects chat attention and direct project navigation to the avatar director", async () => {
    // Catches the contextual director existing in isolation without owning real interface events.
    await renderExperience();
    const input = screen.getByLabelText("Ask a question about the portfolio");

    fireEvent.focus(input);
    await waitFor(() =>
      expect(screen.getByTestId("avatar-state").textContent).toBe("listening"),
    );
    expect(screen.getByTestId("avatar-target").textContent).toBe(
      "portfolio:chat",
    );

    fireEvent.click(screen.getByRole("button", { name: "Select Dubs approach" }));
    await waitFor(() =>
      expect(screen.getByTestId("avatar-command-log").textContent).toContain(
        "walkTo",
      ),
    );
    expect(screen.getByTestId("avatar-target").textContent).toBe("project:dubs");

    fireEvent.click(screen.getByRole("button", { name: "Output" }));
    await waitFor(() =>
      expect(screen.getByTestId("avatar-command-log").textContent).toContain(
        "lookAt",
      ),
    );
  });

  it("keeps the dossier position when graph selection changes its contents", async () => {
    await renderExperience();
    const panel = screen.getByRole("complementary", {
      name: "Portfolio index",
    });
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
      bottom: 400,
      height: 300,
      left: 600,
      right: 984,
      top: 100,
      width: 384,
      x: 600,
      y: 100,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(screen.getByLabelText("Move portfolio panel"), {
      button: 0,
      clientX: 700,
      clientY: 130,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 200,
      clientY: 200,
      pointerId: 1,
    });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(panel.style.left).toBe("100px");
    expect(panel.style.top).toBe("170px");

    fireEvent.click(screen.getByRole("button", { name: "Select Dubs approach" }));

    const projectPanel = screen.getByRole("complementary", {
      name: "Dubs project dossier",
    });
    expect(projectPanel.style.left).toBe("100px");
    expect(projectPanel.style.top).toBe("170px");
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
        name: "Dubs project dossier",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Output" }).getAttribute("aria-expanded"),
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
    expect(
      screen.getByRole("complementary", { name: "Portfolio index" }).className,
    ).toContain("avatar-spotlight");

    await askExperience("Spotlight Dubs");
    const project = await screen.findByRole("complementary", {
      name: "Dubs project dossier",
    });
    expect(project.className).toContain("avatar-spotlight");

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
    render(<PortfolioExperience initialPhase="graph" />);
    await act(async () => {});

    await askExperience("Open Dubs gently");

    expect(
      await screen.findByRole("complementary", {
        name: "Dubs project dossier",
      }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId("avatar-command-log").textContent).toContain(
        "lookAt",
      ),
    );
    expect(screen.getByTestId("avatar-command-log").textContent).not.toContain(
      "enter",
    );
    expect(screen.getByTestId("avatar-target").textContent).toBe("project:dubs");
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
    render(<PortfolioExperience initialPhase="graph" />);
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
    const rendered = render(<PortfolioExperience initialPhase="graph" />);
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

  it("persists hiding without removing chat or portfolio navigation", async () => {
    // Catches the optional overlay becoming the only access path or forgetting the user's hide choice.
    await renderExperience();

    fireEvent.click(await screen.findByRole("button", { name: "Hide assistant" }));

    expect(portfolioStorageValues.get("portfolio-avatar-enabled:v1")).toBe(
      "false",
    );
    expect(
      screen.getByLabelText("Ask a question about the portfolio"),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Bradley Berkman" })).toBeTruthy();

    cleanup();
    await renderExperience();
    expect(
      await screen.findByRole("button", { name: "Show assistant" }),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Ask a question about the portfolio"),
    ).toBeTruthy();
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
    render(<PortfolioExperience initialPhase="graph" />);
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

  it("stops ownership before persisting a hidden avatar preference", async () => {
    await renderExperience();
    await screen.findByLabelText("Test avatar overlay");
    const director = Reflect.get(
      globalThis,
      "__portfolioTestAvatarDirector",
    ) as { stop: () => void };
    const stop = vi.spyOn(director, "stop");

    fireEvent.click(await screen.findByRole("button", { name: "Hide assistant" }));

    expect(stop).toHaveBeenCalled();
    expect(portfolioStorageValues.get("portfolio-avatar-enabled:v1")).toBe("false");
  });

  it("unregisters stage elements and disposes the director exactly once on unmount", async () => {
    mockMatchMedia();
    const rendered = render(<PortfolioExperience avatarLab initialPhase="graph" />);
    await act(async () => {});
    await screen.findByLabelText("Test avatar overlay");
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
    render(<PortfolioExperience initialPhase="graph" />, { container: shell });
    await act(async () => {});

    expect(await screen.findByLabelText("Test avatar overlay")).toBeTruthy();
    fireEvent.keyDown(document, { key: "g", shiftKey: true });
    expect((await screen.findByTestId("toybox-status")).textContent).toBe("choosing");
    expect(screen.getByLabelText("Test avatar overlay")).toBeTruthy();
    expect(screen.getByTestId("toybox-roster").textContent?.split(",").every((id) => id.endsWith(":output"))).toBe(true);

    fireEvent.click(screen.getByText("Start Brain Food"));
    expect(screen.getByTestId("toybox-status").textContent).toBe("collecting");
    expect(document.querySelector('[aria-label="Test avatar overlay"]')).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByLabelText("Test avatar toybox")).toBeNull();
    expect(await screen.findByLabelText("Test avatar overlay")).toBeTruthy();
  });
});
