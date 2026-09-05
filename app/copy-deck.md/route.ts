import { portfolioContentDocument } from "../../lib/portfolio-world";
import { copyDeckFileName, renderCopyDeck } from "../../lib/portfolio-copy-deck";

export const dynamic = "force-dynamic";

export function GET() {
  const exportedOn = new Date().toISOString().slice(0, 10);
  const deck = renderCopyDeck(portfolioContentDocument, { exportedOn });
  return new Response(deck, {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${copyDeckFileName(exportedOn)}"`,
      "content-type": "text/markdown; charset=utf-8",
    },
  });
}
