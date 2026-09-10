import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { portfolioWorldNodeById } from "./portfolio-world";

function movieDuration(bytes: Buffer): number {
  // Read the actual movie header, so swapping in a longer file fails this test.
  function child(start: number, end: number, type: string): number {
    for (let cursor = start; cursor + 8 <= end;) {
      const size = bytes.readUInt32BE(cursor);
      if (size < 8 || cursor + size > end) throw new Error("Invalid MP4 box");
      if (bytes.toString("ascii", cursor + 4, cursor + 8) === type) return cursor;
      cursor += size;
    }
    throw new Error(`Missing MP4 ${type}`);
  }
  const moov = child(0, bytes.length, "moov");
  const mvhd = child(moov + 8, moov + bytes.readUInt32BE(moov), "mvhd");
  const version = bytes[mvhd + 8];
  const scaleOffset = mvhd + (version === 1 ? 28 : 20);
  const duration = version === 1
    ? Number(bytes.readBigUInt64BE(scaleOffset + 4))
    : bytes.readUInt32BE(scaleOffset + 4);
  return duration / bytes.readUInt32BE(scaleOffset);
}

describe("published campaign recordings", () => {
  it("ships the reviewed media bytes recorded in the delivery receipt", () => {
    const receipt = JSON.parse(readFileSync(join(process.cwd(), "docs/visuals/redaction-delivery.json"), "utf8")) as {
      assets: { src: string; sha256: string; sourceHash: string }[];
    };
    expect(receipt.assets).toHaveLength(5);
    for (const asset of receipt.assets) {
      const bytes = readFileSync(join(process.cwd(), "public", asset.src));
      expect(createHash("sha256").update(bytes).digest("hex"), asset.src).toBe(asset.sha256);
      expect(asset.sha256).not.toBe(asset.sourceHash);
    }
  });

  it("ships the treated kickoff file without its untreated public source", () => {
    const visual = portfolioWorldNodeById.get("kickoff")!.body.find(
      (block) => typeof block !== "string" && block.type === "visual" && block.format === "video",
    );
    if (!visual || typeof visual === "string" || visual.type !== "visual") throw new Error("Missing kickoff video");
    expect(visual.muxPlaybackId).toBeUndefined();
    expect(visual.src).toBe("/visuals/campaign/campaign-kickoff-redacted.mp4");
    const bytes = readFileSync(join(process.cwd(), "public", visual.src!));
    expect(bytes.byteLength).toBeLessThan(25 * 1024 * 1024);
    expect(movieDuration(bytes)).toBe(157);
    expect(existsSync(join(process.cwd(), "public/visuals/campaign/campaign-kickoff-raw.mp4"))).toBe(false);
  });

  it("serves only the first 2:40, without an uncut streaming or public-file alternative", () => {
    const visual = portfolioWorldNodeById.get("pitching")!.body.find(
      (block) => typeof block !== "string" && block.type === "visual" && block.format === "video",
    );
    if (!visual || typeof visual === "string" || visual.type !== "visual") throw new Error("Missing pitching video");
    expect(visual.muxPlaybackId).toBeUndefined();
    expect(visual.src).toBe("/visuals/campaign/pitch-pipeline-preview.mp4");
    const file = join(process.cwd(), "public", visual.src!);
    const bytes = readFileSync(file);
    expect(bytes.byteLength).toBeLessThan(25 * 1024 * 1024);
    const duration = movieDuration(bytes);
    expect(duration).toBeGreaterThan(159);
    expect(duration).toBeLessThanOrEqual(160);
    expect(existsSync(join(process.cwd(), "public/visuals/campaign/pitch-pipeline-raw.mp4"))).toBe(false);
  });
});
