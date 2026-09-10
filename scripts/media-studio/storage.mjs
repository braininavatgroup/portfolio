import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { readFile, mkdir, copyFile, stat } from "node:fs/promises";
import { constants } from "node:fs";

export function studioDataDir() {
  return (
    process.env.PORTFOLIO_STUDIO_DATA_DIR ||
    path.join(
      os.homedir(),
      process.platform === "darwin"
        ? "Library/Application Support"
        : ".local/share",
      "portfolio-redaction-studio",
    )
  );
}

export function sourcePath(dir, asset) {
  if (!/^[a-f0-9]{64}$/.test(asset.sha256))
    throw new Error("Invalid source fingerprint");
  return path.join(dir, "originals", asset.sha256);
}

export async function preserveSource(dir, asset, input) {
  const destination = sourcePath(dir, asset);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  try {
    await stat(destination);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const bytes = await readFile(input);
    if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) {
      throw new Error(`Source changed before snapshot: ${asset.src}`);
    }
    try {
      await copyFile(input, destination, constants.COPYFILE_EXCL);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  if (
    createHash("sha256")
      .update(await readFile(destination))
      .digest("hex") !== asset.sha256
  ) {
    throw new Error(`Original snapshot is damaged: ${asset.src}`);
  }
  return destination;
}
