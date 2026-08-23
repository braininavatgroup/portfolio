import { describe, expect, it } from "vitest";
import { calculateFps } from "./frame-sampler";

describe("frame sampler", () => {
  it("calculates a rolling rate from literal frame intervals", () => {
    expect(calculateFps([16.5, 16.7, 16.8])).toBe(60);
    expect(calculateFps([32, 34, 34])).toBe(30);
  });

  it("does not report a rate without a complete positive sample", () => {
    expect(calculateFps([])).toBe(0);
    expect(calculateFps([0, 16])).toBe(0);
  });
});
