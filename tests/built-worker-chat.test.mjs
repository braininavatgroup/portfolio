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
    WRANGLER_SEND_METRICS: "false",
  };
  for (const name of [
    "OPENAI_API_KEY",
    "OPENAI_PORTFOLIO_MODEL",
    "PORTFOLIO_CHAT_IDENTIFIER_SECRET",
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

async function fetchBuiltWorker(request, environment = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    request,
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      ...environment,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

const protectedEnvironment = {
  PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED: "true",
  PORTFOLIO_MAIN_PREVIEW_PASSWORD: "correct horse battery staple",
  PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET:
    "a-long-independent-session-signing-secret-for-preview-only",
};

test("the built Worker exposes one always-registered portfolio chat route", async () => {
  const port = await availablePort();
  const worker = await startBuiltWorker(port);

  try {
    const chatResponse = await fetch(
      `http://127.0.0.1:${port}/api/portfolio-chat`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "How does pitching work?" }),
        signal: AbortSignal.timeout(5_000),
      },
    );
    assert.equal(chatResponse.status, 503);
    assert.deepEqual(await chatResponse.json(), {
      code: "misconfigured",
      message: "Ask the portfolio is not configured.",
    });
  } finally {
    await worker.stop();
  }
});

test("the built Worker does not register the retired preview endpoint", async () => {
  const response = await fetchBuiltWorker(
    new Request("http://localhost/api/portfolio-chat/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessCode: "must-not-matter" }),
    }),
  );

  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  // The status is what proves the route is gone. This second assertion proves
  // it is the app's own not-found page rather than an error page, which shares
  // the same `recovery-page` shell — so match the heading, not the class. It
  // used to look for `>404</h1>`, the framework's default page, which this
  // branch replaced with a real not-found route.
  assert.match(await response.text(), />No page here\.<\/h1>/i);
});

test("the built Worker preserves local development without an asset binding", async () => {
  const response = await fetchBuiltWorker(
    new Request("http://localhost/"),
    { ASSETS: undefined },
  );

  assert.equal(response.status, 200);
  assert.match(await response.text(), /class=["'][^"']*portfolio-reader[^"']*["']/i);
});

test("the built Worker gates static assets before touching the asset binding", async () => {
  let assetCalls = 0;
  const response = await fetchBuiltWorker(
    new Request("https://preview.example/protected.css", {
      headers: { accept: "text/css,*/*;q=0.1" },
    }),
    {
      ...protectedEnvironment,
      ASSETS: {
        fetch: async () => {
          assetCalls += 1;
          return new Response("protected asset");
        },
      },
    },
  );

  assert.equal(response.status, 303);
  assert.equal(assetCalls, 0);
  assert.match(
    response.headers.get("location") ?? "",
    /^\/_portfolio-preview\/login\?next=/,
  );
});

test("the built Worker serves bound static assets after password authentication", async () => {
  const login = await fetchBuiltWorker(
    new Request("https://preview.example/_portfolio-preview/login?next=%2Fprotected.css", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        password: protectedEnvironment.PORTFOLIO_MAIN_PREVIEW_PASSWORD,
      }),
    }),
    protectedEnvironment,
  );
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
  assert.equal(login.status, 303);
  assert.ok(cookie);

  let assetCalls = 0;
  const response = await fetchBuiltWorker(
    new Request("https://preview.example/protected.css", {
      headers: { cookie },
    }),
    {
      ...protectedEnvironment,
      ASSETS: {
        fetch: async () => {
          assetCalls += 1;
          return new Response("protected asset", {
            headers: { "content-type": "text/css" },
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "protected asset");
  assert.equal(
    response.headers.get("x-robots-tag"),
    "noindex, nofollow, noarchive",
  );
  assert.equal(assetCalls, 1);
});

// The first-party insight sink ships dormant. The built Worker must register
// the route (the client beacons to it unconditionally once analytics is
// eligible) and answer 204 with nothing else, whether or not a dataset is
// bound; the local dev config binds none, which is the dormant shape exactly.
test("the built Worker accepts insight beacons silently while the sink is dormant", async () => {
  const port = await availablePort();
  const worker = await startBuiltWorker(port);

  try {
    const beacon = await fetch(`http://127.0.0.1:${port}/api/portfolio-insight`, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ action: "entry", dimensions: { entry_source: "direct" } }),
      signal: AbortSignal.timeout(5_000),
    });
    assert.equal(beacon.status, 204);
    assert.equal(await beacon.text(), "");
    assert.equal(beacon.headers.get("cache-control"), "no-store");

    const probe = await fetch(`http://127.0.0.1:${port}/api/portfolio-insight`, {
      signal: AbortSignal.timeout(5_000),
    });
    assert.equal(probe.status, 405);
  } finally {
    await worker.stop();
  }
});
