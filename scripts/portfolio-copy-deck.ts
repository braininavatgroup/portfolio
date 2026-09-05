// Prints the copy deck for the current content document, the same Markdown
// the live site serves at /copy-deck.md. Agents applying Bradley's edits run
// this first and diff his edited deck against it:
//
//   npm run copy-deck --silent > /tmp/copy-deck.current.md
//   diff /tmp/copy-deck.current.md ~/Downloads/portfolio-copy-deck.md
//
// Optional first argument: a file path to write instead of stdout.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderCopyDeck } from "../lib/portfolio-copy-deck";
import { assertValidPortfolioContentDocument } from "../lib/portfolio-content-schema";

const contentPath = fileURLToPath(new URL("../content/portfolio-content.json", import.meta.url));
const document: unknown = JSON.parse(readFileSync(contentPath, "utf8"));
assertValidPortfolioContentDocument(document);
const deck = renderCopyDeck(document, { exportedOn: new Date().toISOString().slice(0, 10) });

const target = process.argv[2];
if (target) {
  writeFileSync(target, deck);
  console.error(`wrote ${target}`);
} else {
  process.stdout.write(deck);
}
