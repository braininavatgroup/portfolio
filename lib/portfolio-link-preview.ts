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

type PreviewBounds = { left: number; right: number; top: number; bottom: number };

export function portfolioLinkPreviewLayout(
  anchor: PreviewBounds,
  bounds: PreviewBounds,
  size: { width: number; height: number },
  gap: number,
) {
  const above = Math.max(0, anchor.top - bounds.top - gap);
  const below = Math.max(0, bounds.bottom - anchor.bottom - gap);
  const placement = below >= size.height || below >= above ? "below" : "above";
  const width = Math.min(size.width, Math.max(0, bounds.right - bounds.left));
  const height = Math.min(size.height, placement === "below" ? below : above);
  return {
    left: Math.max(bounds.left, Math.min(anchor.left, bounds.right - width)),
    top: placement === "below" ? anchor.bottom + gap : anchor.top - gap - height,
    width,
    height,
    placement,
  };
}

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
