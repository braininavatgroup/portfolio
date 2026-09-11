import { renderSitemap } from "../../lib/portfolio-sitemap";

export const dynamic = "force-dynamic";

// Built from the same page inventory as the share metadata, so a new record
// or theme is listed the moment it is authored.
export function GET() {
  return new Response(renderSitemap(), {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": "application/xml; charset=utf-8",
    },
  });
}
