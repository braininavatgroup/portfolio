import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("..", import.meta.url);
const configUrl = new URL("../wrangler.main-preview.jsonc", import.meta.url);

async function mainPreviewConfig() {
  return JSON.parse(await readFile(configUrl, "utf8"));
}

test("the permanent main preview is an isolated, password-gated Workers.dev deployment", async () => {
  const config = await mainPreviewConfig();

  assert.equal(config.name, "bradley-portfolio-main-preview");
  assert.equal(config.main, "dist/server/index.js");
  assert.equal(config.compatibility_date, "2026-08-27");
  assert.deepEqual(config.compatibility_flags, ["nodejs_compat"]);
  assert.equal(config.workers_dev, true);
  assert.equal(config.preview_urls, false);
  assert.equal(config.route, undefined);
  assert.equal(config.routes, undefined);
  assert.equal(config.domains, undefined);
  assert.equal(config.no_bundle, true);

  assert.deepEqual(config.vars, {
    PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED: "true",
    PORTFOLIO_CHAT_TURNSTILE_REQUIRED: "false",
    PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT: "200",
    OPENAI_PORTFOLIO_MODEL: "gpt-5.6-terra",
    OPENAI_PORTFOLIO_REASONING_EFFORT: "medium",
  });
  assert.deepEqual(config.secrets, {
    required: [
      "OPENAI_API_KEY",
      "PORTFOLIO_MAIN_PREVIEW_PASSWORD",
      "PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET",
    ],
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
  assert.deepEqual(config.images, { binding: "IMAGES" });
  assert.deepEqual(config.assets, {
    directory: "dist/client",
    binding: "ASSETS",
    run_worker_first: true,
  });
  assert.deepEqual(config.observability, { enabled: true });

  for (const secretName of config.secrets.required) {
    assert.equal(Object.hasOwn(config.vars, secretName), false, secretName);
  }
  assert.doesNotMatch(JSON.stringify(config), /sk-[A-Za-z0-9_-]+/);
  assert.doesNotMatch(JSON.stringify(config), /correct horse battery staple/i);
});

test("Wrangler accepts the built permanent main-preview contract", async () => {
  const wrangler = new URL("../node_modules/.bin/wrangler", import.meta.url)
    .pathname;
  const child = spawn(
    wrangler,
    [
      "deploy",
      "--config",
      "wrangler.main-preview.jsonc",
      "--dry-run",
      "--outdir",
      ".wrangler/main-preview-dry-run",
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
