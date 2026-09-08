import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { preserveSource, sourcePath } from "./storage.mjs";

test("publishing replacement bytes does not replace the original used by selections", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "portfolio-studio-"));
  try {
    const input = path.join(dir, "site.png");
    await writeFile(input, "original");
    const asset = {
      src: "/visuals/site.png",
      sha256: createHash("sha256").update("original").digest("hex"),
    };
    await preserveSource(dir, asset, input);
    await writeFile(input, "redacted");
    await preserveSource(dir, asset, input);
    assert.equal(await readFile(sourcePath(dir, asset), "utf8"), "original");
    await writeFile(sourcePath(dir, asset), "damaged");
    await assert.rejects(preserveSource(dir, asset, input), /damaged/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rejects changed inputs and unsafe source identifiers", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "portfolio-studio-"));
  try {
    const input = path.join(dir, "site.png");
    await writeFile(input, "replacement");
    const asset = { src: "site.png", sha256: "a".repeat(64) };
    await assert.rejects(preserveSource(dir, asset, input), /Source changed/);
    assert.throws(
      () => sourcePath(dir, { sha256: "../../elsewhere" }),
      /fingerprint/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
