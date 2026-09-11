import { describe, expect, it } from "vitest";

import { renderSitemap, sitemapPaths } from "./portfolio-sitemap";
import { sharePages } from "./portfolio-sharing";

describe("sitemapPaths", () => {
  it("lists the home page, every record and theme, privacy, and the demos", () => {
    const paths = sitemapPaths();
    expect(paths).toContain("/");
    expect(paths).toContain("/privacy");
    expect(paths).toContain("/demos/touring");
    expect(paths).toContain("/demos/quarterly-dashboard");
    for (const page of sharePages.filter((item) => item.path.startsWith("/index/"))) {
      expect(paths).toContain(page.path);
    }
  });

  it("never lists a supporting surface the worker marks noindex", () => {
    const paths = sitemapPaths();
    expect(paths).not.toContain("/design");
    expect(paths).not.toContain("/copy-deck");
    expect(paths.some((path) => path.startsWith("/_portfolio-"))).toBe(false);
  });
});

describe("renderSitemap", () => {
  it("renders absolute, escaped locations in the sitemap protocol", () => {
    const xml = renderSitemap(["/", "/index/a&b"]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset')).toBe(true);
    expect(xml).toContain("<loc>https://bradleyberkman.com/</loc>");
    expect(xml).toContain("<loc>https://bradleyberkman.com/index/a&amp;b</loc>");
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
  });
});
