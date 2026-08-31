import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { load } from "js-yaml";

const ciWorkflowUrl = new URL("../.github/workflows/ci.yml", import.meta.url);
const firstDeployWorkflowUrl = new URL(
  "../.github/workflows/deploy-main-preview.yml",
  import.meta.url,
);

async function workflow(url) {
  try {
    return load(await readFile(url, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function stepUsing(job, action) {
  return job.steps.find((step) => step.uses === action);
}

test("main-preview deployment consumes the tested artifact behind an explicit false gate", async () => {
  const config = await workflow(ciWorkflowUrl);
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
    /vars\.PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED\s*==\s*'true'/,
  );
  assert.doesNotMatch(deploy.if, /PORTFOLIO_MAIN_PREVIEW_DEPLOY_ENABLED/);

  const upload = stepUsing(ci, "actions/upload-artifact@v4");
  assert.ok(upload, "CI must upload the already-tested dist artifact");
  assert.match(upload.if, /github\.event_name\s*==\s*'push'/);
  assert.equal(upload.with.path, "dist");
  assert.equal(upload.with.name, "portfolio-main-preview-${{ github.sha }}");
  assert.equal(
    upload.with.overwrite,
    undefined,
    "the tested main artifact must remain immutable after its first upload",
  );

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

test("manual first deployment downloads and digest-verifies one successful main-run artifact without rebuilding it", async () => {
  const config = await workflow(firstDeployWorkflowUrl);

  assert.ok(config, "a dedicated manual first-deployment workflow is required");
  assert.deepEqual(Object.keys(config.on), ["workflow_dispatch"]);
  assert.deepEqual(
    Object.keys(config.on.workflow_dispatch.inputs),
    ["source_run_id", "source_sha", "expected_dist_digest"],
    "the manual boundary accepts only non-secret artifact identity inputs",
  );
  for (const input of Object.values(config.on.workflow_dispatch.inputs)) {
    assert.equal(input.required, true);
    assert.equal(input.type, "string");
    assert.equal("default" in input, false);
  }
  assert.deepEqual(config.permissions, { actions: "read", contents: "read" });

  const deploy = config.jobs.deploy_main_preview;
  assert.ok(deploy, "the manual workflow must contain the first deploy job");
  assert.equal(deploy.environment, "portfolio-main-preview");
  assert.match(
    deploy.if,
    /vars\.PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED\s*==\s*'true'/,
  );
  assert.doesNotMatch(deploy.if, /PORTFOLIO_MAIN_PREVIEW_DEPLOY_ENABLED/);

  const checkout = stepUsing(deploy, "actions/checkout@v6");
  assert.ok(checkout, "the exact approved source commit must be checked out");
  assert.equal(checkout.with.ref, "${{ inputs.source_sha }}");

  const download = stepUsing(deploy, "actions/download-artifact@v4");
  assert.ok(download, "the successful source run artifact must be downloaded");
  assert.equal(
    download.with.name,
    "portfolio-main-preview-${{ inputs.source_sha }}",
  );
  assert.equal(download.with.path, "dist");
  assert.equal(download.with["github-token"], "${{ github.token }}");
  assert.equal(download.with.repository, "${{ github.repository }}");
  assert.equal(download.with["run-id"], "${{ inputs.source_run_id }}");

  const digestStep = deploy.steps.find(
    (step) => step.name === "Verify approved main-preview artifact digest",
  );
  assert.ok(digestStep, "the downloaded dist artifact must be digest-verified");
  assert.equal(
    digestStep.env.EXPECTED_DIST_DIGEST,
    "${{ inputs.expected_dist_digest }}",
  );
  assert.match(digestStep.run, /find dist -type f -print0/);
  assert.match(digestStep.run, /sort -z/);
  assert.match(digestStep.run, /shasum -a 256/);
  assert.match(digestStep.run, /ACTUAL_DIST_DIGEST/);
  assert.match(digestStep.run, /EXPECTED_DIST_DIGEST/);

  const deployStep = stepUsing(deploy, "cloudflare/wrangler-action@v3");
  assert.ok(deployStep, "the verified artifact must deploy through Wrangler");
  assert.equal(deployStep.with.apiToken, "${{ secrets.CLOUDFLARE_API_TOKEN }}");
  assert.equal(deployStep.with.accountId, "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}");
  assert.match(
    deployStep.with.command,
    /deploy --config wrangler\.main-preview\.jsonc --strict/,
  );
  assert.doesNotMatch(
    JSON.stringify(config),
    /actions\/upload-artifact|overwrite|npm run build|vinext build/,
    "the manual workflow must neither rebuild nor overwrite the approved artifact",
  );
});
