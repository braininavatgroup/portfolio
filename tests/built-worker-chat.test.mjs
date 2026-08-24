import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";

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

async function startBuiltWorker(port) {
  const wrangler = new URL("../node_modules/.bin/wrangler", import.meta.url)
    .pathname;
  const childEnvironment = {
    ...process.env,
    PORTFOLIO_CHAT_LIVE_ENABLED: "false",
    PORTFOLIO_CHAT_PREVIEW_ENABLED: "false",
    WRANGLER_SEND_METRICS: "false",
  };
  for (const name of [
    "OPENAI_API_KEY",
    "OPENAI_PORTFOLIO_MODEL",
    "PORTFOLIO_CHAT_PREVIEW_ACCESS_CODE",
    "PORTFOLIO_CHAT_SESSION_SECRET",
    "TURNSTILE_SECRET_KEY",
  ]) {
    delete childEnvironment[name];
  }
  const child = spawn(
    wrangler,
    [
      "dev",
      "--config",
      "dist/server/wrangler.json",
      "--local",
      "--port",
      String(port),
      "--ip",
      "127.0.0.1",
      "--no-bundle",
    ],
    {
      cwd: new URL("..", import.meta.url),
      env: childEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let output = "";
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Built Worker did not start.\n${output}`));
    }, 20_000);
    const receive = (chunk) => {
      output += chunk.toString();
      if (output.includes(`Ready on http://127.0.0.1:${port}`)) {
        clearTimeout(timeout);
        resolve();
      }
    };
    child.stdout.on("data", receive);
    child.stderr.on("data", receive);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Built Worker exited with ${code}.\n${output}`));
    });
  });

  await ready;
  return {
    child,
    async stop() {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    },
  };
}

test("the built Worker keeps both portfolio chat routes disabled", async () => {
  const port = await availablePort();
  const worker = await startBuiltWorker(port);

  try {
    for (const pathname of [
      "/api/portfolio-chat",
      "/api/portfolio-chat/preview",
    ]) {
      const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: `http://127.0.0.1:${port}`,
        },
        body: JSON.stringify({
          accessCode: "must-not-matter",
          question: "How does pitching work?",
        }),
        signal: AbortSignal.timeout(5_000),
      });

      const body = await response.json();
      assert.equal(response.status, 503, `${pathname}: ${JSON.stringify(body)}`);
      assert.deepEqual(body, {
        code: "disabled",
        message: "Ask the portfolio is not enabled.",
      });
    }
  } finally {
    await worker.stop();
  }
});
