// Exercises the local writing runtime against a real temporary Git repository
// containing unrelated staged and unstaged changes, proving the guards and
// the content-only commit boundary.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import realContent from "../../content/portfolio-content.json";
import {
  COMMIT_MESSAGE,
  PortfolioWritingRuntime,
} from "./vite-writing-plugin";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function createRepo({ branch = "writing-session" }: { branch?: string } = {}) {
  const repo = mkdtempSync(path.join(tmpdir(), "portfolio-writing-"));
  cleanups.push(() => rmSync(repo, { recursive: true, force: true }));
  git(repo, "init", "--initial-branch", branch);
  git(repo, "config", "user.name", "biv-agent[bot]");
  git(repo, "config", "user.email", "biv-agent@example.invalid");
  git(repo, "config", "commit.gpgsign", "false");
  mkdirSync(path.join(repo, "content"), { recursive: true });
  writeFileSync(
    path.join(repo, "content/portfolio-content.json"),
    `${JSON.stringify(realContent, null, 2)}\n`,
  );
  writeFileSync(path.join(repo, "unrelated.txt"), "original\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-m", "seed");
  return repo;
}

async function createRuntime(repo: string, commitDelayMs = 20) {
  return PortfolioWritingRuntime.create({ cwd: repo, commitDelayMs });
}

function requestContext(runtime: PortfolioWritingRuntime, overrides: Partial<{
  token: string | undefined;
  origin: string | undefined;
  host: string | undefined;
}> = {}) {
  return {
    token: runtime.token,
    origin: undefined,
    host: "localhost:3000",
    ...overrides,
  };
}

