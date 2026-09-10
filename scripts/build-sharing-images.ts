import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type Sharp from "../node_modules/sharp/lib/index.d.ts";
import { sharePages } from "../lib/portfolio-sharing";

// sharp 0.35 omits its declarations from the package export map.
const sharp: typeof Sharp = createRequire(import.meta.url)("sharp");

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
const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
async function textLayer(text: string, size: number, width: number, height: number, color: string) {
  // Supplying height makes libvips enlarge short text to fill the box. Render
  // at the chosen size first, shrinking only when wrapping exceeds the space.
  for (let fontSize = size; fontSize >= 12; fontSize -= 2) {
    const layer = await sharp({ text: {
      text: `<span foreground="${color}">${escape(text)}</span>`,
      font: `Neue Haas Grotesk Display Pro ${fontSize}`, fontfile,
      width, rgba: true, wrap: "word-char", align: "left", spacing: 8,
    } }).png().toBuffer({ resolveWithObject: true });
    if (layer.info.height <= height) return layer.data;
  }
  throw new Error(`Sharing text does not fit: ${text}`);
}

await mkdir(new URL("public/sharing/", root), { recursive: true });
for (const page of sharePages) {
  const title = page.id === "home" ? "I build tools and systems that make space to think." : page.title;
  const image = sharp({ create: { width: 1200, height: 630, channels: 4, background: paper } });
  const layers = [
    { input: await sharp({ create: { width: 12, height: 630, channels: 4, background: accent } }).png().toBuffer(), left: 0, top: 0 },
    { input: await textLayer("BRADLEY BERKMAN", 24, 1000, 35, ink), left: 64, top: 48 },
    { input: await textLayer(page.kind.toUpperCase(), 20, 1000, 28, accent), left: 64, top: 128 },
    { input: await textLayer(title, 68, 1060, 215, ink), left: 60, top: 188 },
    { input: await textLayer(page.description, 28, 1020, 100, muted), left: 64, top: 430 },
    { input: await textLayer("bradleyberkman.com", 22, 1000, 30, muted), left: 64, top: 558 },
  ];
  await image.composite(layers).png().toFile(fileURLToPath(new URL(`public/sharing/${page.id}.png`, root)));
}
console.log(`Generated ${sharePages.length} sharing images.`);
