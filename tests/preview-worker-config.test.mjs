import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("..", import.meta.url);
const configUrl = new URL("../wrangler.preview.jsonc", import.meta.url);

async function previewConfig() {
  return JSON.parse(await readFile(configUrl, "utf8"));
}

// Owner: BIV-317 release config. Retire with the dedicated preview Worker.
test("the dedicated preview config cannot attach production routes or the older access stack", async () => {
  const config = await previewConfig();

  assert.equal(config.name, "bradley-portfolio-preview");
  assert.equal(config.main, "dist/server/index.js");
  assert.equal(config.workers_dev, true);
  assert.equal(config.preview_urls, false);
  assert.equal(config.route, undefined);
  assert.equal(config.routes, undefined);
  assert.equal(config.domains, undefined);
  assert.deepEqual(config.vars, {
    PORTFOLIO_CHAT_LIVE_ENABLED: "true",
    PORTFOLIO_CHAT_PREVIEW_ENABLED: "false",
    PORTFOLIO_CHAT_TURNSTILE_REQUIRED: "false",
    PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT: "200",
    OPENAI_PORTFOLIO_MODEL: "gpt-5.4-2026-03-05",
    OPENAI_PORTFOLIO_REASONING_EFFORT: "low",
  });
  assert.deepEqual(config.durable_objects, {
    bindings: [
      {
        name: "PORTFOLIO_CHAT_BUDGET",
        class_name: "PortfolioChatBudgetObject",
      },
    ],
  });
  assert.deepEqual(config.migrations, [
    {
      tag: "v1",
      new_sqlite_classes: ["PortfolioChatBudgetObject"],
    },
  ]);
  assert.equal(config.exports, undefined);

  const serialized = JSON.stringify(config);
  for (const secretName of [
    "OPENAI_API_KEY",
    "PORTFOLIO_CHAT_PREVIEW_ACCESS_CODE",
    "PORTFOLIO_CHAT_SESSION_SECRET",
    "TURNSTILE_SECRET_KEY",
  ]) {
    assert.equal(serialized.includes(secretName), false, secretName);
  }
});

// Owner: config-to-built-artifact seam. Retire when Wrangler no longer deploys this build output.
test("Wrangler accepts the built preview Worker and Durable Object migration", async () => {
  const wrangler = new URL("../node_modules/.bin/wrangler", import.meta.url)
    .pathname;
  const child = spawn(
    wrangler,
    [
      "deploy",
      "--config",
      "wrangler.preview.jsonc",
      "--dry-run",
      "--outdir",
      ".wrangler/preview-dry-run",
    ],
    {
      cwd: projectRoot,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  const exitCode = await new Promise((resolve) => child.once("exit", resolve));

  assert.equal(exitCode, 0, output);
});
