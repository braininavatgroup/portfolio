// @vitest-environment jsdom

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PortfolioReader } from "./PortfolioReader";

afterEach(cleanup);

it("reserves the source image ratio for Dubs and Writ before lazy images load, including return visits", async () => {
  const props = { activeThreadId: null, onReset: () => {}, onSelect: () => {}, onSelectThread: () => {} };
  const { container, rerender } = render(<PortfolioReader {...props} selectedId="dubs" />);

  for (const selectedId of ["dubs", "writ", "dubs"]) {
    rerender(<PortfolioReader {...props} selectedId={selectedId} />);
    const images = [...container.querySelectorAll<HTMLImageElement>(".reader-visual-slide img[loading='lazy']")];
    expect(images).toHaveLength(selectedId === "dubs" ? 8 : 4);
    for (const image of images) {
      const source = await readFile(resolve("public", image.getAttribute("src")!.slice(1)));
      // PNG's IHDR dimensions are the authoritative ratio; no network request
      // or decoder is needed for the browser to reserve this box.
      expect(source.subarray(1, 4).toString()).toBe("PNG");
      expect(image.getAttribute("width")).toBe(String(source.readUInt32BE(16)));
      expect(image.getAttribute("height")).toBe(String(source.readUInt32BE(20)));
    }
  }
});
