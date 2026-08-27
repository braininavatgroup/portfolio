import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmod,
  cp,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });
}

test("a manually created Git worktree installs current dependencies without duplicate work", async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "portfolio-worktrees-"));
  const repository = path.join(sandbox, "repository");
  const featureWorktree = path.join(sandbox, "feature");
  const fakeBin = path.join(sandbox, "bin");
  const installLog = path.join(sandbox, "npm-ci.log");
  const environment = {
    ...process.env,
    BOOTSTRAP_INSTALL_LOG: installLog,
    CONDUCTOR_IS_LOCAL: "1",
    PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
  };

  try {
    await mkdir(path.join(repository, "scripts"), { recursive: true });
    await mkdir(path.join(repository, ".githooks"), { recursive: true });
    await mkdir(fakeBin, { recursive: true });
    await cp(
      path.join(projectRoot, "scripts", "bootstrap-worktree.sh"),
      path.join(repository, "scripts", "bootstrap-worktree.sh"),
    );
    await cp(
      path.join(projectRoot, ".githooks", "post-checkout"),
      path.join(repository, ".githooks", "post-checkout"),
    );
    await writeFile(
      path.join(repository, "package.json"),
      '{"name":"bootstrap-fixture","private":true}\n',
    );
    await writeFile(
      path.join(repository, "package-lock.json"),
      '{"name":"bootstrap-fixture","lockfileVersion":3,"packages":{}}\n',
    );
    await writeFile(
      path.join(fakeBin, "npm"),
      `#!/usr/bin/env bash
set -euo pipefail
test "\${1:-}" = "ci"
printf '%s\\n' "$PWD" >> "$BOOTSTRAP_INSTALL_LOG"
mkdir -p node_modules/.bin
printf '#!/usr/bin/env bash\\n' > node_modules/.bin/vinext
chmod +x node_modules/.bin/vinext
`,
    );
    await chmod(path.join(fakeBin, "npm"), 0o755);
    await chmod(path.join(repository, ".githooks", "post-checkout"), 0o755);
    await chmod(path.join(repository, "scripts", "bootstrap-worktree.sh"), 0o755);

    run("git", ["init", "-b", "main", repository]);
    run("git", ["config", "user.name", "Bootstrap Test"], { cwd: repository });
    run("git", ["config", "user.email", "bootstrap@example.test"], {
      cwd: repository,
    });
    run("git", ["add", "."], { cwd: repository });
    run("git", ["commit", "-m", "fixture"], { cwd: repository });

    run("bash", ["scripts/bootstrap-worktree.sh"], {
      cwd: repository,
      env: environment,
    });
    assert.equal(
      run("git", ["config", "--local", "core.hooksPath"], {
        cwd: repository,
      }).trim(),
      ".githooks",
    );

    run("git", ["worktree", "add", "-b", "feature", featureWorktree], {
      cwd: repository,
      env: environment,
    });
    const canonicalRepository = await realpath(repository);
    const canonicalFeatureWorktree = await realpath(featureWorktree);
    assert.equal(
      await readFile(installLog, "utf8"),
      `${canonicalRepository}\n${canonicalFeatureWorktree}\n`,
    );

    run("bash", ["scripts/bootstrap-worktree.sh"], {
      cwd: featureWorktree,
      env: environment,
    });
    assert.equal(
      await readFile(installLog, "utf8"),
      `${canonicalRepository}\n${canonicalFeatureWorktree}\n`,
      "an unchanged lockfile should not reinstall dependencies",
    );

    await writeFile(
      path.join(featureWorktree, "package-lock.json"),
      '{"name":"bootstrap-fixture","lockfileVersion":3,"packages":{"":{"version":"1.0.0"}}}\n',
    );
    run("bash", ["scripts/bootstrap-worktree.sh"], {
      cwd: featureWorktree,
      env: environment,
    });
    assert.equal(
      await readFile(installLog, "utf8"),
      `${canonicalRepository}\n${canonicalFeatureWorktree}\n${canonicalFeatureWorktree}\n`,
      "a changed lockfile should refresh dependencies",
    );
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
