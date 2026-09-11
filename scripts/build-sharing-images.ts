import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type Sharp from "../node_modules/sharp/lib/index.d.ts";
import { sharePages } from "../lib/portfolio-sharing";

// sharp 0.35 omits its declarations from the package export map.
const require = createRequire(import.meta.url);
const sharp: typeof Sharp = require("sharp");
const { renderCard } = require("./vendor/social-preview.mjs");

const root = new URL("../", import.meta.url);
const css = await readFile(new URL("app/globals.css", root), "utf8");
function token(name: string) {
  const value = css.match(new RegExp(`--${name}:\\s*(#[a-fA-F0-9]+);`))?.[1];
  if (!value) throw new Error(`Missing sharing-image color token: ${name}`);
  return value;
}
const paper = token("reader-paper-light");
const ink = token("reader-ink-light");
const muted = token("reader-body-light");
const accent = token("world-violet");
const fontfile = fileURLToPath(new URL("assets/sharing/NeueHaasDisplayRoman.ttf", root));
const boldFont = fileURLToPath(new URL("assets/sharing/NeueHaasDisplayBold.ttf", root));

await mkdir(new URL("public/sharing/", root), { recursive: true });
for (const page of sharePages) {
  const title = page.id === "home" ? "Tools and systems.\nSpace to think." : page.title;
  const image = await renderCard(sharp, {
    title, category: page.kind, domain: "bradleyberkman.com", identity: "Bradley Berkman",
    romanFont: fontfile, boldFont, paper, ink, muted, accent,
  });
  await writeFile(new URL(`public/sharing/${page.id}.png`, root), image);
}
console.log(`Generated ${sharePages.length} sharing images.`);