describe("PortfolioWritingRuntime", () => {
  it("issues a session with a token, revision, and branch", async () => {
    const repo = createRepo();
    const runtime = await createRuntime(repo);
    const session = runtime.session();
    expect(session.status).toBe(200);
    expect(session.body).toMatchObject({
      branch: "writing-session",
      revision: realContent.revision,
      writable: true,
    });
    expect(typeof session.body.token).toBe("string");
  });

  it("saves a valid edit atomically and bumps the revision on disk", async () => {
    const repo = createRepo();
    const runtime = await createRuntime(repo, 60_000);
    const result = await runtime.save(
      {
        path: "records.bradley.summary",
        value: "A new summary.",
        revision: realContent.revision,
      },
      requestContext(runtime),
    );
    expect(result).toMatchObject({
      status: 200,
      body: { revision: realContent.revision + 1, save: "saved" },
    });
    const onDisk = JSON.parse(
      readFileSync(path.join(repo, "content/portfolio-content.json"), "utf8"),
    );
    expect(onDisk.records.bradley.summary).toBe("A new summary.");
    expect(onDisk.revision).toBe(realContent.revision + 1);
  });

  it("rejects a stale revision without touching disk", async () => {
    const repo = createRepo();
    const runtime = await createRuntime(repo, 60_000);
    const result = await runtime.save(
      {
        path: "records.bradley.summary",
        value: "stale",
        revision: realContent.revision + 5,
      },
      requestContext(runtime),
    );
    expect(result.status).toBe(409);
    expect(result.body.code).toBe("stale-revision");
    const onDisk = JSON.parse(
      readFileSync(path.join(repo, "content/portfolio-content.json"), "utf8"),
    );
    expect(onDisk.records.bradley.summary).toBe(realContent.records.bradley.summary);
  });

  it("rejects invalid paths, structural fields, and bad payloads with 400", async () => {
    const repo = createRepo();
    const runtime = await createRuntime(repo, 60_000);
    for (const badPath of [
      "records.bradley.position",
      "records.unknown.summary",
      "revision",
    ]) {
      const result = await runtime.save(
        { path: badPath, value: "x", revision: realContent.revision },
        requestContext(runtime),
      );
      expect(result.status, badPath).toBe(400);
    }
    const nonString = await runtime.save(
      {
        path: "records.bradley.summary",
        value: 9,
        revision: realContent.revision,
      },
      requestContext(runtime),
    );
    expect(nonString.status).toBe(400);
  });

  it("rejects a missing or wrong token with 403", async () => {
    const repo = createRepo();
    const runtime = await createRuntime(repo, 60_000);
    const result = await runtime.save(
      {
        path: "records.bradley.summary",
        value: "x",
        revision: realContent.revision,
      },
      requestContext(runtime, { token: "wrong" }),
    );
    expect(result.status).toBe(403);
  });

  it("rejects a mismatched origin with 403", async () => {
    const repo = createRepo();
    const runtime = await createRuntime(repo, 60_000);
    const result = await runtime.save(
      {
        path: "records.bradley.summary",
        value: "x",
        revision: realContent.revision,
      },
      requestContext(runtime, { origin: "https://evil.example" }),
    );
    expect(result.status).toBe(403);
  });

  it("disables writes on main and master", async () => {
    for (const branch of ["main", "master"]) {
      const repo = createRepo({ branch });
      const runtime = await createRuntime(repo, 60_000);
      expect(runtime.writable).toBe(false);
      const result = await runtime.save(
        {
          path: "records.bradley.summary",
          value: "x",
          revision: realContent.revision,
        },
        requestContext(runtime),
      );
      expect(result.status).toBe(409);
      expect(result.body.code).toBe("branch");
    }
  });

  it("refuses to write after HEAD moves to another branch", async () => {
    const repo = createRepo();
    const runtime = await createRuntime(repo, 60_000);
    git(repo, "checkout", "-b", "another-branch");
    const result = await runtime.save(
      {
        path: "records.bradley.summary",
        value: "x",
        revision: realContent.revision,
      },
      requestContext(runtime),
    );
    expect(result.status).toBe(409);
    expect(result.body.code).toBe("branch");
  });

  it("commits only the content file while unrelated staged and unstaged changes exist", async () => {
    const repo = createRepo();
    const runtime = await createRuntime(repo, 60_000);
    // Unrelated worktree state that must never be swept into the commit.
    writeFileSync(path.join(repo, "staged.txt"), "staged\n");
    git(repo, "add", "staged.txt");
    writeFileSync(path.join(repo, "unrelated.txt"), "modified but unstaged\n");

    const save = await runtime.save(
      {
        path: "records.bradley.summary",
        value: "Committed summary.",
        revision: realContent.revision,
      },
      requestContext(runtime),
    );
    expect(save.status).toBe(200);
    await runtime.flush();

    const status = runtime.status(requestContext(runtime));
    expect(status.body.lastCommit).toMatchObject({ hash: expect.any(String) });

    const subject = git(repo, "log", "-1", "--pretty=%s");
    expect(subject).toBe(COMMIT_MESSAGE);
    const committedFiles = git(repo, "show", "--name-only", "--pretty=format:", "HEAD")
      .split("\n")
      .filter(Boolean);
    expect(committedFiles).toEqual(["content/portfolio-content.json"]);

    // Unrelated changes untouched: staged file still staged, unstaged intact.
    const porcelain = git(repo, "status", "--porcelain");
    expect(porcelain).toContain("A  staged.txt");
    expect(porcelain).toContain(" M unrelated.txt");
  });

  it("reports a commit failure while keeping the file save durable", async () => {
    const repo = createRepo();
    const runtime = await createRuntime(repo, 60_000);
    // A failing pre-commit hook stands in for any Git commit failure.
    const hookDir = path.join(repo, ".git", "hooks");
    const hookPath = path.join(hookDir, "pre-commit");
    writeFileSync(hookPath, "#!/bin/sh\nexit 1\n");
    chmodSync(hookPath, 0o755);

    const save = await runtime.save(
      {
        path: "records.bradley.summary",
        value: "Saved but not committed.",
        revision: realContent.revision,
      },
      requestContext(runtime),
    );
    expect(save.status).toBe(200);
    await runtime.flush();

    const status = runtime.status(requestContext(runtime));
    expect(status.body.lastCommit).toMatchObject({ error: expect.any(String) });
    const onDisk = JSON.parse(
      readFileSync(path.join(repo, "content/portfolio-content.json"), "utf8"),
    );
    expect(onDisk.records.bradley.summary).toBe("Saved but not committed.");
  });

  it("flushes one bounded commit at shutdown", async () => {
    const repo = createRepo();
    const runtime = await createRuntime(repo, 60_000);
    await runtime.save(
      {
        path: "records.bradley.summary",
        value: "Flushed at shutdown.",
        revision: realContent.revision,
      },
      requestContext(runtime),
    );
    // The 60s debounce has not fired; flush must commit anyway.
    await runtime.flush();
    const subject = git(repo, "log", "-1", "--pretty=%s");
    expect(subject).toBe(COMMIT_MESSAGE);
  });

  it("suppresses hot updates only for its own recent writes", async () => {
    const repo = createRepo();
    const runtime = await createRuntime(repo, 60_000);
    const contentPath = path.join(repo, "content/portfolio-content.json");
    expect(runtime.suppressesHotUpdate(contentPath)).toBe(false);
    await runtime.save(
      {
        path: "records.bradley.summary",
        value: "hot update suppression",
        revision: realContent.revision,
      },
      requestContext(runtime),
    );
    expect(runtime.suppressesHotUpdate(contentPath)).toBe(true);
    expect(runtime.suppressesHotUpdate(path.join(repo, "unrelated.txt"))).toBe(false);
    await runtime.flush();
  });

  it("preserves the previous file when the atomic write fails", async () => {
    const repo = createRepo();
    const runtime = await createRuntime(repo, 60_000);
    const contentDir = path.join(repo, "content");
    // Make the directory read-only so both the temp write and rename fail.
    chmodSync(contentDir, 0o500);
    cleanups.push(() => chmodSync(contentDir, 0o755));
    const result = await runtime.save(
      {
        path: "records.bradley.summary",
        value: "will not land",
        revision: realContent.revision,
      },
      requestContext(runtime),
    );
    chmodSync(contentDir, 0o755);
    expect(result.status).toBe(500);
    const onDisk = JSON.parse(
      readFileSync(path.join(repo, "content/portfolio-content.json"), "utf8"),
    );
    expect(onDisk.records.bradley.summary).toBe(realContent.records.bradley.summary);
  });
});
