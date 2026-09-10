// Writes the copy deck folder for the current content document: the same
// notes the live site serves from /copy-deck. Agents applying Bradley's
// edits write a fresh export and diff his folder against it:
//
//   npm run copy-deck --silent -- /tmp/copy-deck-current
//   diff -r /tmp/copy-deck-current "~/path/to/vault/Portfolio copy"
//
// The argument is the folder to write into (created if missing). With no
// argument, the notes print to stdout, each under its path.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertValidPortfolioContentDocument } from "../lib/portfolio-content-schema";
import { renderCopyDeckPages } from "../lib/portfolio-copy-deck";

const contentPath = fileURLToPath(new URL("../content/portfolio-content.json", import.meta.url));
const document: unknown = JSON.parse(readFileSync(contentPath, "utf8"));
assertValidPortfolioContentDocument(document);
const pages = renderCopyDeckPages(document);

const target = process.argv[2];
if (target) {
  for (const page of pages) {
    const file = join(target, page.path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, page.content);
  }
  console.error(`wrote ${pages.length} notes to ${target}`);
} else {
  for (const page of pages) {
    process.stdout.write(`==> ${page.path}\n${page.content}\n`);
  }
}
