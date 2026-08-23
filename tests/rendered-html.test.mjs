import assert from "node:assert/strict";
import test from "node:test";

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
  assert.match(html, />Explore the work</i);
  assert.doesNotMatch(html, /<header class=["']experience-header["']>[\s\S]*?<nav/i);
  assert.doesNotMatch(html, />All work</i);
  assert.match(html, /for=["']portfolio-question["']/i);
  assert.match(html, /id=["']portfolio-question["']/i);
  assert.match(
    html,
    /placeholder=["']Ask about the work, decisions, or outcomes\.["']/i,
  );
  assert.doesNotMatch(html, /Try one of the rotating questions/i);
  assert.match(html, /aria-live=["']polite["']/i);
  assert.doesNotMatch(html, /No external model is called/i);
  assert.doesNotMatch(html, /Local tool/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
});

test("map entry reveals view switching and compact keyboard access", async () => {
  const response = await render("/?view=graph");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /aria-current=["']page["'][^>]*>Map</i);
  assert.match(html, /href=["']\/work["'][^>]*>All work</i);
  assert.match(html, />Explore by keyboard</i);
  assert.doesNotMatch(html, />Keyboard map</i);
  assert.doesNotMatch(html, />Explore the work</i);
});
