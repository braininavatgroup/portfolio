import { COPY_DECK_FOLDER, renderCopyDeckPages } from "../../lib/portfolio-copy-deck";
import { portfolioContentDocument } from "../../lib/portfolio-world";
import { zipStore } from "../../lib/zip-store";

export const dynamic = "force-dynamic";

// The copy deck as one download: the folder of notes, ready to drop into a vault.
export function GET() {
  const archive = zipStore(
    renderCopyDeckPages(portfolioContentDocument).map((page) => ({
      path: `${COPY_DECK_FOLDER}/${page.path}`,
      content: page.content,
    })),
  );
  return new Response(archive, {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${COPY_DECK_FOLDER}.zip"`,
      "content-type": "application/zip",
    },
  });
}
