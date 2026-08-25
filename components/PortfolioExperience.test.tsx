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
import type { SpatialGraphNode } from "../lib/spatial-graph";
import { PortfolioExperience } from "./PortfolioExperience";

vi.mock("./avatar/AvatarOverlay", async () => {
  const React = await import("react");
  return {
    AvatarOverlay: ({
      controller,
      enabled,
      onEnabledChange,
      runner,
    }: {
      controller: AvatarController;
      enabled: boolean;
      onEnabledChange: (enabled: boolean) => void;
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
      const command = snapshot.currentCommand?.action;
      if (command && commands.current.at(-1) !== command) {
        commands.current.push(command);
      }
      return (
        <section aria-label="Test avatar overlay">
          <output data-testid="avatar-target">{snapshot.target ?? "none"}</output>
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

function mockMatchMedia(reducedMotion = false) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reducedMotion && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
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
              avatarSequence: [{ action: "play", animation: "celebrate" }],
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
      await vi.runAllTimersAsync();
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
          avatarSequence: [{ action: "play", animation: "celebrate" }],
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

    expect(run).not.toHaveBeenCalled();
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
});
