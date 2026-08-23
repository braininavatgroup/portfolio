import { describe, expect, it } from "vitest";
import { nextKeyboardIndex } from "./keyboard-navigation";

describe("compact graph keyboard navigation", () => {
  it("moves in both directions and wraps at the ends", () => {
    expect(nextKeyboardIndex(0, "next", 4)).toBe(1);
    expect(nextKeyboardIndex(3, "next", 4)).toBe(0);
    expect(nextKeyboardIndex(0, "previous", 4)).toBe(3);
    expect(nextKeyboardIndex(2, "previous", 4)).toBe(1);
  });

  it("stays stable when there are no actionable nodes", () => {
    expect(nextKeyboardIndex(0, "next", 0)).toBe(0);
  });
});
