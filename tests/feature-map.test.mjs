import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("a stale control marker fails before the browser or production starts", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "portfolio-feature-map-"));
  const manifest = path.join(directory, "features.json");
  const records = Object.keys(JSON.parse(readFileSync("content/portfolio-content.json", "utf8")).records);
  writeFileSync(manifest, JSON.stringify({
    records,
    routes: [],
    controls: [{ id: "stale", source: "components/PortfolioWorld.tsx", marker: "removedWorldControl" }],
  }));
  const result = spawnSync(process.execPath, ["scripts/live.mjs", "--map-only"], {
    env: { ...process.env, PORTFOLIO_FEATURE_MAP: manifest },
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /FAIL map control stale/);
});
