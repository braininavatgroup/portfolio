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

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
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

test("server-renders the accepted composition as the landing state", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Bradley Berkman \| I build tools and systems that make space to think<\/title>/i);
  assert.match(
    html,
    /<meta[^>]*name=["']viewport["'][^>]*content=["'][^"']*interactive-widget=resizes-content/i,
  );
  assert.match(html, /href=["']#main-content["'][^>]*>Skip to portfolio content</i);
  assert.match(html, /<div[^>]*id=["']app-shell["']/i);
  assert.doesNotMatch(html, /avatar-toybox-root/i);
  assert.match(html, /<main[^>]*id=["']main-content["']/i);
  assert.match(html, /<main[^>]*tabindex=["']-1["']/i);
  assert.match(html, /id=["']cursorInstrument["']/i);
  assert.match(html, /class=["'][^"']*portfolio-composition[^"']*["']/i);
  assert.doesNotMatch(html, /class=["'][^"']*portfolio-header[^"']*["']/i);
  assert.match(html, /aria-label=["']Spatial portfolio world["']/i);
  assert.match(html, /data-reader-mode=["']about["']/i);
  assert.doesNotMatch(html, /<h1>Index<\/h1>/i);
  assert.doesNotMatch(html, />Enter map</i);
  assert.match(html, /aria-label=["']Portfolio home["']/i);
  assert.doesNotMatch(html, /Give small operators larger-operator leverage/i);
  assert.doesNotMatch(html, /Bradley Berkman portfolio/i);
  assert.doesNotMatch(html, /Click anywhere to step inside, then follow the work outward\./i);
  assert.doesNotMatch(html, />Explore the work</i);
  assert.doesNotMatch(html, />Replay intro</i);
  assert.doesNotMatch(html, />All work</i);
  assert.match(html, /for=["']portfolio-question["']/i);
  assert.match(html, /id=["']portfolio-question["']/i);
  assert.match(
    html,
    /placeholder=["']Ask about the portfolio["']/i,
  );
  assert.match(html, /aria-label=["']Portfolio reading room["']/i);
  assert.match(html, /data-reading-room-slot=["']main["']/i);
  assert.match(html, /aria-label=["']Portfolio Guide["']/i);
  assert.doesNotMatch(html, /Open portfolio assistant|portfolio-chat-panel/i);
  assert.doesNotMatch(html, /Try one of the rotating questions/i);
  assert.doesNotMatch(html, /No external model is called/i);
  assert.doesNotMatch(html, /Local tool/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
  assert.doesNotMatch(html, /Avatar developer controls|avatarDebug/i);
});

test("the homepage opens directly on the map with About as home, headed by name", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /class=["'][^"']*portfolio-composition[^"']*["']/i);
  assert.doesNotMatch(html, /class=["'][^"']*portfolio-header[^"']*["']/i);
  assert.match(html, /data-reader-mode=["']about["']/i);
  assert.doesNotMatch(html, /<h1>Index<\/h1>/i);
  assert.match(html, /<h1>Bradley Berkman<\/h1>/i);
  assert.match(html, /aria-label=["']Spatial portfolio world["']/i);
  assert.match(html, /aria-label=["']Portfolio home["']/i);
  // The Contents column and the inline practice links ship in the HTML.
  assert.match(html, /aria-label=["']Portfolio contents["']/i);
  assert.doesNotMatch(html, /aria-label=["']Portfolio index["']/i);
  assert.match(html, /class=["']reader-inline-link["'][^>]*data-register=["']warm["']/i);
  // Every record label and thread title from the content document ships in
  // the HTML, whatever the copy currently says.
  const content = JSON.parse(
    await readFile(new URL("../content/portfolio-content.json", import.meta.url), "utf8"),
  );
  for (const { label } of Object.values(content.records)) {
    assert.ok(html.includes(escapeHtml(label)), `missing record label ${label}`);
  }
  for (const { title } of Object.values(content.threads)) {
    assert.ok(html.includes(escapeHtml(title)), `missing thread title ${title}`);
  }
  assert.match(html, /data-world-node=["']bradley["']/i);
  assert.match(html, /data-family=["']identity["'][^>]*data-world-node=["']bradley["']/i);
  assert.match(html, /data-family=["']story["'][^>]*data-world-node=["']thread-/i);
  assert.doesNotMatch(html, /Explore by keyboard/i);
  assert.doesNotMatch(html, />Replay intro</i);
  assert.doesNotMatch(html, />Keyboard map</i);
  assert.doesNotMatch(html, />Enter map</i);
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
    "identifier-secret-client-leak-sentinel",
  ]) {
    assert.doesNotMatch(builtArtifacts, new RegExp(sentinel));
  }
});
