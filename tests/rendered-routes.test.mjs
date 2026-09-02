import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import test from "node:test";

async function render(pathname) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
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

test("the flat index lists threads and every node with its canonical page", async () => {
  const response = await render("/index");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<main[^>]*data-theme=["']light["']/i);
  assert.match(html, /class=["'][^"']*portfolio-header[^"']*["']/i);
  assert.match(html, /href=["']\/["'][^>]*>Bradley Berkman</i);
  assert.match(html, /href=["']\/\?view=graph["'][^>]*>Map</i);
  assert.match(html, /<h1>Index<\/h1>/i);
  assert.doesNotMatch(html, /Evidence (available|partial|needed|undefined)/i);
  assert.doesNotMatch(html, /Career timeline/i);
  assert.doesNotMatch(html, /For AI product teams/i);
  assert.doesNotMatch(html, /case stud/i);

  assert.match(html, /id=["']threads["']/i);
  for (const groupId of [
    "about",
    "operations",
    "campaign",
    "client",
    "products",
  ]) {
    assert.match(html, new RegExp(`id=["']${groupId}["']`, "i"));
  }
  assert.match(html, /href=["']\/\?view=graph#thread\/making-work-playable["']/i);
  assert.equal(
    (html.match(/<li[^>]*class=["']index-entry["']/gi) ?? []).length,
    17,
    "the index renders four threads and thirteen nodes",
  );
  assert.equal(
    (html.match(/<span[^>]*class=["']portfolio-node-mark["'][^>]*>/gi) ?? [])
      .length,
    17,
    "every index row reuses its graph node mark",
  );
  assert.match(html, /class=["'][^"']*portfolio-node-mark[^"']*["'][^>]*data-family=["']story["']/i);
  assert.match(html, /class=["'][^"']*portfolio-node-mark[^"']*["'][^>]*data-register=["']warm["']/i);

  // The flat index links into the map reader; canonical /index/<id> URLs do the same.
  const nodeIds = new Set();
  for (const [, attributes] of html.matchAll(/<a\b([^>]*)>/gi)) {
    const nodeId = attributes.match(
      /\bhref=["']\/\?view=graph#(?!thread\/)([\w-]+)["']/i,
    )?.[1];
    if (nodeId) nodeIds.add(nodeId);
  }
  assert.equal(nodeIds.size, 13, "every node links into the map reader");

  for (const nodeId of nodeIds) {
    const response = await render(`/index/${nodeId}`);
    assert.ok(
      [301, 302, 307, 308].includes(response.status),
      `/index/${nodeId} redirects into the map`,
    );
    const location = new URL(
      response.headers.get("location"),
      "http://localhost",
    );
    assert.equal(location.pathname, "/");
    assert.equal(location.search, "?view=graph");
    assert.equal(location.hash, `#${nodeId}`);
  }
});

test("retired work routes stay retired", async () => {
  const indexResponse = await render("/work");
  assert.equal(indexResponse.status, 404);

  const workResponse = await render("/work/dubs");
  assert.equal(workResponse.status, 404);
});

test("the privacy route discloses analytics, replay masking, and opt-out", async () => {
  const response = await render("/privacy");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<h1>Privacy<\/h1>/i);
  assert.match(html, /Cloudflare edge analytics/i);
  assert.match(html, /Microsoft Clarity/i);
  assert.match(html, /Form inputs and the portfolio chat are masked/i);
  assert.match(html, /opt out or back in/i);
  assert.match(html, /mailto:bradley@bradleyberkman\.com/i);
});

test("the retired design-system snapshot is no longer shipped", async () => {
  const snapshotUrl = new URL(
    "../dist/client/design-system-current.html",
    import.meta.url,
  );
  await assert.rejects(() => stat(snapshotUrl));
});
