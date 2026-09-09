import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const brandFonts = {
  "nhg-400.ttf":
    "https://braininavat.systems/assets/brand-review/fonts/NeueHaasDisplayRoman.ttf",
  "nhg-500.ttf":
    "https://braininavat.systems/assets/brand-review/fonts/NeueHaasDisplayMediu.ttf",
};

export const fontNames = Object.keys(brandFonts);

export function fontCacheDir() {
  return (
    process.env.PORTFOLIO_CLIP_FONT_CACHE ??
    fileURLToPath(new URL("../../node_modules/.cache/clip-studio/fonts", import.meta.url))
  );
}

/**
 * Returns the cached brand font, downloading it once. A network failure is not
 * fatal: the renderer falls back to the system stack and says so.
 */
export async function readBrandFont(name) {
  if (!brandFonts[name]) return null;
  const dir = fontCacheDir(),
    file = path.join(dir, name);
  try {
    return await readFile(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const response = await fetch(brandFonts[name]);
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  await mkdir(dir, { recursive: true });
  const temporary = `${file}.${process.pid}.part`;
  await writeFile(temporary, body);
  await rename(temporary, file);
  return body;
}
