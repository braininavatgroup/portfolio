import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { acquireLibrary } from "./lease.mjs";
test("shared library rejects another writer and is reusable after shutdown", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "studio-lease-"));
  try {
    const release = acquireLibrary(dir);
    assert.throws(() => acquireLibrary(dir), /already open/);
    release();
    release();
    const again = acquireLibrary(dir);
    again();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
