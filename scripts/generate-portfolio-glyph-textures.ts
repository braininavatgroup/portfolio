import { mkdir, readFile, writeFile } from "node:fs/promises";
import { portfolioCircleGlyph, portfolioGlyphTexture, portfolioTexturedGlyphKinds } from "../lib/portfolio-glyph-texture";
const brain = await readFile(new URL("../public/biv-brain-symbol.svg", import.meta.url), "utf8");
const directory = new URL("../public/glyph-textures/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const kind of portfolioTexturedGlyphKinds) {
  await writeFile(new URL(`${kind}.svg`, directory), portfolioGlyphTexture(kind, brain));
}
await writeFile(new URL("circle.svg", directory), portfolioCircleGlyph(brain));
