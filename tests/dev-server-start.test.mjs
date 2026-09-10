import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import test from "node:test";
import { stripVTControlCharacters } from "node:util";

const projectRoot = new URL("..", import.meta.url);

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (!port) throw new Error("Could not allocate a local test port.");
  return port;
}

async function stopProcessGroup(child) {
  if (child.exitCode !== null || !child.pid) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  if (child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error.code === "ESRCH") return;
    throw error;
  }
  await exited;
}

test("the Conductor development command starts without a Workerd dependency failure", async () => {
  const port = await availablePort();
  const child = spawn(
    "npm",
    [
      "run",
      "dev",
      "--",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
      "--force",
    ],
    {
      cwd: projectRoot,
      detached: true,
      env: {
        ...process.env,
        OPENAI_API_KEY: "sk-development-smoke-sentinel",
        WRANGLER_LOG_PATH: ".wrangler/dev-smoke.log",
        WRANGLER_SEND_METRICS: "false",
        WRANGLER_WRITE_LOGS: "false",
      },
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

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Development server did not become ready.\n${output}`));
      }, 60_000);
      const poll = setInterval(() => {
        if (
          stripVTControlCharacters(output).includes(
            `http://localhost:${port}/`,
          )
        ) {
          clearInterval(poll);
          clearTimeout(timeout);
          resolve();
        }
      }, 250);
      child.once("exit", (code) => {
        clearInterval(poll);
        clearTimeout(timeout);
        reject(new Error(`Development server exited with ${code}.\n${output}`));
      });
    });
    await new Promise((resolve, reject) => {
      const grace = setTimeout(resolve, 2_000);
      child.once("exit", (code) => {
        clearTimeout(grace);
        reject(new Error(`Development server exited with ${code}.\n${output}`));
      });
    });

    assert.equal(child.exitCode, null, output);
    assert.match(
      stripVTControlCharacters(output),
      new RegExp(`http://localhost:${port}/`),
    );
    assert.doesNotMatch(output, /Error during dependency optimization/);
  } finally {
    await stopProcessGroup(child);
  }
});

test("Conductor gives every local workspace an isolated default run command", async () => {
  const settings = await readFile(
    new URL("../.conductor/settings.toml", import.meta.url),
    "utf8",
  );

  assert.match(settings, /setup = "bash scripts\/bootstrap-worktree\.sh"/);
  assert.match(settings, /run_mode = "concurrent"/);
  assert.match(settings, /available_in = \[ "local" \]/);
  assert.match(
    settings,
    /command = "npm run dev -- --host 127\.0\.0\.1 --port \$CONDUCTOR_PORT --strictPort"/,
  );
  assert.match(settings, /default = true/);
});
