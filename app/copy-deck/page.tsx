import { shareMetadata } from "../../lib/portfolio-sharing";
import type { Metadata } from "next";
import Link from "next/link";
import { COPY_DECK_FOLDER, renderCopyDeckPages } from "../../lib/portfolio-copy-deck";
import { portfolioContentDocument } from "../../lib/portfolio-world";
import { CopyDeckActions } from "./CopyDeckActions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...shareMetadata("copy-deck"),
  robots: { index: false, follow: false },
};

// The unlisted export page for the copy deck. Bradley opens it on the live
// site and writes the folder of notes into his Obsidian vault, edits there,
// and hands the edited folder to an agent. Nothing here writes to the site.
export default function CopyDeckPage() {
  const pages = renderCopyDeckPages(portfolioContentDocument);
  return (
    <main className="privacy-page copy-deck-page" id="main-content" tabIndex={-1}>
      <Link href="/">Back to the portfolio</Link>
      <h1>Copy deck</h1>
      <p>
        One clean Markdown note per page of the site, in a folder called {COPY_DECK_FOLDER}. Revision{" "}
        {portfolioContentDocument.revision}, {pages.length} notes.
      </p>
      <CopyDeckActions folderName={COPY_DECK_FOLDER} pages={pages} />
      <p>
        Edit the notes, then give the folder to an agent and ask it to apply the copy deck edits. The
        agent diffs your notes against the live copy and changes only what you changed.
      </p>
    </main>
  );
}
