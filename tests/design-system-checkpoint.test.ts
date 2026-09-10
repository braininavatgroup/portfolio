import { stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const brainSymbolUrl = new URL("../public/biv-brain-symbol.png", import.meta.url);

describe("portfolio design-system checkpoint", () => {
  it("ships the selected Brain symbol used by the identity node", async () => {
    const asset = await stat(brainSymbolUrl);
    expect(asset.size).toBeGreaterThan(100);
  });
});
