import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom") as {
  JSDOM: new (html: string) => { window: { document: Document } };
};

const compositionUrl = new URL(
  "../public/design-system-current.html",
  import.meta.url,
);
const brainSymbolUrl = new URL("../public/biv-brain-symbol.png", import.meta.url);

describe("portfolio design-system checkpoint", () => {
  it("keeps the canvas, dossier, cursor, avatar, and minimized assistant in one composition", async () => {
    const html = await readFile(compositionUrl, "utf8");
    const document = new JSDOM(html).window.document;

    expect(document.body.dataset.assistant).toBe("closed");
    expect(document.querySelector("canvas#world")).not.toBeNull();
    expect(document.querySelector("aside#reader")).not.toBeNull();
    expect(document.querySelector("#cursorInstrument")).not.toBeNull();
    expect(document.querySelector(".mini-avatar")).not.toBeNull();
    expect(document.querySelector("#assistant-panel")).not.toBeNull();
    expect(document.querySelector("#assistant-trigger")).not.toBeNull();
    expect(document.querySelector("#reader #assistant-trigger")).toBeNull();
  });

  it("ships the selected Brain symbol used by the identity node", async () => {
    const asset = await stat(brainSymbolUrl);
    expect(asset.size).toBeGreaterThan(100);
  });
});
