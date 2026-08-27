import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { load } from "js-yaml";

const workflowUrl = new URL("../.github/workflows/ci.yml", import.meta.url);

async function workflow() {
  return load(await readFile(workflowUrl, "utf8"));
}

function stepUsing(job, action) {
  return job.steps.find((step) => step.uses === action);
}

test("main-preview deployment consumes the tested artifact behind an explicit false gate", async () => {
  const config = await workflow();
  const ci = config.jobs.ci;
  const deploy = config.jobs.deploy_main_preview;

  assert.ok(ci, "CI job is required");
  assert.ok(deploy, "main-preview deploy job is required");
  assert.equal(deploy.needs, "ci");
  assert.equal(deploy.environment, "portfolio-main-preview");
  assert.deepEqual(deploy.permissions, { contents: "read" });
  assert.match(deploy.if, /github\.event_name\s*==\s*'push'/);
  assert.match(deploy.if, /github\.ref\s*==\s*'refs\/heads\/main'/);
  assert.match(
    deploy.if,
    /vars\.PORTFOLIO_MAIN_PREVIEW_DEPLOY_ENABLED\s*==\s*'true'/,
  );

  const upload = stepUsing(ci, "actions/upload-artifact@v4");
  assert.ok(upload, "CI must upload the already-tested dist artifact");
  assert.match(upload.if, /github\.event_name\s*==\s*'push'/);
  assert.equal(upload.with.path, "dist");
  assert.equal(upload.with.name, "portfolio-main-preview-${{ github.sha }}");

  const download = stepUsing(deploy, "actions/download-artifact@v4");
  assert.ok(download, "deploy job must download the CI artifact");
  assert.equal(download.with.path, "dist");
  assert.equal(download.with.name, upload.with.name);
  assert.ok(
    deploy.steps.some(
      (step) =>
        typeof step.run === "string" &&
        step.run.includes("shasum -a 256") &&
        step.run.includes("dist"),
    ),
    "deploy job must record an artifact digest",
  );

  const deployStep = stepUsing(deploy, "cloudflare/wrangler-action@v3");
  assert.ok(deployStep, "deploy job must use Wrangler's official action");
  assert.equal(deployStep.with.apiToken, "${{ secrets.CLOUDFLARE_API_TOKEN }}");
  assert.equal(deployStep.with.accountId, "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}");
  assert.match(
    deployStep.with.command,
    /deploy --config wrangler\.main-preview\.jsonc --strict/,
  );
  assert.doesNotMatch(JSON.stringify(config), /(?:apiToken|accountId):\s*[A-Za-z0-9]/);
});
