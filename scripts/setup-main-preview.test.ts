import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptUrl = new URL("./setup-main-preview.sh", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);
const tempDirectories: string[] = [];

async function fakeCommand(directory: string, name: string, body: string) {
  const path = join(directory, name);
  await writeFile(path, `#!/usr/bin/env bash\nset -euo pipefail\n${body}`);
  await chmod(path, 0o755);
}

async function runWizard(
  input: string,
  options?: {
    conductorSession?: boolean;
    failFirstPush?: boolean;
    allowFailure?: boolean;
    postMergeMain?: boolean;
    dirtyPostMerge?: boolean;
    failGateWrite?: boolean;
    failGateReadbackAfterArm?: boolean;
    failWorkflowDispatch?: boolean;
    failDisarmReadback?: boolean;
  },
) {
  const directory = await mkdtemp(join(tmpdir(), "main-preview-wizard-"));
  tempDirectories.push(directory);
  const logPath = join(directory, "calls.log");
  await writeFile(logPath, "");

  await fakeCommand(
    directory,
    "gh",
    `
case "\${1:-} \${2:-}" in
  "auth status") printf 'gh auth status\\n' >> "$WIZARD_CALL_LOG" ;;
  "auth login") printf 'gh auth login\\n' >> "$WIZARD_CALL_LOG" ;;
  "auth setup-git") printf 'gh auth setup-git\\n' >> "$WIZARD_CALL_LOG" ;;
  "repo view") printf 'braininavatgroup/portfolio\\n' ;;
  "pr view") exit 1 ;;
  "pr create")
    printf 'gh pr create\\n' >> "$WIZARD_CALL_LOG"
    printf 'https://github.com/braininavatgroup/portfolio/pull/123\\n'
    ;;
  "api --method") printf 'gh api environment\\n' >> "$WIZARD_CALL_LOG" ;;
  "secret set")
    IFS= read -r secret || true
    printf 'gh secret set %s %s bytes=%s\\n' "$3" "$4 $5" "\${#secret}" >> "$WIZARD_CALL_LOG"
    ;;
  "variable get")
    if [[ -f "$WIZARD_GATE_STATE_FILE" ]]; then
      gate_state=$(cat "$WIZARD_GATE_STATE_FILE")
      if [[ "$gate_state" == "true" && "\${WIZARD_FAIL_GATE_READBACK_AFTER_ARM:-}" == "1" ]]; then
        exit 1
      fi
      if [[ "$gate_state" == "false" && -f "$WIZARD_GATE_ARMED_MARKER" && "\${WIZARD_FAIL_DISARM_READBACK:-}" == "1" ]]; then
        exit 1
      fi
      cat "$WIZARD_GATE_STATE_FILE"
    else
      exit 1
    fi
    ;;
  "variable set")
    printf 'gh variable set %s %s %s\\n' "$3" "$4" "$5" >> "$WIZARD_CALL_LOG"
    if [[ "\${WIZARD_FAIL_GATE_WRITE:-}" == "1" && "$5" == "true" ]]; then
      exit 1
    fi
    printf '%s' "$5" > "$WIZARD_GATE_STATE_FILE"
    if [[ "$5" == "true" ]]; then
      : > "$WIZARD_GATE_ARMED_MARKER"
    fi
    ;;
  "run list")
    printf 'gh %s\\n' "$*" >> "$WIZARD_CALL_LOG"
    printf '123456789\\n'
    ;;
  "run download")
    printf 'gh %s\\n' "$*" >> "$WIZARD_CALL_LOG"
    mkdir -p "$9"
    printf 'tested main artifact\\n' > "$9/index.html"
    ;;
  "workflow run")
    printf 'gh %s\\n' "$*" >> "$WIZARD_CALL_LOG"
    if [[ "\${WIZARD_FAIL_WORKFLOW_DISPATCH:-}" == "1" ]]; then
      exit 1
    fi
    ;;
  *) printf 'unexpected gh call: %s\\n' "$*" >&2; exit 9 ;;
esac
`,
  );
  await fakeCommand(
    directory,
    "git",
    `
case "\${1:-} \${2:-}" in
  "branch --show-current")
    if [[ "\${WIZARD_POST_MERGE_MAIN:-}" == "1" ]]; then
      printf 'main\\n'
    else
      printf 'tailscale-phone-localhost-testing\\n'
    fi
    ;;
  "fetch origin") printf 'git %s\\n' "$*" >> "$WIZARD_CALL_LOG" ;;
  "status --porcelain")
    printf 'git %s\\n' "$*" >> "$WIZARD_CALL_LOG"
    if [[ "\${WIZARD_DIRTY_POST_MERGE:-}" == "1" ]]; then
      printf ' M wrangler.main-preview.jsonc\\n'
    fi
    ;;
  "rev-parse HEAD")
    printf 'git %s\\n' "$*" >> "$WIZARD_CALL_LOG"
    printf '0123456789abcdef0123456789abcdef01234567\\n'
    ;;
  "rev-parse origin/main")
    printf 'git %s\\n' "$*" >> "$WIZARD_CALL_LOG"
    printf '0123456789abcdef0123456789abcdef01234567\\n'
    ;;
  *)
    printf 'git %s\\n' "$*" >> "$WIZARD_CALL_LOG"
  if [[ "\${WIZARD_FAIL_FIRST_PUSH:-}" == "1" && ! -f "$WIZARD_PUSH_FAILED_MARKER" ]]; then
    : > "$WIZARD_PUSH_FAILED_MARKER"
    exit 1
  fi
    ;;
esac
`,
  );
  await fakeCommand(
    directory,
    "npx",
    `
if [[ "\${1:-} \${2:-}" == "wrangler whoami" ]]; then
  printf 'npx wrangler whoami\\n' >> "$WIZARD_CALL_LOG"
elif [[ "\${1:-} \${2:-} \${3:-}" == "wrangler secret put" ]]; then
  IFS= read -r secret || true
  printf 'wrangler secret put %s bytes=%s\\n' "$4" "\${#secret}" >> "$WIZARD_CALL_LOG"
elif [[ "\${1:-} \${2:-}" == "wrangler login" ]]; then
  printf 'npx wrangler login\\n' >> "$WIZARD_CALL_LOG"
else
  printf 'unexpected npx call: %s\\n' "$*" >&2
  exit 9
fi
`,
  );
  await fakeCommand(
    directory,
    "node",
    `
IFS= read -r secret || true
printf 'node validate-openai-key bytes=%s\\n' "\${#secret}" >> "$WIZARD_CALL_LOG"
`,
  );
  await fakeCommand(
    directory,
    "openssl",
    `printf 'generated-signing-secret-for-tests-1234567890ABCDEFGHIJ\\n'`,
  );
  await fakeCommand(
    directory,
    "open",
    `printf 'open %s\\n' "$1" >> "$WIZARD_CALL_LOG"`,
  );

  const result = await new Promise<{ stdout: string; stderr: string; exitCode: number | null }>(
    (resolve, reject) => {
      const child = spawn("bash", [scriptUrl.pathname], {
        cwd: new URL("..", import.meta.url).pathname,
        env: {
          ...process.env,
          PATH: `${directory}${delimiter}${process.env.PATH}`,
          WIZARD_CALL_LOG: logPath,
          WIZARD_FAIL_FIRST_PUSH: options?.failFirstPush ? "1" : "0",
          WIZARD_PUSH_FAILED_MARKER: join(directory, "push-failed"),
          WIZARD_POST_MERGE_MAIN: options?.postMergeMain ? "1" : "0",
          WIZARD_DIRTY_POST_MERGE: options?.dirtyPostMerge ? "1" : "0",
          WIZARD_FAIL_GATE_WRITE: options?.failGateWrite ? "1" : "0",
          WIZARD_FAIL_GATE_READBACK_AFTER_ARM: options?.failGateReadbackAfterArm
            ? "1"
            : "0",
          WIZARD_FAIL_WORKFLOW_DISPATCH: options?.failWorkflowDispatch ? "1" : "0",
          WIZARD_FAIL_DISARM_READBACK: options?.failDisarmReadback ? "1" : "0",
          WIZARD_GATE_STATE_FILE: join(directory, "gate-state"),
          WIZARD_GATE_ARMED_MARKER: join(directory, "gate-armed"),
          CONDUCTOR_WORKSPACE_NAME: options?.conductorSession ? "vientiane" : "",
          CLAUDE_AGENT_SDK_VERSION: "",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8").on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.setEncoding("utf8").on("data", (chunk) => {
        stderr += chunk;
      });
      child.once("error", reject);
      child.once("close", (code) => {
        if (code === 0 || options?.allowFailure) {
          resolve({ stdout, stderr, exitCode: code });
        } else {
          reject(new Error(`wizard exited ${code}: ${stderr}`));
        }
      });
      child.stdin.end(input);
    },
  );

  return {
    ...result,
    calls: await readFile(logPath, "utf8"),
    gateState: await readFile(join(directory, "gate-state"), "utf8").catch(
      () => "missing",
    ),
  };
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("main preview setup wizard", () => {
  it("is the canonical npm setup entry point", async () => {
    const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));

    expect(packageJson.scripts["setup:main-preview"]).toBe(
      "bash scripts/setup-main-preview.sh",
    );
  });

  it("reuses GitHub auth, streams secrets, and stays dormant by default", async () => {
    const password = "owl7";
    const openAiKey = "sk-production-secret-value";
    const cloudflareToken = "cloudflare-token-secret-value";
    const accountId = "0123456789abcdef0123456789abcdef";
    const { calls, stdout, stderr } = await runWizard(
      [
        "",
        password,
        password,
        openAiKey,
        "y",
        accountId,
        cloudflareToken,
        "y",
        "",
        "",
      ].join("\n"),
    );

    expect(calls).toContain("gh auth status");
    expect(calls).not.toContain("gh auth login");
    expect(calls).not.toContain("gh auth setup-git");
    expect(calls).toContain("git push -u origin HEAD");
    expect(calls).toContain("wrangler secret put PORTFOLIO_MAIN_PREVIEW_PASSWORD");
    expect(calls).toContain("wrangler secret put PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET");
    expect(calls).toContain("wrangler secret put OPENAI_API_KEY");
    expect(calls).toContain(
      "gh secret set CLOUDFLARE_API_TOKEN --env portfolio-main-preview",
    );
    expect(calls).toContain(
      "gh secret set CLOUDFLARE_ACCOUNT_ID --env portfolio-main-preview",
    );
    expect(calls).toContain(
      "gh variable set PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED --body false",
    );
    expect(calls).not.toContain(
      "gh variable set PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED --body true",
    );

    const observableOutput = `${stdout}\n${stderr}\n${calls}`;
    for (const secret of [password, openAiKey, cloudflareToken]) {
      expect(observableOutput).not.toContain(secret);
    }
  });

  it("arms deployment only after the operator types ACTIVATE", async () => {
    const { calls } = await runWizard(
      [
        "",
        "draft-password-123456789",
        "draft-password-123456789",
        "sk-production-secret-value",
        "y",
        "0123456789abcdef0123456789abcdef",
        "cloudflare-token-secret-value",
        "y",
        "",
        "ACTIVATE",
      ].join("\n"),
    );

    expect(calls).toContain(
      "gh variable set PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED --body false",
    );
    expect(calls).toContain(
      "gh variable set PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED --body true",
    );
  });

  it("downloads and displays the successful main artifact digest before dispatching its bound first deployment", async () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const digest =
      "1378156dd3da8d1386d8301b469d552c1177fd8219d2c316e688ec9a78ef6c63";
    const { calls, stdout } = await runWizard(
      [
        "",
        "draft-password-123456789",
        "draft-password-123456789",
        "sk-production-secret-value",
        "y",
        "0123456789abcdef0123456789abcdef",
        "cloudflare-token-secret-value",
        "y",
        "",
        "ACTIVATE",
      ].join("\n"),
      { postMergeMain: true },
    );

    expect(calls).toContain("git fetch origin main:refs/remotes/origin/main");
    expect(calls).toContain("git rev-parse HEAD");
    expect(calls).toContain("git rev-parse origin/main");
    expect(calls).not.toContain("git push -u origin HEAD");
    expect(calls).not.toContain("gh pr create");
    expect(calls).toContain(
      `gh run list --workflow ci.yml --branch main --commit ${sha} --event push --status success --json databaseId --jq .[0].databaseId`,
    );
    expect(calls).toMatch(
      new RegExp(
        "gh run download 123456789 --repo braininavatgroup/portfolio --name portfolio-main-preview-" +
          sha +
          " --dir .+/dist",
      ),
    );
    expect(stdout).toContain(sha);
    expect(stdout).toContain(digest);
    expect(calls).toContain(
      "gh variable set PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED --body true",
    );
    expect(calls).toContain(
      "gh workflow run deploy-main-preview.yml --repo braininavatgroup/portfolio --ref main --field source_run_id=123456789 --field source_sha=" +
        sha +
        " --field expected_dist_digest=" +
        digest,
    );
    expect(calls).not.toContain("gh run rerun");
    expect(
      calls.indexOf("gh run download 123456789"),
    ).toBeLessThan(
      calls.indexOf(
        "gh variable set PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED --body true",
      ),
    );
    expect(
      calls.indexOf("gh variable set PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED --body true"),
    ).toBeLessThan(calls.indexOf("gh workflow run deploy-main-preview.yml"));
  });

  it("rejects a dirty merged-main checkout before handling credentials or secrets", async () => {
    const { calls, stderr, exitCode } = await runWizard("\n", {
      postMergeMain: true,
      dirtyPostMerge: true,
      allowFailure: true,
    });

    expect(exitCode).not.toBe(0);
    expect(calls).toContain("git status --porcelain");
    expect(stderr).toContain("clean checkout");
    expect(calls).not.toContain("node validate-openai-key");
    expect(calls).not.toContain("wrangler secret put");
    expect(calls).not.toContain("gh secret set");
  });

  it("fails closed without dispatching when deployment-gate arming fails", async () => {
    const { calls, stderr, exitCode } = await runWizard(
      [
        "",
        "draft-password-123456789",
        "draft-password-123456789",
        "sk-production-secret-value",
        "y",
        "0123456789abcdef0123456789abcdef",
        "cloudflare-token-secret-value",
        "y",
        "",
        "ACTIVATE",
      ].join("\n"),
      { postMergeMain: true, failGateWrite: true, allowFailure: true },
    );

    expect(exitCode).not.toBe(0);
    expect(calls).toContain(
      "gh variable set PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED --body true",
    );
    expect(calls).not.toContain("gh workflow run deploy-main-preview.yml");
    expect(stderr).toContain("could not be armed");
  });

  it("compensates to verified false when the successful true write cannot be read back", async () => {
    const { calls, gateState, stdout, stderr, exitCode } = await runWizard(
      [
        "",
        "draft-password-123456789",
        "draft-password-123456789",
        "sk-production-secret-value",
        "y",
        "0123456789abcdef0123456789abcdef",
        "cloudflare-token-secret-value",
        "y",
        "",
        "ACTIVATE",
      ].join("\n"),
      {
        postMergeMain: true,
        failGateReadbackAfterArm: true,
        allowFailure: true,
      },
    );

    expect(exitCode).not.toBe(0);
    expect(calls).toContain(
      "gh variable set PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED --body true",
    );
    expect(calls).toContain(
      "gh variable set PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED --body false",
    );
    expect(gateState).toBe("false");
    expect(calls).not.toContain("gh workflow run deploy-main-preview.yml");
    expect(stdout + "\n" + stderr).not.toContain("Deployment is armed");
  });

  it("compensates to verified false when the manual first-deployment dispatch fails", async () => {
    const { calls, gateState, stdout, stderr, exitCode } = await runWizard(
      [
        "",
        "draft-password-123456789",
        "draft-password-123456789",
        "sk-production-secret-value",
        "y",
        "0123456789abcdef0123456789abcdef",
        "cloudflare-token-secret-value",
        "y",
        "",
        "ACTIVATE",
      ].join("\n"),
      {
        postMergeMain: true,
        failWorkflowDispatch: true,
        allowFailure: true,
      },
    );

    expect(exitCode).not.toBe(0);
    expect(calls).toContain("gh workflow run deploy-main-preview.yml");
    expect(calls).toContain(
      "gh variable set PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED --body false",
    );
    expect(gateState).toBe("false");
    expect(stdout + "\n" + stderr).not.toContain("Deployment is armed");
    expect(stderr).toContain("dispatch failed");
  });

  it("prints a high-signal fail-closed warning when compensating disarm cannot be verified", async () => {
    const { stderr, exitCode } = await runWizard(
      [
        "",
        "draft-password-123456789",
        "draft-password-123456789",
        "sk-production-secret-value",
        "y",
        "0123456789abcdef0123456789abcdef",
        "cloudflare-token-secret-value",
        "y",
        "",
        "ACTIVATE",
      ].join("\n"),
      {
        postMergeMain: true,
        failGateReadbackAfterArm: true,
        failDisarmReadback: true,
        allowFailure: true,
      },
    );

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("FAIL-CLOSED WARNING");
    expect(stderr).toContain("PORTFOLIO_MAIN_PREVIEW_CUSTOM_DOMAIN_DEPLOY_ENABLED");
    expect(stderr).toContain("could not verify false");
  });

  it("does not broaden the App when a personal credential rejects the push", async () => {
    const { calls, stderr, exitCode } = await runWizard("\n", {
      failFirstPush: true,
      allowFailure: true,
    });

    expect(exitCode).not.toBe(0);
    expect(calls.match(/git push -u origin HEAD/g)).toHaveLength(1);
    expect(calls).not.toContain("settings/installations");
    expect(stderr).toContain("Do not broaden the biv-agent App permissions");
    expect(stderr).toContain("gh auth refresh -h github.com -s workflow");
  });

  it("refuses to push from a Conductor agent credential session", async () => {
    const { calls, stderr, exitCode } = await runWizard("\n", {
      conductorSession: true,
      allowFailure: true,
    });

    expect(exitCode).not.toBe(0);
    expect(calls).not.toContain("git push");
    expect(calls).not.toContain("gh auth setup-git");
    expect(stderr).toContain("outside Conductor");
    expect(stderr).toContain("npm run setup:main-preview");
  });
});
