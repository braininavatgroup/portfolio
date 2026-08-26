import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import test from "node:test";

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

test("the Conductor development command serves the portfolio", async () => {
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
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Development server did not become ready.\n${output}`));
      }, 60_000);
      const poll = setInterval(async () => {
        try {
          const candidate = await fetch(`http://127.0.0.1:${port}/`, {
            signal: AbortSignal.timeout(10_000),
          });
          const body = await candidate.text();
          clearInterval(poll);
          clearTimeout(timeout);
          resolve({ body, status: candidate.status });
        } catch {
          // The server is still starting.
        }
      }, 250);
      child.once("exit", (code) => {
        clearInterval(poll);
        clearTimeout(timeout);
        reject(new Error(`Development server exited with ${code}.\n${output}`));
      });
    });

    assert.equal(response.status, 200, output);
    assert.match(response.body, /Bradley Berkman/i);
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

  assert.match(settings, /setup = "npm ci"/);
  assert.match(settings, /run_mode = "concurrent"/);
  assert.match(settings, /available_in = \[ "local" \]/);
  assert.match(
    settings,
    /command = "npm run dev -- --host 127\.0\.0\.1 --port \$CONDUCTOR_PORT --strictPort"/,
  );
  assert.match(settings, /default = true/);
});
