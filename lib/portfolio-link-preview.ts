// Explicit hover choices take priority over gallery order. Other destinations
// fall back to their first ready still or an explicitly captured interactive demo.

import {
  isPortfolioVisualReady,
  portfolioVisualFormat,
  type PortfolioBodyBlock,
  type PortfolioVisualBlock,
} from "./portfolio-world";

export type PortfolioLinkPreview = { src: string; alt: string; treatment?: "logo" | "glyph" };

const bivLogo: PortfolioLinkPreview = {
  src: "/visuals/hover/brain-in-a-vat.png", alt: "Brain in a Vat logo", treatment: "logo",
};
const themeGlyph: PortfolioLinkPreview = {
  src: "/visuals/hover/theme.svg", alt: "Theme asterisk glyph", treatment: "glyph",
};

// Explicit choices remain stable when a page’s gallery order changes.
const hoverChoices: Readonly<Record<string, PortfolioLinkPreview>> = {
  "music-practice": bivLogo,
  "systems-consulting": bivLogo,
  "product-studio": bivLogo,
  infamous: { src: "/visuals/hover/infamous.svg", alt: "INFAMOUS logo", treatment: "logo" },
  philosophy: themeGlyph,
  "thread-philosophy": themeGlyph,
  "making-work-playable": themeGlyph,
  "thread-making-work-playable": themeGlyph,
  kickoff: { src: "/visuals/campaign/campaign-kickoff-poster.png", alt: "Music Promo Campaign Kickoff workflow" },
  pitching: { src: "/visuals/campaign/pitch-pipeline-poster.png", alt: "Music Promo Campaign Pitching workflow" },
  reporting: { src: "/visuals/campaign/reporting-dashboard.png", alt: "Music Promo Campaign Reporting dashboard" },
  "real-estate": { src: "/visuals/real-estate/quarterly-dashboard.png", alt: "Quarterly real-estate pitch-conversion dashboard" },
  touring: { src: "/visuals/touring/advance-demo.png", alt: "Interactive tour advance showing outstanding promoter details" },
  dubs: { src: "/visuals/dubs/lock-screen.png", alt: "Dubs Lock Screen controls" },
  writ: { src: "/visuals/writ/output-priority.png", alt: "Writ output priorities" },
};

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
  if (format === "interactive" && block.preview === "quarterly-dashboard") {
    return { src: "/visuals/real-estate/quarterly-dashboard.png", alt: "Quarterly real-estate pitch-conversion dashboard" };
  }
  if (format === "interactive" && block.preview === "touring") {
    return { src: "/visuals/touring/advance-demo.png", alt: "Interactive tour advance showing outstanding promoter details" };
  }
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
  destinationId?: string,
): PortfolioLinkPreview | undefined {
  if (destinationId && hoverChoices[destinationId]) return hoverChoices[destinationId];
  for (const block of body) {
    if (typeof block === "string" || block.type !== "visual") continue;
    if (!isPortfolioVisualReady(block)) continue;
    const preview = previewOfVisual(block);
    if (preview) return preview;
  }
  return undefined;
}
