// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseReadingRoomLayout } from "../lib/reading-room-layout";
import { portfolioWorldNodeById } from "../lib/portfolio-world";

type DndOperation = {
  source?: { id: string };
  target?: { id: string };
};

type DndProviderProps = {
  children: ReactNode;
  onDragEnd?: (event: { operation: DndOperation }) => void;
  onDragStart?: (event: { operation: DndOperation }) => void;
};

const dndHarness = vi.hoisted(() => ({
  draggableIds: [] as string[],
  dropTargetId: null as string | null,
  droppableIds: [] as string[],
  providerProps: null as DndProviderProps | null,
}));

vi.mock("@dnd-kit/react", () => ({
  DragDropProvider: (props: DndProviderProps) => {
    dndHarness.providerProps = props;
    return props.children;
  },
  DragOverlay: ({ children }: { children: ReactNode }) => children,
  useDraggable: ({ id }: { id: string }) => {
    dndHarness.draggableIds.push(id);
    return {
      isDragging: false,
      ref: () => {},
    };
  },
  useDroppable: ({ id }: { id: string }) => {
    dndHarness.droppableIds.push(id);
    return {
      isDropTarget: dndHarness.dropTargetId === id,
      ref: () => {},
    };
  },
}));

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

function MapProbe() {
  return <section>Map body</section>;
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

function StatefulMapProbe({ compact }: { compact?: boolean }) {
  const [visits, setVisits] = useState(1);
  return (
    <button
      data-compact={compact ? "true" : "false"}
      data-testid="stateful-map"
      onClick={() => setVisits((current) => current + 1)}
      type="button"
    >
      Map visits: {visits}
    </button>
  );
}

function swap(from: "main" | "top" | "bottom", to: "main" | "top" | "bottom") {
  const provider = dndHarness.providerProps!;
  act(() => provider.onDragStart?.({
    operation: { source: { id: `reading-room-drag-${from}` } },
  }));
  act(() => provider.onDragEnd?.({
    operation: {
      source: { id: `reading-room-drag-${from}` },
      target: { id: `reading-room-slot-${to}` },
    },
  }));
}

function slot(container: HTMLElement, name: "main" | "top" | "bottom") {
  return container.querySelector<HTMLElement>(`[data-reading-room-slot="${name}"]`)!;
}

function slotBody(container: HTMLElement, name: "main" | "top" | "bottom") {
  return slot(container, name).querySelector<HTMLElement>(".portfolio-reading-room-pane-body")!;
}

function roomProps(storage: MemoryStorage) {
  return {
    activeThreadId: null,
    guide: <section>Guide body</section>,
    guideHasThread: false,
    map: <MapProbe />,
    onGuideReset: vi.fn(),
    onHome: vi.fn(),
    onSelect: vi.fn(),
    onSelectThread: vi.fn(),
    reader: <section>Reader body</section>,
    selectedId: null,
    selectedSubject: portfolioWorldNodeById.get("dubs")!,
    storage,
  };
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  dndHarness.draggableIds = [];
  dndHarness.dropTargetId = null;
  dndHarness.droppableIds = [];
  dndHarness.providerProps = null;
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("PortfolioReadingRoom drag operation adapter", () => {
  it.each([
    ["main", "top", "map", "reader"],
    ["main", "bottom", "guide", "reader"],
    ["top", "bottom", "guide", "map"],
  ] as const)(
    "binds whole bars and persists a %s/%s swap",
    (from, to, expectedFrom, expectedTo) => {
      const storage = new MemoryStorage();
      dndHarness.dropTargetId = `reading-room-slot-${to}`;
      const { container } = render(<PortfolioReadingRoom {...roomProps(storage)} />);
      const provider = dndHarness.providerProps!;

      expect(new Set(dndHarness.draggableIds)).toEqual(new Set([
        "reading-room-drag-main",
        "reading-room-drag-top",
        "reading-room-drag-bottom",
      ]));
      expect(new Set(dndHarness.droppableIds)).toEqual(new Set([
        "reading-room-slot-main",
        "reading-room-slot-top",
        "reading-room-slot-bottom",
      ]));

      act(() => provider.onDragStart?.({
        operation: { source: { id: `reading-room-drag-${from}` } },
      }));
      expect(
        container.querySelector(`[data-reading-room-slot="${to}"] .portfolio-reading-room-drop-target`)?.textContent,
      ).toBe("");

      act(() => provider.onDragEnd?.({
        operation: {
          source: { id: `reading-room-drag-${from}` },
          target: { id: `reading-room-slot-${to}` },
        },
      }));

      expect(container.querySelector(`[data-reading-room-slot="${from}"]`)?.getAttribute("data-view")).toBe(expectedFrom);
      expect(container.querySelector(`[data-reading-room-slot="${to}"]`)?.getAttribute("data-view")).toBe(expectedTo);
      expect(parseReadingRoomLayout(storage.getItem("reading-room-slots")).slots[from]).toBe(expectedFrom);
      expect(parseReadingRoomLayout(storage.getItem("reading-room-slots")).slots[to]).toBe(expectedTo);
      expect(screen.queryByText(/^Move /)).toBeNull();
    },
  );

  it("keeps Guide and Map component state alive across slot swaps", () => {
    const { container } = render(
      <PortfolioReadingRoom
        {...roomProps(new MemoryStorage())}
        guide={<StatefulGuideProbe />}
        map={<StatefulMapProbe />}
      />,
    );

    fireEvent.click(screen.getByTestId("stateful-guide"));
    fireEvent.click(screen.getByTestId("stateful-guide"));
    fireEvent.click(screen.getByTestId("stateful-map"));
    expect(within(slotBody(container, "bottom")).getByText("Guide turns: 3")).toBeTruthy();
    expect(within(slotBody(container, "top")).getByText("Map visits: 2")).toBeTruthy();
    expect(screen.getByTestId("stateful-map").getAttribute("data-compact")).toBe("true");

    swap("main", "bottom");
    expect(within(slotBody(container, "main")).getByText("Guide turns: 3")).toBeTruthy();
    expect(within(slotBody(container, "bottom")).getByText("Reader body")).toBeTruthy();

    swap("top", "main");
    expect(within(slotBody(container, "main")).getByText("Map visits: 2")).toBeTruthy();
    expect(within(slotBody(container, "top")).getByText("Guide turns: 3")).toBeTruthy();
    expect(screen.getByTestId("stateful-map").getAttribute("data-compact")).toBe("false");

    fireEvent.click(screen.getByTestId("stateful-guide"));
    swap("top", "bottom");
    expect(within(slotBody(container, "bottom")).getByText("Guide turns: 4")).toBeTruthy();
    expect(within(slotBody(container, "top")).getByText("Reader body")).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="stateful-guide"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="stateful-map"]')).toHaveLength(1);
    expect(container.querySelectorAll(".portfolio-reading-room-pane-body > *")).toHaveLength(3);
  });

  it("moves a collapsed lower view into main without hiding main", () => {
    const storage = new MemoryStorage();
    const { container } = render(<PortfolioReadingRoom {...roomProps(storage)} />);

    fireEvent.click(screen.getByRole("button", { name: "Hide lower view" }));
    expect(slot(container, "bottom").getAttribute("data-collapsed")).toBe("true");

    swap("bottom", "main");

    expect(slot(container, "main").getAttribute("data-view")).toBe("guide");
    expect(slot(container, "main").getAttribute("data-collapsed")).toBe("false");
    expect(slotBody(container, "main").hasAttribute("hidden")).toBe(false);
    expect(within(slotBody(container, "main")).getByText("Guide body")).toBeTruthy();
    expect(slot(container, "bottom").getAttribute("data-view")).toBe("reader");
    expect(slot(container, "bottom").getAttribute("data-collapsed")).toBe("true");
    expect(within(slotBody(container, "bottom")).getByText("Reader body")).toBeTruthy();
    expect(parseReadingRoomLayout(storage.getItem("reading-room-slots")).hidden).toEqual(["reader"]);

    fireEvent.click(screen.getByRole("button", { name: "Show lower view" }));
    expect(slot(container, "bottom").getAttribute("data-collapsed")).toBe("false");
    expect(parseReadingRoomLayout(storage.getItem("reading-room-slots")).hidden).toEqual([]);
  });
});


it("ignores old browser layouts and discards adjustments on a fresh mount", () => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  const legacy = JSON.stringify({slots: {main: "map", top: "reader", bottom: "guide"}, hidden: ["guide"]});
  window.localStorage.setItem("reading-room-slots", legacy);
  window.localStorage.setItem("react-resizable-panels:reading-room-primary", JSON.stringify({"main,right": {layout: [90, 10]}}));
  const props = {...roomProps(new MemoryStorage()), storage: undefined};
  const first = render(<PortfolioReadingRoom {...props} />);
  expect(slot(first.container, "main").dataset.view).toBe("reader");
  expect(slot(first.container, "bottom").dataset.collapsed).toBe("false");
  swap("main", "top");
  fireEvent.click(screen.getByRole("button", {name: "Hide lower view"}));
  expect(slot(first.container, "main").dataset.view).toBe("map");
  first.unmount();
  const second = render(<PortfolioReadingRoom {...props} />);
  expect(slot(second.container, "main").dataset.view).toBe("reader");
  expect(slot(second.container, "top").dataset.view).toBe("map");
  expect(slot(second.container, "bottom").dataset.collapsed).toBe("false");
  expect(window.localStorage.getItem("reading-room-slots")).toBe(legacy);

});

it("does not expose a manual layout reset", () => {
  render(<PortfolioReadingRoom {...roomProps(new MemoryStorage())} />);
  expect(screen.queryByRole("button", { name: "Reset layout" })).toBeNull();
});
