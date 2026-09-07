// The still image a record or thread shows when an inline link to it is
// hovered or focused: the first ready visual in its body, read as a poster
// for a video, the first frame of a gallery, or the image itself. Planned
// and interactive visuals have no still, so a link to a record without one
// simply shows no preview.

import {
  isPortfolioVisualReady,
  portfolioVisualFormat,
  type PortfolioBodyBlock,
  type PortfolioVisualBlock,
} from "./portfolio-world";

export type PortfolioLinkPreview = { src: string; alt: string };

function previewOfVisual(block: PortfolioVisualBlock): PortfolioLinkPreview | undefined {
  const format = portfolioVisualFormat(block);
  if (format === "video") {
    return block.poster ? { src: block.poster, alt: block.alt ?? block.purpose } : undefined;
  }
  if (format === "gallery") {
    const asset = block.slides?.[0]?.assets[0];
    return asset ? { src: asset.src, alt: asset.alt || block.purpose } : undefined;
  }
  if (format === "image") {
    return block.src ? { src: block.src, alt: block.alt ?? block.purpose } : undefined;
  }
  return undefined;
}

export function portfolioLinkPreview(
  body: readonly PortfolioBodyBlock[],
): PortfolioLinkPreview | undefined {
  for (const block of body) {
    if (typeof block === "string" || block.type !== "visual") continue;
    if (!isPortfolioVisualReady(block)) continue;
    const preview = previewOfVisual(block);
    if (preview) return preview;
  }
  return undefined;
}
