/**
 * Background films. The studio does not own these: `nmf-story` is the wave the
 * music-promo Instagram story workflow plays, read from that repository. The
 * source is H.264, which a plain Chromium build cannot decode, so it is
 * transcoded to VP9 once and cached outside the repository.
 */
import { spawn } from "node:child_process";
import { mkdir, rename, stat } from "node:fs/promises";
import { ffmpegAdvice, hasFfmpeg } from "./tools.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sources = {
  "nmf-story":
    process.env.PORTFOLIO_CLIP_NMF_STORY ??
    `${process.env.HOME}/Projects/music-promo/packages/nmf-story/background.mp4`,
};

export const filmNames = Object.keys(sources);

export function filmCacheDir() {
  return (
    process.env.PORTFOLIO_CLIP_FILM_CACHE ??
    fileURLToPath(new URL("../../node_modules/.cache/clip-studio/films", import.meta.url))
  );
}

async function transcode(source, target, width, height) {
  // ffmpeg picks its muxer from the extension, so the partial keeps one.
  const temporary = `${target}.${process.pid}.part.webm`;
  const child = spawn(
    "ffmpeg",
    [
      "-y", "-i", source,
      "-vf", `scale=${width}:${height}`,
      "-an",
      "-c:v", "libvpx-vp9",
      "-crf", "34",
      "-b:v", "0",
      "-row-mt", "1",
      "-cpu-used", "5",
      temporary,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let errors = "";
  child.stderr.on("data", (chunk) => {
    errors = `${errors}${chunk}`.slice(-4000);
  });
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${errors}`)),
    );
  });
  await rename(temporary, target);
}

/**
 * The cached WebM for `name`, transcoding it on first use. Throws with the
 * source path when the film is not on this machine.
 */
export async function filmPath(name, { width = 1080, height = 1920 } = {}) {
  const source = sources[name];
  if (!source) throw new Error(`No background film named "${name}"`);
  const dir = filmCacheDir(),
    target = path.join(dir, `${name}-${width}x${height}.webm`);
  try {
    await stat(target);
    return target;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    await stat(source);
  } catch {
    throw new Error(
      `The "${name}" film is not on this machine. Expected it at ${source}; ` +
        "set PORTFOLIO_CLIP_NMF_STORY to its path.",
    );
  }
  if (!(await hasFfmpeg())) throw new Error(ffmpegAdvice);
  await mkdir(dir, { recursive: true });
  await transcode(source, target, width, height);
  return target;
}
