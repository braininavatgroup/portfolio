import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { portfolioCircleGlyph, portfolioGlyphTexture, portfolioTexturedGlyphKinds } from "./portfolio-glyph-texture";
import { portfolioControlCrops, portfolioControlMarkPrimitives } from "./portfolio-control-mark";

describe("vector glyph textures", () => {
  it.each(portfolioTexturedGlyphKinds)("keeps %s generated from the approved outline and crop", async kind => {
    const brain = await readFile(new URL("../public/biv-brain-symbol.svg", import.meta.url), "utf8");
    const generated = portfolioGlyphTexture(kind, brain);
    expect(await readFile(new URL(`../public/glyph-textures/${kind}.svg`, import.meta.url), "utf8")).toBe(generated);
    const [outline] = portfolioControlMarkPrimitives(kind);
    if (outline.kind !== "path") throw new Error("Expected outline");
    expect(generated).toContain(outline.d);
    expect(generated).toContain(portfolioControlCrops[kind].textureTransform.replaceAll("px", "").replaceAll("deg", ""));
    expect(generated).not.toMatch(/<image|<filter|style=/);
    expect(generated).toContain('clip-path="url(#silhouette)"');
  });
});

it("locks the approved positioned circle crop and generated asset", async () => {
  const brain = await readFile(new URL("../public/biv-brain-symbol.svg", import.meta.url), "utf8");
  const generated = portfolioCircleGlyph(brain);
  expect(generated).toContain('transform="translate(1.15 3.17) rotate(-37) scale(1.6)"');
  expect(generated).toContain('<circle r="8.375" fill="none" stroke="black" stroke-width="1.25"/>');
  expect(await readFile(new URL("../public/glyph-textures/circle.svg", import.meta.url), "utf8")).toBe(generated);
});
