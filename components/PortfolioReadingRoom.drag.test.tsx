// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
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

afterEach(() => cleanup());

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
});
