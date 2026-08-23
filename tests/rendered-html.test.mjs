import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
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
  assert.match(html, /href=["']\/work["']/i);
  assert.match(html, /for=["']portfolio-question["']/i);
  assert.match(html, /id=["']portfolio-question["']/i);
  assert.match(html, /aria-live=["']polite["']/i);
  assert.doesNotMatch(html, /No external model is called/i);
  assert.doesNotMatch(html, /Local tool/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
});
