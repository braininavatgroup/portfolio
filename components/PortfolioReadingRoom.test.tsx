// @vitest-environment jsdom

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_READING_ROOM_LAYOUT,
  parseReadingRoomLayout,
  serializeReadingRoomLayout,
} from "../lib/reading-room-layout";
import { portfolioWorldNodeById } from "../lib/portfolio-world";
import { PortfolioChat } from "./PortfolioChat";
import { PortfolioReadingRoom } from "./PortfolioReadingRoom";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

let desktop = true;
const mediaListeners = new Set<() => void>();

function installMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return query === "(min-width: 1020px)" ? desktop : false;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => mediaListeners.delete(listener),
    dispatchEvent: vi.fn(),
  }));
}

function setDesktop(value: boolean) {
  desktop = value;
  act(() => {
    for (const listener of mediaListeners) listener();
  });
}

function MapProbe({
  compact,
  nodesInTabOrder,
}: {
  compact?: boolean;
  nodesInTabOrder?: boolean;
}) {
  return (
    <section
      data-compact={compact ? "true" : "false"}
      data-tab-order={nodesInTabOrder ? "true" : "false"}
      data-view="map"
    >
      Map body
    </section>
  );
}

function StatefulGuideProbe() {
  const [turns, setTurns] = useState(1);
  return (
    <button
      data-testid="stateful-guide"
      onClick={() => setTurns((current) => current + 1)}
      type="button"
    >
      Guide turns: {turns}
    </button>
  );
}

const dubs = portfolioWorldNodeById.get("dubs")!;

function roomProps(storage = new MemoryStorage()) {
  return {
    activeThreadId: null,
    guide: <section data-view="guide">Guide body</section>,
    guideHasThread: false,
    map: <MapProbe />,
    onGuideReset: vi.fn(),
    onHome: vi.fn(),
    onSelect: vi.fn(),
    onSelectThread: vi.fn(),
    reader: <section data-view="reader">Reader body</section>,
    selectedId: null,
    selectedSubject: null,
    storage,
  };
}

function slot(container: HTMLElement, name: "main" | "top" | "bottom") {
  return container.querySelector<HTMLElement>(
    `[data-reading-room-slot="${name}"]`,
  )!;
}

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440, writable: true });
  desktop = true;
  mediaListeners.clear();
  installMatchMedia();
});

afterEach(() => {
  cleanup();
  mediaListeners.clear();
  vi.restoreAllMocks();
});

