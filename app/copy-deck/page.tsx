import type { Metadata } from "next";
import Link from "next/link";
import { copyDeckFileName, renderCopyDeck } from "../../lib/portfolio-copy-deck";
import { portfolioContentDocument } from "../../lib/portfolio-world";
import { CopyDeckActions } from "./CopyDeckActions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Copy deck | Bradley Berkman",
  robots: { index: false, follow: false },
};

// The unlisted export page for the copy deck. Bradley opens it on the live
// site, sends the deck into a fresh Google Doc or Obsidian note, edits there,
// and hands the edited deck to an agent. Nothing here writes anywhere.
export default function CopyDeckPage() {
  const exportedOn = new Date().toISOString().slice(0, 10);
  const deck = renderCopyDeck(portfolioContentDocument, { exportedOn });
  return (
    <main className="privacy-page copy-deck-page" id="main-content" tabIndex={-1}>
      <Link href="/">Back to the portfolio</Link>
      <h1>Copy deck</h1>
      <p>
        Every piece of text on the site, once, in reading order, as Markdown. Content revision{" "}
        {portfolioContentDocument.revision}.
      </p>
      <CopyDeckActions fileName={copyDeckFileName(exportedOn)} markdown={deck} />
      <p>
        Edit in the document, then give it to an agent and ask it to apply the copy deck edits. The
        agent diffs your deck against the live copy and changes only what you changed.
      </p>
    </main>
  );
}
