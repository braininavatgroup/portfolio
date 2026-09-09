import { describe, expect, it } from "vitest";
import { checkToolbarGeometry } from "../scripts/check-toolbar-geometry.mjs";

const row = { view: "map", height: 40, centerY: 20, artCenterY: 20, artInset: 33, actions: [{centerY:20,size:[18,18]}] };
const pageWith = (rows: (typeof row)[]) => ({ locator: () => ({ evaluateAll: async () => rows }) });

describe("toolbar browser geometry guard", () => {
  it("accepts aligned artwork in a 40px row", async () => {
    await expect(checkToolbarGeometry(pageWith([row]))).resolves.toEqual([row]);
  });
  it("rejects the 18px-grid/20px-artwork overflow even when the row wrapper is centered", async () => {
    await expect(checkToolbarGeometry(pageWith([{...row,artCenterY:21}]))).rejects.toThrow("artwork drift");
  });
  it("rejects horizontal and action-center drift", async () => {
    await expect(checkToolbarGeometry(pageWith([{...row,artInset:34}]))).rejects.toThrow("artwork drift");
    await expect(checkToolbarGeometry(pageWith([{...row,actions:[{centerY:19.5,size:[18,18]}]}]))).rejects.toThrow("action drift");
  });
});
