import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const entryPath = `${directory}/${entry.name}`;
        return entry.isDirectory() ? filesBelow(entryPath) : [entryPath];
      }),
    )
  ).flat();
}

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the portfolio shell and accessibility exits", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Bradley Berkman \| Judgment at the center<\/title>/i);
  assert.match(html, /href=["']#main-content["'][^>]*>Skip to portfolio content</i);
  assert.match(html, /<main[^>]*id=["']main-content["']/i);
  assert.match(html, /<main[^>]*data-theme=["']light["']/i);
  assert.doesNotMatch(html, />Explore the work</i);
  assert.match(html, /class=["'][^"']*portfolio-header[^"']*["']/i);
  assert.match(html, /aria-current=["']page["'][^>]*>Map</i);
  assert.match(html, /href=["']\/work["'][^>]*>Work</i);
  assert.match(html, /aria-label=["']Portfolio index["']/i);
  assert.match(html, /Give small operators larger-operator leverage/i);
  assert.match(html, /href=["']\/work\/dubs["']/i);
  assert.match(html, /for=["']portfolio-question["']/i);
  assert.match(html, /id=["']portfolio-question["']/i);
  assert.match(
    html,
    /placeholder=["']Ask about the work, decisions, or outcomes\.["']/i,
  );
  assert.doesNotMatch(html, /Try one of the rotating questions/i);
  assert.doesNotMatch(html, /No external model is called/i);
  assert.doesNotMatch(html, /Local tool/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
});

test("the homepage opens directly on the map with its synchronized index", async () => {
  const response = await render("/?view=graph");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<main[^>]*data-theme=["']light["']/i);
  assert.match(html, /aria-current=["']page["'][^>]*>Map</i);
  assert.match(html, /href=["']\/work["'][^>]*>Work</i);
  assert.match(html, /aria-label=["']Spatial portfolio map["']/i);
  assert.match(html, /aria-label=["']Portfolio index["']/i);
  assert.match(html, /Music promotion/i);
  assert.match(html, /Campaign kickoff and intake/i);
  const keyboardButton = [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)]
    .find(([, content]) => /Explore by keyboard/i.test(content));
  assert.ok(keyboardButton, "keyboard entry is rendered inside one button");
  assert.doesNotMatch(html, />Keyboard map</i);
  assert.doesNotMatch(html, />Explore the work</i);
});

test("the production build does not inline server secrets into artifacts", async () => {
  const clientDirectory = new URL("../dist/client", import.meta.url).pathname;
  const clientFiles = (await filesBelow(clientDirectory)).filter((entryPath) =>
    /\.(?:js|json|map)$/.test(entryPath),
  );
  const clientArtifacts = (
    await Promise.all(clientFiles.map((entryPath) => readFile(entryPath, "utf8")))
  ).join("\n");
  for (const serverOnlyValue of [
    "OPENAI_API_KEY",
    "OPENAI_PORTFOLIO_MODEL",
    "PORTFOLIO_CHAT_LIVE_ENABLED",
    "api.openai.com",
  ]) {
    assert.doesNotMatch(clientArtifacts, new RegExp(serverOnlyValue));
  }

  const distDirectory = new URL("../dist", import.meta.url).pathname;
  const builtFiles = (await filesBelow(distDirectory)).filter((entryPath) =>
    /\.(?:js|json|map)$/.test(entryPath),
  );
  const builtArtifacts = (
    await Promise.all(builtFiles.map((entryPath) => readFile(entryPath, "utf8")))
  ).join("\n");
  for (const sentinel of [
    "sk-client-leak-sentinel",
    "model-client-leak-sentinel",
    "preview-access-client-leak-sentinel",
    "session-secret-client-leak-sentinel",
    "turnstile-secret-client-leak-sentinel",
  ]) {
    assert.doesNotMatch(builtArtifacts, new RegExp(sentinel));
  }
});
