import { portfolioControlCrops, portfolioControlMarkPrimitives } from "./portfolio-control-mark";

export const portfolioTexturedGlyphKinds = ["map", "chat", "avatarShown"] as const;
export type PortfolioTexturedGlyphKind = (typeof portfolioTexturedGlyphKinds)[number];

/** Authoring only: keep crop and clipping in vector space, before rasterization.
 * IDs are local to each SVG image resource, so drag clones cannot collide. */
export function portfolioGlyphTexture(kind: PortfolioTexturedGlyphKind, brainSvg: string) {
  const source = brainSvg.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/);
  if (!source) throw new Error("Brain artwork must have an SVG viewBox");
  const [outline] = portfolioControlMarkPrimitives(kind);
  if (outline.kind !== "path") throw new Error("Textured glyph needs a path silhouette");
  const transform = portfolioControlCrops[kind].textureTransform.replaceAll("px", "").replaceAll("deg", "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><defs><clipPath id="silhouette"><path d="${outline.d}"/></clipPath></defs><g clip-path="url(#silhouette)"><g transform="${transform}"><svg x="-9" y="-9" width="18" height="18" viewBox="${source[1]}">${source[2]}</svg></g></g></svg>\n`;
}

/** Approved positioned 1.6× circle crop, with the same 18px ink envelope as A. */
export function portfolioCircleGlyph(brainSvg: string) {
  const source = brainSvg.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/);
  if (!source) throw new Error("Brain artwork must have an SVG viewBox");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><defs><clipPath id="silhouette"><circle r="8.375"/></clipPath></defs><g clip-path="url(#silhouette)"><g transform="translate(1.15 3.17) rotate(-37) scale(1.6)"><svg x="-9" y="-9" width="18" height="18" viewBox="${source[1]}">${source[2]}</svg></g></g><circle r="8.375" fill="none" stroke="black" stroke-width="1.25"/></svg>\n`;
}
