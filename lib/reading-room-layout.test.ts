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
