import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type Sharp from "../node_modules/sharp/lib/index.d.ts";
import { sharePages } from "../lib/portfolio-sharing";

// sharp 0.35 omits its declarations from the package export map.
const require = createRequire(import.meta.url);
const sharp: typeof Sharp = require("sharp");
const { renderCard } = require("./vendor/social-preview.mjs");

const root = new URL("../", import.meta.url);
// Shared brand palette used in Bradley's approved editorial option A.
const paper = "#fafafa";
const ink = "#0c0c0d";
const muted = "#65656a";
const accent = "#5533ff";
const fontfile = fileURLToPath(new URL("assets/sharing/NeueHaasDisplayRoman.ttf", root));
const boldFont = fileURLToPath(new URL("assets/sharing/NeueHaasDisplayBold.ttf", root));

await mkdir(new URL("public/sharing/", root), { recursive: true });
const previewTitles: Record<string, string> = {
  "home": "Music promotions, systems & AI consulting, and a product studio",
  "touring": "Tour advancing and artist management",
  "kickoff": "Campaign setup and client onboarding",
  "systems-consulting": "Systems optimization, custom software, and AI deployment",
  "music-practice": "Music agency operations",
  "real-estate": "Real-estate deal tracking and reporting",
  "dubs": "Reading, listening, and note-taking",
  "reporting": "Campaign reporting",
  "demo-touring": "Tour advancing and artist management",
  "demo-quarterly-dashboard": "Real-estate deal tracking and reporting"
};
for (const page of sharePages) {
  const title = (previewTitles[page.id] ?? page.title).replace(/\.$/, "");
  const image = await renderCard(sharp, {
    title, category: page.kind, domain: "bradleyberkman.com", identity: "Bradley Berkman",
    romanFont: fontfile, boldFont, paper, ink, muted, accent,
  });
  await writeFile(new URL(`public/sharing/${page.id}.png`, root), image);
}
console.log(`Generated ${sharePages.length} sharing images.`);
