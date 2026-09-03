import { describe, expect, it } from "vitest";
import {
  portfolioControlMarkKinds,
  portfolioControlMarkPrimitives,
} from "./portfolio-control-mark";

describe("portfolioControlMarkPrimitives", () => {
  it("lists the complete Reading Room control set", () => {
    expect(portfolioControlMarkKinds).toEqual([
      "map",
      "index",
      "chat",
      "close",
      "previous",
      "next",
      "send",
      "minimize",
      "sidebarLeft",
      "mobileSidebar",
      "sidebarRight",
      "panelBottom",
      "reader",
      "copy",
      "newChat",
      "chevron",
      "readArrow",
    ]);
  });

  it("keeps every control inside the 18-unit viewBox authored from the 15-unit scale", () => {
    for (const kind of portfolioControlMarkKinds) {
      for (const primitive of portfolioControlMarkPrimitives(kind)) {
        if (primitive.kind === "path") {
          const coordinates = primitive.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
          expect(Math.max(...coordinates.map(Math.abs))).toBeLessThanOrEqual(9);
        }
        if (primitive.kind === "circle") {
          expect(Math.abs(primitive.x) + primitive.radius).toBeLessThanOrEqual(7.5);
        }
      }
    }
  });

  it("returns the exact Map and Guide outlines for patterned rendering", () => {
    expect(portfolioControlMarkPrimitives("map")).toEqual([
      {
        kind: "path",
        d: "M6.93 4L0 8L-6.93 4L-6.93 -4L0 -8L6.93 -4Z",
        fill: false,
      },
    ]);
    expect(portfolioControlMarkPrimitives("chat")).toEqual([
      {
        kind: "path",
        d: "M7.5 -1.6A7.5 5 0 1 0 -6.85 0.43L-7.4 6.6L-3.52 2.81A7.5 5 0 0 0 7.5 -1.6Z",
        fill: false,
      },
    ]);
  });

  it("uses the exact close endpoints and return Send path", () => {
    expect(portfolioControlMarkPrimitives("close")).toEqual([
      {
        kind: "path",
        d: "M-5.5 -5.5L5.5 5.5 M-5.5 5.5L5.5 -5.5",
        fill: false,
      },
    ]);
    expect(portfolioControlMarkPrimitives("send")).toEqual([
      {
        kind: "path",
        d: "M6 -5V1H-5 M-2 -2L-5 1L-2 4",
        fill: false,
      },
    ]);
  });

  it("returns the supplied chrome and message-action paths", () => {
    expect(portfolioControlMarkPrimitives("sidebarLeft")).toEqual([
      {
        kind: "path",
        d: "M-6 -5.5H6A1 1 0 0 1 7 -4.5V4.5A1 1 0 0 1 6 5.5H-6A1 1 0 0 1 -7 4.5V-4.5A1 1 0 0 1 -6 -5.5Z M-2.5 -5.5V5.5",
        fill: false,
      },
    ]);
    expect(portfolioControlMarkPrimitives("sidebarRight")).toEqual([
      {
        kind: "path",
        d: "M-6 -5.5H6A1 1 0 0 1 7 -4.5V4.5A1 1 0 0 1 6 5.5H-6A1 1 0 0 1 -7 4.5V-4.5A1 1 0 0 1 -6 -5.5Z M2.5 -5.5V5.5",
        fill: false,
      },
    ]);
    expect(portfolioControlMarkPrimitives("panelBottom")).toEqual([
      {
        kind: "path",
        d: "M-6 -5.5H6A1 1 0 0 1 7 -4.5V4.5A1 1 0 0 1 6 5.5H-6A1 1 0 0 1 -7 4.5V-4.5A1 1 0 0 1 -6 -5.5Z M-7 1H7",
        fill: false,
      },
    ]);
    expect(portfolioControlMarkPrimitives("reader")).toEqual([
      { kind: "path", d: "M-7 -5H7 M-7 0H7 M-7 5H1", fill: false },
    ]);
    expect(portfolioControlMarkPrimitives("copy")).toEqual([
      { kind: "path", d: "M-2 -2H6V6H-2Z M2 -2V-6H-6V2H-2", fill: false },
    ]);
    expect(portfolioControlMarkPrimitives("newChat")).toEqual([
      { kind: "path", d: "M-6 0H6 M0 -6V6", fill: false },
    ]);
    expect(portfolioControlMarkPrimitives("chevron")).toEqual([
      { kind: "path", d: "M-3 -6.5L3.5 0L-3 6.5", fill: false },
    ]);
    expect(portfolioControlMarkPrimitives("readArrow")).toEqual([
      { kind: "path", d: "M-5 0H5 M1 -4L5 0L1 4", fill: false },
    ]);
  });

  it("mirrors previous and next across the vertical axis", () => {
    expect(portfolioControlMarkPrimitives("previous")).toEqual([
      { kind: "path", d: "M3 -6.5L-3.5 0L3 6.5", fill: false },
    ]);
    expect(portfolioControlMarkPrimitives("next")).toEqual([
      { kind: "path", d: "M-3 -6.5L3.5 0L-3 6.5", fill: false },
    ]);
  });
});
