import { describe, expect, it } from "vitest";
import {
  DEFAULT_READING_ROOM_LAYOUT,
  parseReadingRoomLayout,
  serializeReadingRoomLayout,
  setReadingRoomViewHidden,
  swapReadingRoomSlots,
  visibleReadingRoomSlots,
} from "./reading-room-layout";
import type { ReadingRoomLayoutState } from "./reading-room-layout";
import { readingRoomInitialSizes, readingRoomMinimums } from "./reading-room-layout";

describe("Reading Room layout state", () => {
  it("round-trips a complete stored layout", () => {
    const stored = {
      slots: { main: "guide", top: "reader", bottom: "map" },
      hidden: ["map"],
      split: 0.63,
      vsplit: 0.55,
      side: 0.28,
    } satisfies ReadingRoomLayoutState;

    expect(parseReadingRoomLayout(JSON.stringify(stored))).toEqual(stored);
    expect(JSON.parse(serializeReadingRoomLayout(stored))).toEqual(stored);
  });

  it("uses the documented first-run layout", () => {
    expect(DEFAULT_READING_ROOM_LAYOUT).toEqual({
      slots: { main: "reader", top: "map", bottom: "guide" },
      hidden: [],
      split: 680 / 1120,
      vsplit: 0.4,
      side: 320 / 1440,
    });
  });

  it("keeps valid stored fields when malformed fields fall back to defaults", () => {
    expect(
      parseReadingRoomLayout(
        JSON.stringify({
          slots: { main: "guide", top: "guide", bottom: "unknown" },
          hidden: ["map", "unknown"],
          split: Number.POSITIVE_INFINITY,
          vsplit: 0.65,
          side: "not-a-number",
        }),
      ),
    ).toEqual({
      slots: DEFAULT_READING_ROOM_LAYOUT.slots,
      hidden: [],
      split: DEFAULT_READING_ROOM_LAYOUT.split,
      vsplit: 0.65,
      side: DEFAULT_READING_ROOM_LAYOUT.side,
    });
  });

  it("rejects malformed stored data without throwing", () => {
    expect(parseReadingRoomLayout("{invalid json")).toEqual(DEFAULT_READING_ROOM_LAYOUT);
    expect(
      parseReadingRoomLayout(
        JSON.stringify({
          slots: { main: "reader", top: "map", bottom: "guide" },
          hidden: "map",
          split: 0.6,
          vsplit: 0.4,
          side: 0.2,
        }),
      ),
    ).toEqual({
      ...DEFAULT_READING_ROOM_LAYOUT,
      split: 0.6,
      vsplit: 0.4,
      side: 0.2,
    });
  });

  it.each([
    ["main", "top", { main: "map", top: "reader", bottom: "guide" }],
    ["main", "bottom", { main: "guide", top: "map", bottom: "reader" }],
    ["top", "bottom", { main: "reader", top: "guide", bottom: "map" }],
  ] as const)("swaps the %s and %s views", (first, second, slots) => {
    expect(swapReadingRoomSlots(DEFAULT_READING_ROOM_LAYOUT, first, second).slots).toEqual(slots);
  });

  it("keeps a collapsed lower slot collapsed when its view is dragged into main", () => {
    const lowerHidden = setReadingRoomViewHidden(DEFAULT_READING_ROOM_LAYOUT, "guide", true);
    const swapped = swapReadingRoomSlots(lowerHidden, "main", "bottom");

    expect(swapped.slots).toEqual({ main: "guide", top: "map", bottom: "reader" });
    expect(swapped.hidden).toEqual(["reader"]);
    expect(visibleReadingRoomSlots(swapped)).toEqual(["main", "top"]);
    expect(visibleReadingRoomSlots(swapReadingRoomSlots(swapped, "bottom", "main"))).toEqual([
      "main",
      "top",
    ]);
  });

  it("keeps a hidden right column hidden when its upper view is dragged into main", () => {
    const rightHidden = setReadingRoomViewHidden(
      setReadingRoomViewHidden(DEFAULT_READING_ROOM_LAYOUT, "guide", true),
      "map",
      true,
    );
    const swapped = swapReadingRoomSlots(rightHidden, "top", "main");

    expect(swapped.slots).toEqual({ main: "map", top: "reader", bottom: "guide" });
    expect(swapped.hidden).toEqual(["reader", "guide"]);
    expect(visibleReadingRoomSlots(swapped)).toEqual(["main"]);
  });

  it("never lets the main view hide, whether persisted or requested", () => {
    const stored = JSON.stringify({
      slots: { main: "guide", top: "reader", bottom: "map" },
      hidden: ["guide", "map"],
      split: 0.6,
      vsplit: 0.4,
      side: 0.2,
    });

    expect(parseReadingRoomLayout(stored).hidden).toEqual(["map"]);
    expect(visibleReadingRoomSlots(parseReadingRoomLayout(stored))).toEqual(["main", "top"]);
    expect(setReadingRoomViewHidden(DEFAULT_READING_ROOM_LAYOUT, "reader", true).hidden).toEqual([]);
    expect(
      JSON.parse(serializeReadingRoomLayout({ ...DEFAULT_READING_ROOM_LAYOUT, hidden: ["reader"] })).hidden,
    ).toEqual([]);
  });

  it("hides and reopens both views in the right column", () => {
    const bottomHidden = setReadingRoomViewHidden(DEFAULT_READING_ROOM_LAYOUT, "guide", true);
    const rightHidden = setReadingRoomViewHidden(bottomHidden, "map", true);

    expect(visibleReadingRoomSlots(rightHidden)).toEqual(["main"]);
    expect(visibleReadingRoomSlots(setReadingRoomViewHidden(rightHidden, "map", false))).toEqual([
      "main",
      "top",
    ]);
    expect(visibleReadingRoomSlots(setReadingRoomViewHidden(rightHidden, "guide", false))).toEqual([
      "main",
      "top",
      "bottom",
    ]);
  });

  it("collapses and reopens the lower side slot", () => {
    const collapsed = setReadingRoomViewHidden(DEFAULT_READING_ROOM_LAYOUT, "guide", true);

    expect(visibleReadingRoomSlots(collapsed)).toEqual(["main", "top"]);
    expect(visibleReadingRoomSlots(setReadingRoomViewHidden(collapsed, "guide", false))).toEqual([
      "main",
      "top",
      "bottom",
    ]);
  });

  it("reopens the upper side slot when the lower side slot is visible", () => {
    const state = setReadingRoomViewHidden(DEFAULT_READING_ROOM_LAYOUT, "map", true);

    expect(state.hidden).toEqual([]);
    expect(visibleReadingRoomSlots(state)).toEqual(["main", "top", "bottom"]);
  });
});

describe("readingRoomMinimums", () => {
  it("leaves drag room instead of consuming the entire desktop width", () => {
    for (const width of [1020, 1024, 1180, 1280, 1381, 1440, 1920]) {
      const minimums = readingRoomMinimums();
      expect(minimums.contents + 1 + minimums.workspace).toBeLessThanOrEqual(width - 150);
      expect(minimums.workspace).toBe(minimums.main + 1 + minimums.right);
      expect(minimums.main).toBeGreaterThanOrEqual(420);
    }
  });
});

it("preserves the initial composition independently of drag minimums", () => {
  expect(readingRoomInitialSizes(1020)).toEqual({contents: 240, main: 458, right: 320});
  expect(readingRoomInitialSizes(1280)).toEqual({contents: 240, main: 718, right: 320});
  expect(readingRoomInitialSizes(1440)).toEqual({contents: 320, main: 720, right: 398});
});