describe("PortfolioReadingRoom desktop", () => {
  it("hides the avatar action while Guide is minimized and restores its state on reopen", () => {
    const onToggleAvatar = vi.fn();
    render(<PortfolioReadingRoom {...roomProps()} avatarHidden onToggleAvatar={onToggleAvatar} />);
    expect(screen.getByRole("button", { name: "Show avatar" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide lower view" }));
    expect(screen.queryByRole("button", { name: "Show avatar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hide avatar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show lower view" }));
    expect(screen.getByRole("button", { name: "Show avatar" }).getAttribute("aria-pressed")).toBe("false");
    expect(onToggleAvatar).not.toHaveBeenCalled();
  });

  it("keeps the avatar toggle in the Guide bar before a conversation starts", () => {
    const onToggleAvatar = vi.fn();
    const props = { ...roomProps(), onToggleAvatar, avatarHidden: false };
    const { container, rerender } = render(<PortfolioReadingRoom {...props} />);
    const toggle = screen.getByRole("button", { name: "Hide avatar" });
    expect(toggle.closest(".portfolio-reading-room-view-controls")).not.toBeNull();
    expect(toggle.closest('[data-view="guide"]')).not.toBeNull();
    expect(toggle.closest(".portfolio-reading-room-pane-body")).toBeNull();
    fireEvent.click(toggle);
    expect(onToggleAvatar).toHaveBeenCalledOnce();
    rerender(<PortfolioReadingRoom {...props} avatarHidden />);
    expect(screen.getByRole("button", { name: "Show avatar" }).getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelectorAll('[data-control="avatarHidden"]')).toHaveLength(1);
    rerender(<PortfolioReadingRoom {...props} guideHasThread />);
    const guideControls = container.querySelector('[data-view="guide"] > .portfolio-reading-room-view-controls');
    expect(Array.from(guideControls!.querySelectorAll('button')).map(button => button.dataset.control))
      .toEqual(["newChat", "avatarShown", "panelBottom"]);
  });

  it("places one Reader, Map, and Guide in the default desktop slots", () => {
    const { container } = render(<PortfolioReadingRoom {...roomProps()} />);

    expect(slot(container, "main").querySelector('[data-view="reader"]')).not.toBeNull();
    expect(slot(container, "top").querySelector('[data-view="map"]')).not.toBeNull();
    expect(slot(container, "bottom").querySelector('[data-view="guide"]')).not.toBeNull();
    expect(container.querySelectorAll('.portfolio-reading-room-pane-body [data-view="reader"]')).toHaveLength(1);
    expect(container.querySelectorAll('.portfolio-reading-room-pane-body [data-view="map"]')).toHaveLength(1);
    expect(container.querySelectorAll('.portfolio-reading-room-pane-body [data-view="guide"]')).toHaveLength(1);
    expect(slot(container, "top").querySelector('[data-compact="true"]')).not.toBeNull();
    expect(slot(container, "top").querySelector('[data-tab-order="false"]')).not.toBeNull();
    expect(screen.getByRole("navigation", { name: "Portfolio contents" })).toBeTruthy();
    expect(slot(container, "main").querySelector('.portfolio-reading-room-view-mark [data-family="identity"]')).not.toBeNull();
    expect(slot(container, "top").querySelector('[data-control-glyph="map"]')).not.toBeNull();
    expect(slot(container, "bottom").querySelector('[data-control-glyph="chat"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Hide side panes" }).closest("[data-testid^=reading-room-bar]")).toBeNull();
  });

  it("restores all three v4 panel groups and the independently stored slot state", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "reading-room-slots",
      serializeReadingRoomLayout({
        ...DEFAULT_READING_ROOM_LAYOUT,
        slots: { main: "guide", top: "reader", bottom: "map" },
      }),
    );
    storage.setItem(
      "react-resizable-panels:reading-room-outer",
      JSON.stringify({ "contents,workspace": { layout: [24, 76] } }),
    );
    storage.setItem(
      "react-resizable-panels:reading-room-primary",
      JSON.stringify({ "main,right": { layout: [64, 36] } }),
    );
    storage.setItem(
      "react-resizable-panels:reading-room-right",
      JSON.stringify({ "top,bottom": { layout: [45, 55] } }),
    );

    const { container } = render(<PortfolioReadingRoom {...roomProps(storage)} />);

    expect(slot(container, "main").querySelector('[data-view="guide"]')).not.toBeNull();
    expect(slot(container, "top").querySelector('[data-view="reader"]')).not.toBeNull();
    expect(slot(container, "bottom").querySelector('[data-view="map"]')).not.toBeNull();
    expect(container.querySelector('#contents')?.getAttribute("style")).toContain("flex: 24 1 0px");
    expect(container.querySelector('#main')?.getAttribute("style")).toContain("flex: 64 1 0px");
    expect(container.querySelector('#top')?.getAttribute("style")).toContain("flex: 45 1 0px");
  });

  it("pins the authoritative desktop defaults, minimums, splits, and collapsed bars", async () => {
    const source = await readFile(resolve(process.cwd(), "components/PortfolioReadingRoom.tsx"), "utf8");

    expect(source).toContain('defaultSize={initialSizes.contents}');
    expect(source).toContain('groupResizeBehavior="preserve-pixel-size"');
    expect(source).toContain('id="contents"\n            minSize={minimums.contents}');
    expect(source).toContain('<Panel id="workspace" minSize={minimums.workspace}>');
    expect(source).toContain("const minimums = readingRoomMinimums();");
    expect(source).toContain('defaultSize={initialSizes.main}');
    expect(source).toContain('id="main" minSize={minimums.main}');
    expect(source).toContain('id="right"\n                minSize={minimums.right}');
    expect(source).toContain("const SIDE_SLOT_MIN_HEIGHT = 240;");
    expect(source).toContain('<Panel defaultSize="40%" id="top" minSize={SIDE_SLOT_MIN_HEIGHT}>');
    expect(source).toContain('defaultSize="60%"\n                    id="bottom"\n                    minSize={SIDE_SLOT_MIN_HEIGHT}');
    expect(source).toContain('collapsedSize={40}');
    expect(DEFAULT_READING_ROOM_LAYOUT.side).toBe(320 / 1440);
    expect(DEFAULT_READING_ROOM_LAYOUT.split).toBe(680 / 1120);
    expect(DEFAULT_READING_ROOM_LAYOUT.vsplit).toBe(0.4);
  });

  it("renders every view inside its default slot in server HTML", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(<PortfolioReadingRoom {...roomProps()} />);

    expect(slot(host, "main").querySelector('.portfolio-reading-room-pane-body > [data-reading-room-view="reader"] > [data-view="reader"]')).not.toBeNull();
    expect(slot(host, "top").querySelector('.portfolio-reading-room-pane-body > [data-reading-room-view="map"] > [data-view="map"]')).not.toBeNull();
    expect(slot(host, "bottom").querySelector('.portfolio-reading-room-pane-body > [data-reading-room-view="guide"] > [data-view="guide"]')).not.toBeNull();
  });

  it("hydrates the default server composition before restoring client persistence", async () => {
    const serverStorage = new MemoryStorage();
    const clientStorage = new MemoryStorage();
    clientStorage.setItem(
      "reading-room-slots",
      serializeReadingRoomLayout({
        ...DEFAULT_READING_ROOM_LAYOUT,
        slots: { main: "guide", top: "reader", bottom: "map" },
      }),
    );
    clientStorage.setItem(
      "react-resizable-panels:reading-room-primary",
      JSON.stringify({ "main,right": { layout: [64, 36] } }),
    );
    const host = document.createElement("div");
    host.innerHTML = renderToString(
      <PortfolioReadingRoom {...roomProps(serverStorage)} />,
    );
    document.body.appendChild(host);
    const hydrationErrors: string[] = [];
    const root = hydrateRoot(
      host,
      <PortfolioReadingRoom {...roomProps(clientStorage)} />,
      {
        onRecoverableError: (error) => hydrationErrors.push(String(error)),
      },
    );
    await waitFor(() => {
      expect(slot(host, "main").dataset.view).toBe("guide");
      expect(host.querySelector('#main')?.getAttribute("style")).toContain("flex: 64 1 0px");
    });
    expect(slot(host, "main").querySelector('[data-view="guide"]')).not.toBeNull();
    expect(slot(host, "top").querySelector('[data-view="reader"]')).not.toBeNull();
    expect(slot(host, "bottom").querySelector('[data-view="map"]')).not.toBeNull();
    expect(host.querySelectorAll(".portfolio-reading-room-pane-body > *")).toHaveLength(3);

    expect(hydrationErrors.join("\n")).not.toMatch(/hydration|did not match|server rendered/i);
    await act(async () => root.unmount());
    host.remove();
  });

  it("hydrates a cold mobile load without an assistant-ui empty-thread failure", async () => {
    const storage = new MemoryStorage();
    const props = roomProps(storage);
    const guide = <PortfolioChat askPortfolio={async () => {}} resetSignal={0} />;
    desktop = true;
    const host = document.createElement("div");
    host.innerHTML = renderToString(
      <PortfolioReadingRoom {...props} guide={guide} />,
    );
    document.body.appendChild(host);
    desktop = false;
    const hydrationErrors: string[] = [];
    const root = hydrateRoot(
      host,
      <PortfolioReadingRoom {...props} guide={guide} />,
      { onRecoverableError: (error) => hydrationErrors.push(String(error)) },
    );

    await waitFor(() => {
      expect(host.querySelector(".portfolio-reading-room-mobile")).not.toBeNull();
      expect(within(host).getByRole("region", { name: "Portfolio Guide", hidden: true })).toBeTruthy();
    });
    expect(hydrationErrors.join("\n")).not.toMatch(/empty thread|hydration|did not match/i);

    await act(async () => root.unmount());
    host.remove();
  });

  it("restores a persisted Guide slot without calling an empty assistant-ui thread", async () => {
    const serverStorage = new MemoryStorage();
    const clientStorage = new MemoryStorage();
    clientStorage.setItem(
      "reading-room-slots",
      serializeReadingRoomLayout({
        ...DEFAULT_READING_ROOM_LAYOUT,
        slots: { main: "guide", top: "reader", bottom: "map" },
      }),
    );
    const guide = <PortfolioChat askPortfolio={async () => {}} resetSignal={0} />;
    const host = document.createElement("div");
    host.innerHTML = renderToString(
      <PortfolioReadingRoom {...roomProps(serverStorage)} guide={guide} />,
    );
    document.body.appendChild(host);
    const hydrationErrors: string[] = [];
    const root = hydrateRoot(
      host,
      <PortfolioReadingRoom {...roomProps(clientStorage)} guide={guide} />,
      { onRecoverableError: (error) => hydrationErrors.push(String(error)) },
    );

    await waitFor(() => {
      expect(slot(host, "main").dataset.view).toBe("guide");
      expect(within(slot(host, "main")).getByRole("region", { name: "Portfolio Guide" })).toBeTruthy();
    });
    expect(hydrationErrors.join("\n")).not.toMatch(/empty thread|hydration|did not match/i);

    await act(async () => root.unmount());
    host.remove();
  });

  it("binds every whole bar and slot to dnd-kit without inventing a drag ghost", async () => {
    const source = await readFile(resolve(process.cwd(), "components/PortfolioReadingRoom.tsx"), "utf8");
    const { container } = render(<PortfolioReadingRoom {...roomProps()} />);

    expect(source).toContain("useDraggable({");
    expect(source.match(/data-testid={`reading-room-bar-\$\{slot\}`}[^>]*ref=\{ref\}/gs)).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid^="reading-room-bar-"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid^="reading-room-bar-"] button')).toHaveLength(0);
    expect(source).toContain("useDroppable({");
    expect(source).toContain("data-reading-room-slot={barProps.slot}");
    expect(source).toMatch(/<DragDropProvider\s+onDragEnd=\{onDragEnd\}\s+onDragStart=\{onDragStart\}\s+plugins=\{READING_ROOM_DND_PLUGINS\}\s*>/);
    expect(source).not.toContain("DragOverlay");
    expect(source).toContain('Feedback.configure({ dropAnimation: null, feedback: "clone" })');
    expect(source).toContain("defaultPreset.plugins.filter((plugin) => plugin !== Feedback)");
    expect(source).toContain("portfolio-reading-room-drop-target");
    expect(source).toContain("swapReadingRoomSlots(current, sourceSlot, targetSlot)");
  });

  it("collapses and reopens Contents, both right views, and the lower 40px bar", () => {
    const storage = new MemoryStorage();
    const { container } = render(<PortfolioReadingRoom {...roomProps(storage)} />);

    fireEvent.click(screen.getByRole("button", { name: "Hide Contents" }));
    expect(container.querySelector(".portfolio-reading-room-main-mast")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show Contents" }));
    expect(screen.getByRole("navigation", { name: "Portfolio contents" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hide side panes" }));
    expect(container.querySelector('#right')?.getAttribute("data-collapsed")).toBe("true");
    expect(parseReadingRoomLayout(storage.getItem("reading-room-slots")).hidden).toEqual([
      "map",
      "guide",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Show side panes" }));
    expect(slot(container, "top").querySelector('[data-view="map"]')).not.toBeNull();
    expect(slot(container, "bottom").querySelector('[data-view="guide"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Hide lower view" }));
    expect(slot(container, "bottom").getAttribute("data-collapsed")).toBe("true");
    expect(slot(container, "bottom").querySelector('[data-view="guide"]')).not.toBeNull();
    expect(slot(container, "bottom").querySelector(".portfolio-reading-room-pane-body")?.hasAttribute("hidden")).toBe(true);
    expect(slot(container, "bottom").getAttribute("style")).toContain("40px");
    fireEvent.click(screen.getByRole("button", { name: "Show lower view" }));
    expect(slot(container, "bottom").querySelector('[data-view="guide"]')).not.toBeNull();

    expect(storage.getItem("reading-room-slots")).toContain('"hidden"');
  });

  it("reports every collapse and reopen through onLayoutChange", () => {
    const onLayoutChange = vi.fn();
    render(<PortfolioReadingRoom {...roomProps()} onLayoutChange={onLayoutChange} />);
    onLayoutChange.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Hide side panes" }));
    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Show side panes" }));
    expect(onLayoutChange).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Hide Contents" }));
    expect(onLayoutChange).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole("button", { name: "Show Contents" }));
    expect(onLayoutChange).toHaveBeenCalledTimes(4);
  });

  it("keeps the Guide mounted while its side panes are hidden", () => {
    const { container } = render(
      <PortfolioReadingRoom
        {...roomProps()}
        guide={<StatefulGuideProbe />}
      />,
    );

    fireEvent.click(screen.getByTestId("stateful-guide"));
    expect(screen.getByTestId("stateful-guide").textContent).toBe("Guide turns: 2");

    fireEvent.click(screen.getByRole("button", { name: "Hide side panes" }));
    expect(screen.getByTestId("stateful-guide").closest("[hidden]")).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="stateful-guide"]')).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Show side panes" }));
    expect(screen.getByRole("button", { name: "Guide turns: 2" })).toBeTruthy();
  });

  it("reveals a requested view by reopening the side column or the lower slot", () => {
    const onLayoutChange = vi.fn();
    const props = roomProps();
    const { container, rerender } = render(
      <PortfolioReadingRoom {...props} onLayoutChange={onLayoutChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide side panes" }));
    expect(slot(container, "top").querySelector(".portfolio-reading-room-pane-body")?.hasAttribute("hidden")).toBe(true);
    onLayoutChange.mockClear();

    rerender(
      <PortfolioReadingRoom
        {...props}
        onLayoutChange={onLayoutChange}
        viewRequest={{ key: 1, view: "map" }}
      />,
    );
    expect(container.querySelector('[data-reading-room-slot][data-view="map"] .portfolio-reading-room-pane-body')?.hasAttribute("hidden")).toBe(false);
    expect(screen.getByRole("button", { name: "Hide side panes" })).toBeTruthy();
    expect(onLayoutChange).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Hide lower view" }));
    expect(slot(container, "bottom").getAttribute("data-collapsed")).toBe("true");
    rerender(
      <PortfolioReadingRoom
        {...props}
        onLayoutChange={onLayoutChange}
        viewRequest={{ key: 2, view: "guide" }}
      />,
    );
    expect(slot(container, "bottom").getAttribute("data-collapsed")).toBe("false");
    expect(screen.getByRole("button", { name: "Hide lower view" })).toBeTruthy();

    // A stale request must not reopen what the visitor closes afterwards.
    fireEvent.click(screen.getByRole("button", { name: "Hide lower view" }));
    expect(slot(container, "bottom").getAttribute("data-collapsed")).toBe("true");
    rerender(
      <PortfolioReadingRoom
        {...props}
        onLayoutChange={onLayoutChange}
        viewRequest={{ key: 3, view: "reader" }}
      />,
    );
    expect(slot(container, "bottom").getAttribute("data-collapsed")).toBe("true");
  });

  it("collapses side panels on release only after a sash crosses 48px past its minimum", async () => {
    const { container } = render(<PortfolioReadingRoom {...roomProps()} />);
    const outer = screen.getByTestId("reading-room-outer");
    const primary = container.querySelector<HTMLElement>("#reading-room-primary")!;
    vi.spyOn(outer, "getBoundingClientRect").mockReturnValue({
      bottom: 640,
      height: 640,
      left: 0,
      right: 1440,
      top: 0,
      width: 1440,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(primary, "getBoundingClientRect").mockReturnValue({
      bottom: 640,
      height: 640,
      left: 320,
      right: 1440,
      top: 0,
      width: 1120,
      x: 320,
      y: 0,
      toJSON: () => ({}),
    });

    const contentsSash = screen.getByRole("separator", { name: "Resize Contents" });
    fireEvent.pointerDown(contentsSash, { clientX: 180, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 133, pointerId: 1 });
    expect(container.querySelector(".portfolio-reading-room-main-mast")).toBeNull();
    fireEvent.pointerMove(window, { clientX: 132, pointerId: 1 });
    expect(container.querySelector(".portfolio-reading-room-main-mast")).toBeNull();
    fireEvent.pointerUp(window, { pointerId: 1 });
    await waitFor(() => {
      expect(container.querySelector(".portfolio-reading-room-main-mast")).not.toBeNull();
    });

    const rightSash = screen.getByRole("separator", { name: "Resize side panes" });
    fireEvent.pointerDown(rightSash, { clientX: 1200, pointerId: 2 });
    fireEvent.pointerMove(window, { clientX: 1247, pointerId: 2 });
    expect(container.querySelector<HTMLElement>("#right")?.dataset.collapsed).toBe("false");
    fireEvent.pointerMove(window, { clientX: 1248, pointerId: 2 });
    expect(container.querySelector<HTMLElement>("#right")?.dataset.collapsed).toBe("false");
    fireEvent.pointerUp(window, { pointerId: 2 });
    await waitFor(() => {
      expect(container.querySelector<HTMLElement>("#right")?.dataset.collapsed).toBe("true");
    });
  });

  it("substitutes the Bradley mast for the main view mark while Contents is hidden", () => {
    const onHome = vi.fn();
    const { container } = render(
      <PortfolioReadingRoom {...roomProps()} onHome={onHome} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide Contents" }));
    const mast = container.querySelector(".portfolio-reading-room-main-mast")!;

    expect(within(mast as HTMLElement).getByText("Bradley Berkman")).toBeTruthy();
    expect(mast.querySelector('[data-family="identity"]')).not.toBeNull();
    expect(slot(container, "main").querySelector(".portfolio-reading-room-view-bar")?.getAttribute("data-mast")).toBe("true");
    expect(slot(container, "main").querySelector(".portfolio-reading-room-view-mark")).not.toBeNull();
    fireEvent.click(within(mast as HTMLElement).getByRole("button", { name: "Return to About" }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("gives an existing Guide thread Escape and new-chat priority over About", () => {
    const onEscapeBeforeRoom = vi.fn(() => false);
    const onGuideReset = vi.fn();
    const onHome = vi.fn();
    const props = roomProps();
    const { rerender } = render(
      <PortfolioReadingRoom
        {...props}
        guideHasThread
        onEscapeBeforeRoom={onEscapeBeforeRoom}
        onGuideReset={onGuideReset}
        onHome={onHome}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onGuideReset).toHaveBeenCalledTimes(1);
    expect(onHome).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Start a new Guide conversation" }));
    expect(onGuideReset).toHaveBeenCalledTimes(2);

    rerender(
      <PortfolioReadingRoom
        {...props}
        guideHasThread={false}
        onEscapeBeforeRoom={onEscapeBeforeRoom}
        onGuideReset={onGuideReset}
        onHome={onHome}
      />,
    );
    expect(screen.queryByRole("button", { name: "Start a new Guide conversation" })).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onHome).toHaveBeenCalledTimes(1);

    onEscapeBeforeRoom.mockReturnValue(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onGuideReset).toHaveBeenCalledTimes(2);
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("leaves Escape to a fullscreen video instead of returning the Reader home", () => {
    const onHome = vi.fn();
    const fullscreenVideo = document.createElement("video");
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: fullscreenVideo,
    });
    render(<PortfolioReadingRoom {...roomProps()} onHome={onHome} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onHome).not.toHaveBeenCalled();
    Reflect.deleteProperty(document, "fullscreenElement");
  });
});

describe("PortfolioReadingRoom mobile", () => {
  beforeEach(() => {
    desktop = false;
  });

  it("switches at 1020px and renders the fixed top mast and three bottom tabs", () => {
    const { container } = render(<PortfolioReadingRoom {...roomProps()} />);

    expect(container.querySelector(".portfolio-reading-room-mobile")?.getAttribute("data-breakpoint")).toBe(
      "below-1020",
    );
    expect(container.querySelector(".portfolio-reading-room-mobile-top")?.getAttribute("data-height")).toBe(
      "44",
    );
    expect(container.querySelector(".portfolio-reading-room-mobile-tabs")?.getAttribute("data-height")).toBe(
      "56",
    );
    const contentsTab = screen.getByRole("button", { name: "Contents tab" });
    const readerTab = screen.getByRole("button", { name: "Reader tab" });
    const mapTab = screen.getByRole("button", { name: "Map tab" });
    expect(contentsTab.querySelector('[data-control-glyph="mobileSidebar"]')).not.toBeNull();
    expect(readerTab.getAttribute("aria-pressed")).toBe("true");
    expect(readerTab.querySelector('[data-family="identity"]')).not.toBeNull();
    expect(mapTab.querySelector('[data-control-glyph="map"]')).not.toBeNull();

    setDesktop(true);
    expect(container.querySelector(".portfolio-reading-room-desktop")?.getAttribute("data-breakpoint")).toBe(
      "1020-and-up",
    );
  });

  it("moves from Contents to Reader after a selection", () => {
    const onSelect = vi.fn();
    render(<PortfolioReadingRoom {...roomProps()} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Contents tab" }));
    const contents = screen.getByRole("navigation", { name: "Portfolio contents" });
    fireEvent.click(within(contents).getByRole("button", { name: "Dubs" }));

    expect(onSelect).toHaveBeenCalledWith(dubs);
    expect(screen.getByRole("button", { name: "Reader tab" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Reader body")).toBeTruthy();
  });

  it("keeps Map at 52 percent over Guide at 48 percent and shows the selected Read chip", () => {
    const onToggleAvatar = vi.fn();
    const { container } = render(
      <PortfolioReadingRoom
        {...roomProps()}
        selectedId={dubs.id}
        selectedSubject={dubs}
        onToggleAvatar={onToggleAvatar}
        avatarHidden={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Map tab" }));

    expect(container.querySelector(".portfolio-reading-room-mobile-map")?.getAttribute("data-size")).toBe(
      "52",
    );
    expect(container.querySelector(".portfolio-reading-room-mobile-guide")?.getAttribute("data-size")).toBe(
      "48",
    );
    expect(container.querySelector('[data-view="map"]')?.getAttribute("data-compact")).toBe("true");
    expect(container.querySelector('[data-view="map"]')?.getAttribute("data-tab-order")).toBe("false");
    expect(container.querySelector(".portfolio-reading-room-mobile-avatar")).not.toBeNull();
    const readChip = screen.getByRole("button", { name: "Read Dubs" });
    expect(readChip).toBeTruthy();
    const toolbar = readChip.closest(".portfolio-reading-room-map-controls")!;
    fireEvent.click(within(toolbar as HTMLElement).getByRole("button", { name: "Hide avatar" }));
    expect(onToggleAvatar).toHaveBeenCalledOnce();
    expect(readChip.querySelector(`[data-family="${dubs.family}"]`)).not.toBeNull();
    expect(within(readChip).getByText("Dubs")).toBeTruthy();
    expect(within(readChip).queryByText("Read")).toBeNull();
    expect(readChip.querySelector('[data-control-glyph="readArrow"]')).toBeNull();
    expect(container.querySelector(".portfolio-reading-room-mobile-map .portfolio-reading-room-mobile-avatar")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Read Dubs" }));
    expect(screen.getByRole("button", { name: "Reader tab" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps a Guide citation on Map while controlled selection updates the chip", () => {
    function CitationHarness() {
      const [selected, setSelected] = useState<typeof dubs | null>(null);
      const props = roomProps();
      return (
        <PortfolioReadingRoom
          {...props}
          guide={(
            <section data-view="guide">
              <button onClick={() => setSelected(dubs)} type="button">Cite Dubs</button>
            </section>
          )}
          selectedId={selected?.id ?? null}
          selectedSubject={selected}
        />
      );
    }

    render(<CitationHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Map tab" }));
    fireEvent.click(screen.getByRole("button", { name: "Cite Dubs" }));

    expect(screen.getByRole("button", { name: "Map tab" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Read Dubs" })).toBeTruthy();
  });

  it("does not let mobile tab state overwrite persisted desktop slots", () => {
    const storage = new MemoryStorage();
    const stored = serializeReadingRoomLayout({
      ...DEFAULT_READING_ROOM_LAYOUT,
      slots: { main: "map", top: "guide", bottom: "reader" },
    });
    storage.setItem("reading-room-slots", stored);
    const { container } = render(<PortfolioReadingRoom {...roomProps(storage)} />);

    fireEvent.click(screen.getByRole("button", { name: "Contents tab" }));
    fireEvent.click(screen.getByRole("button", { name: "Map tab" }));
    expect(storage.getItem("reading-room-slots")).toBe(stored);

    setDesktop(true);
    expect(slot(container, "main").querySelector('[data-view="map"]')).not.toBeNull();
    expect(slot(container, "top").querySelector('[data-view="guide"]')).not.toBeNull();
    expect(slot(container, "bottom").querySelector('[data-view="reader"]')).not.toBeNull();
  });

  it("switches to the tab that hosts a requested view", () => {
    const props = roomProps();
    const { rerender } = render(<PortfolioReadingRoom {...props} />);

    rerender(<PortfolioReadingRoom {...props} viewRequest={{ key: 1, view: "guide" }} />);
    expect(screen.getByRole("button", { name: "Map tab" }).getAttribute("aria-pressed")).toBe("true");
    rerender(<PortfolioReadingRoom {...props} viewRequest={{ key: 2, view: "reader" }} />);
    expect(screen.getByRole("button", { name: "Reader tab" }).getAttribute("aria-pressed")).toBe("true");
    rerender(<PortfolioReadingRoom {...props} viewRequest={{ key: 3, view: "map" }} />);
    expect(screen.getByRole("button", { name: "Map tab" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the docked Guide mounted when another mobile tab is active", () => {
    const { container } = render(
      <PortfolioReadingRoom
        {...roomProps()}
        guide={<StatefulGuideProbe />}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Map tab" }));
    fireEvent.click(screen.getByRole("button", { name: "Guide turns: 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Reader tab" }));

    expect(screen.getByTestId("stateful-guide").closest("[hidden]")).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="stateful-guide"]')).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Map tab" }));
    expect(screen.getByRole("button", { name: "Guide turns: 2" })).toBeTruthy();
  });

  it("places mobile new-chat beside the composer rather than inside a draggable bar", () => {
    const onGuideReset = vi.fn();
    render(
      <PortfolioReadingRoom
        {...roomProps()}
        guideHasThread
        onGuideReset={onGuideReset}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Map tab" }));
    const reset = screen.getByRole("button", { name: "Start a new Guide conversation" });
    expect(reset.classList.contains("portfolio-reading-room-mobile-new-chat")).toBe(true);
    fireEvent.click(reset);
    expect(onGuideReset).toHaveBeenCalledTimes(1);
  });
});

describe("Reading Room stylesheet", () => {
  it("pins the exact bars, mobile split, avatar placeholder, surfaces, sashes, and overflow", async () => {
    const stylesheet = await readFile(resolve(process.cwd(), "app/globals.css"), "utf8");

    const room = stylesheet.match(/\.portfolio-reading-room\s*\{([^}]*)\}/)?.[1] ?? "";
    const bar = stylesheet.match(/^\.portfolio-reading-room-view-bar\s*\{([^}]*)\}/m)?.[1] ?? "";
    const top = stylesheet.match(/\.portfolio-reading-room-mobile-top\s*\{([^}]*)\}/)?.[1] ?? "";
    const tabs = stylesheet.match(/\.portfolio-reading-room-mobile-tabs\s*\{([^}]*)\}/)?.[1] ?? "";
    const mobilePages = stylesheet.match(/\.portfolio-reading-room-mobile-map-page\s*\{([^}]*)\}/)?.[1] ?? "";
    const avatar = stylesheet.match(/\.portfolio-reading-room-mobile-avatar\s*\{([^}]*)\}/)?.[1] ?? "";
    const separator = stylesheet.match(/\.portfolio-reading-room-separator\s*\{([^}]*)\}/)?.[1] ?? "";
    const separatorVertical = stylesheet.match(/\.portfolio-reading-room-separator\[aria-orientation="vertical"\]::after\s*\{([^}]*)\}/)?.[1] ?? "";
    const chip = stylesheet.match(/\.portfolio-reading-room-read-chip\s*\{([^}]*)\}/)?.[1] ?? "";
    const dropTarget = stylesheet.match(/\.portfolio-reading-room-drop-target\s*\{([^}]*)\}/)?.[1] ?? "";
    const mainSlotSurface = stylesheet.match(/\.portfolio-reading-room-pane\[data-reading-room-slot="main"\],\s*\.portfolio-reading-room-pane\[data-reading-room-slot="main"\] > \.portfolio-reading-room-view-bar\s*\{([^}]*)\}/)?.[1] ?? "";
    const viewSurfaces = stylesheet.match(/\.portfolio-reading-room-pane-body \.portfolio-reader,\s*\.portfolio-reading-room-pane-body \.portfolio-world,\s*\.portfolio-reading-room-pane-body \.portfolio-chat\s*\{([^}]*)\}/)?.[1] ?? "";
    const mastText = stylesheet.match(/\.portfolio-reading-room-home > span,\s*\.portfolio-reading-room-mobile-home > span\s*\{([^}]*)\}/)?.[1] ?? "";
    const contentsMastText = stylesheet.match(/\.portfolio-contents-home > span\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(room).toContain("overflow: hidden");
    expect(room).toContain("width: 100%");
    expect(bar).toContain("flex: 0 0 40px");
    expect(bar).toContain("height: 40px");
    expect(top).toContain("height: 44px");
    expect(tabs).toContain("height: 56px");
    const contentsRow = stylesheet.match(/\.portfolio-contents-row,\s*\.reader-index-row\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(contentsRow).toContain("min-height: 28px");
    expect(contentsRow).not.toMatch(/\n\s*height: 28px/);
    expect(tabs).toContain("env(safe-area-inset-bottom, 0px)");
    expect(stylesheet).toMatch(/\.portfolio-reading-room-mobile\s*\{[^}]*height:\s*100dvh/);
    expect(stylesheet).toMatch(/body:has\(\.portfolio-reading-room-mobile\)\s*\{[^}]*overflow:\s*hidden/);
    expect(stylesheet).toMatch(/\.portfolio-reading-room-mobile-map-page:has\(\.portfolio-chat-composer textarea:focus\)\s*\{[^}]*grid-template-rows:\s*0 minmax\(0, 1fr\)/);
    expect(mobilePages).toContain("grid-template-rows: 52% 48%");
    expect(avatar).toContain("height: 96px");
    expect(avatar).toContain("width: 96px");
    expect(avatar).toContain("bottom: 12px");
    expect(avatar).toContain("right: 16px");
    expect(chip).toContain("border-radius: 6px");
    expect(chip).not.toContain("position: absolute");
    expect(chip).toContain("height: 40px");
    expect(chip).toContain("padding: 0 var(--reader-space-1)");
    expect(stylesheet).toMatch(/\.portfolio-reading-room-map-canvas\s*\{[^}]*min-height: 0/);
    expect(mainSlotSurface).toContain("background: var(--map-paper-near)");
    expect(viewSurfaces).toContain("background: transparent");
    expect(stylesheet).not.toMatch(/\.portfolio-reading-room-pane\[data-view=/);
    expect(mastText).toContain("white-space: nowrap");
    expect(contentsMastText).toContain("white-space: nowrap");
    expect(separator).toContain("background: var(--map-line)");
    expect(separatorVertical).toContain("width: 3px");
    expect(stylesheet).toMatch(
      /\.portfolio-reading-room-separator\[data-separator="active"\]::after\s*\{[^}]*background:\s*var\(--ink\)/,
    );
    expect(dropTarget).toContain("background: var(--reader-drop-fill)");
    expect(dropTarget).toContain("border: 1px solid var(--ink)");
    expect(dropTarget).not.toContain("font:");
    expect(stylesheet).not.toContain(".portfolio-reading-room-drag-overlay");
    expect(stylesheet).toMatch(/\.portfolio-reading-room-view-bar\s*\{[^}]*cursor:\s*grab/);
    expect(stylesheet).toMatch(/\.portfolio-reading-room-view-bar\[data-dragging="true"\]\s*\{[^}]*cursor:\s*grabbing/);
    expect(stylesheet).toMatch(/\.portfolio-reading-room-view-bar\[data-dnd-dragging\]\s*\{[^}]*visibility:\s*hidden/);
    expect(stylesheet).toMatch(/\.portfolio-reading-room-view-bar\[data-dnd-placeholder\][^{]*\{[^}]*background/);
    expect(stylesheet).toContain("--reader-drop-fill-light: rgb(32 23 17 / 8%)");
    expect(stylesheet).toContain("--reader-drop-fill-dark: rgb(240 230 220 / 10%)");
    expect(stylesheet).toMatch(/\.portfolio-reading-room-desktop\s*\{[^}]*min-width:\s*1020px/);
    expect(stylesheet).toMatch(/body:has\(\.portfolio-reading-room-desktop\)\s*\{[^}]*overflow:\s*hidden/);
    expect(stylesheet).not.toMatch(/overflow-x:\s*auto/);
    expect(stylesheet).toMatch(/\.portfolio-reading-room-mobile-view\s*\{[^}]*background:\s*var\(--map-paper-near\)/);
    expect(stylesheet).toMatch(/\.portfolio-reading-room-mobile-guide \.portfolio-chat-composer\s*\{[^}]*background:\s*var\(--map-paper\)/);
    expect(stylesheet).toMatch(/\.portfolio-reading-room-pane-body > \.portfolio-world > \.portfolio-world-mast[^}]*display:\s*none/);
    expect(stylesheet).toMatch(/\.portfolio-reading-room-mobile-tab\s*\{[^}]*gap:\s*4px/);
    expect(stylesheet).toMatch(/\.portfolio-reading-room-mobile-tabs\s*\{[^}]*justify-content:\s*space-around/);
    expect(stylesheet).toMatch(/\.portfolio-reading-room-global-controls\s*\{[^}]*right:\s*17px/);
    expect(stylesheet).toMatch(/\.portfolio-reading-room-pane\[data-reading-room-slot="top"\] \.portfolio-reading-room-view-controls,\s*\.portfolio-reading-room-desktop\[data-right-collapsed="true"\] \.portfolio-reading-room-pane\[data-reading-room-slot="main"\] \.portfolio-reading-room-view-controls\s*\{[^}]*right:\s*57px/);
    expect(stylesheet).toMatch(/\.portfolio-reading-room-mobile-guide \.portfolio-guide-send\s*\{[^}]*height:\s*32px/);
    expect(stylesheet).toMatch(/\.portfolio-contents-scroll,\s*\.reader-scroll,\s*\.portfolio-chat-thread\s*\{[^}]*scrollbar-width:\s*none/);
    expect(stylesheet).toMatch(/\.reader-scroll::-webkit-scrollbar[^{]*\{[^}]*display:\s*none/);
    expect(stylesheet).not.toContain(".portfolio-mobile-view-control");
    expect(stylesheet).not.toContain(".portfolio-mobile-map-open");
  });
});

it("temporarily promotes the Map for Brain Food and restores slots without writing preferences", async () => {
  const storage = new MemoryStorage();
  const saved = {...DEFAULT_READING_ROOM_LAYOUT, slots: {main: "guide", top: "reader", bottom: "map"}, hidden: ["map"]};
  storage.setItem("reading-room-slots", JSON.stringify(saved));
  const props = {...roomProps(storage), guide: <StatefulGuideProbe />};
  const {container, rerender} = render(<PortfolioReadingRoom {...props} />);
  await waitFor(() => expect(slot(container, "main").dataset.view).toBe("guide"));
  fireEvent.click(screen.getByTestId("stateful-guide"));
  const previousStorage = new Map(storage.values);
  rerender(<PortfolioReadingRoom {...props} gameMode />);
  expect(slot(container, "main").dataset.view).toBe("map");
  expect(slot(container, "main").querySelector('[data-compact="false"]')).not.toBeNull();
  expect(storage.values).toEqual(previousStorage);
  rerender(<PortfolioReadingRoom {...props} gameMode={false} />);
  expect(slot(container, "main").dataset.view).toBe("guide");
  expect(slot(container, "bottom").dataset.collapsed).toBe("true");
  expect(screen.getByTestId("stateful-guide").textContent).toContain("2");
  expect(storage.values).toEqual(previousStorage);
});

it("temporarily opens the mobile Map and restores the previous tab after Brain Food", () => {
  desktop = false;
  const props = roomProps();
  const {container, rerender} = render(<PortfolioReadingRoom {...props} />);
  fireEvent.click(screen.getByRole("button", {name: "Contents tab"}));
  rerender(<PortfolioReadingRoom {...props} gameMode />);
  expect(container.querySelector('[data-mobile-view="map"]')?.hasAttribute("hidden")).toBe(false);
  rerender(<PortfolioReadingRoom {...props} gameMode={false} />);
  expect(container.querySelector('[data-mobile-view="contents"]')?.hasAttribute("hidden")).toBe(false);
});
