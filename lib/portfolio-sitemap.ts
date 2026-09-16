import { portfolioOrigin, sharePages } from "./portfolio-sharing";
import { isSupportingRoute } from "../worker/public-portfolio";

// The sitemap lists the pages the site wants found: the home page, every
// record and theme, the privacy notice, and the demos. Supporting surfaces
// (design gallery, feedback and preview routes) are excluded here
// and also carry `x-robots-tag: noindex` from the worker, so the two rules
// cannot disagree about a page.

export function sitemapPaths(): readonly string[] {
  return sharePages
    .map((page) => page.path)
    .filter((path) => !isSupportingRoute(path));
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/gu, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!,
  );
}

export function renderSitemap(paths: readonly string[] = sitemapPaths()) {
  const entries = paths.map(
    (path) => `  <url><loc>${escapeXml(`${portfolioOrigin}${path}`)}</loc></url>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}
