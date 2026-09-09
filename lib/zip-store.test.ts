import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { crc32, zipStore } from "./zip-store";

describe("zipStore", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("writes an archive the system unzip can list and extract byte-for-byte", () => {
    const entries = [
      { path: "Portfolio copy/Bradley Berkman.md", content: "# Bradley Berkman\n\nHey — I'm Bradley.\n" },
      { path: "Portfolio copy/Threads/Making Work Playable.md", content: "# Making Work Playable\n" },
      { path: "Portfolio copy/Site text.md", content: "" },
    ];
    const archive = zipStore(entries, new Date(2026, 8, 5, 12, 0, 0));
    expect(Array.from(archive.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const dir = mkdtempSync(join(tmpdir(), "copy-deck-zip-"));
    const file = join(dir, "deck.zip");
    writeFileSync(file, archive);
    execFileSync("unzip", ["-q", file, "-d", dir]);
    for (const entry of entries) {
      expect(readFileSync(join(dir, entry.path), "utf8")).toBe(entry.content);
    }
  });
});
