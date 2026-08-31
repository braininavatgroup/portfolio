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
  assert.match(html, /data-index-layout=["']stacked-editorial["']/i);
  assert.doesNotMatch(html, /class=["'][^"']*domain-heading-meta/i);
  assert.doesNotMatch(html, /class=["'][^"']*artifact-index-number/i);
  assert.doesNotMatch(html, /Evidence (available|partial|needed|undefined)/i);
  assert.doesNotMatch(html, /Career timeline/i);
  assert.doesNotMatch(html, /For AI product teams/i);
  assert.doesNotMatch(html, /case stud/i);

  assert.match(html, /id=["']threads["']/i);
  for (const groupId of [
    "about",
    "operations",
    "campaign",
    "personal",
    "client",
    "products",
  ]) {
    assert.match(html, new RegExp(`id=["']${groupId}["']`, "i"));
  }
  assert.match(html, /href=["']\/\?view=graph#thread\/making-work-playable["']/i);
  assert.equal(
    (html.match(/class=["'][^"']*artifact-index-entry[^"']*["']/gi) ?? [])
      .length,
    17,
    "stacked editorial index renders three threads and fourteen nodes",
  );

  // The standalone per-record pages were retired (2026-08-30): the flat index
  // links straight into the map reader, and old /index/<id> URLs redirect there.
  const nodeIds = new Set();
  for (const [, attributes] of html.matchAll(/<a\b([^>]*)>/gi)) {
    const nodeId = attributes.match(
      /\bhref=["']\/\?view=graph#(?!thread\/)([\w-]+)["']/i,
    )?.[1];
    if (nodeId) nodeIds.add(nodeId);
  }
  assert.equal(nodeIds.size, 14, "every node links into the map reader");

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

test("legacy work and case-study routes redirect to the canonical pages", async () => {
  const indexResponse = await render("/work");
  assert.ok([301, 302, 307, 308].includes(indexResponse.status));
  assert.equal(new URL(indexResponse.headers.get("location"), "http://localhost").pathname, "/index");

  const workResponse = await render("/work/dubs");
  assert.ok([301, 302, 307, 308].includes(workResponse.status));
  assert.equal(
    new URL(workResponse.headers.get("location"), "http://localhost").pathname,
    "/index/dubs",
  );

  for (const [legacySlug, target] of [
    ["kickoff-intake", "kickoff"],
    ["real-estate-deal-tracker", "real-estate"],
    ["touring-advancing-tool", "touring"],
    ["personal-tooling", "personal-os"],
    ["spec-discipline", "personal-os"],
    ["three-maturity-bundle", "writ"],
  ]) {
    const response = await render(`/index/${legacySlug}`);
    assert.ok(
      [301, 302, 307, 308].includes(response.status),
      `/index/${legacySlug} redirects`,
    );
    const location = new URL(
      response.headers.get("location"),
      "http://localhost",
    );
    assert.equal(location.pathname, "/", `/index/${legacySlug} → map`);
    assert.equal(location.search, "?view=graph");
    assert.equal(location.hash, `#${target}`, `/index/${legacySlug} → #${target}`);
  }
});

test("the retired design-system snapshot is no longer shipped", async () => {
  const snapshotUrl = new URL(
    "../dist/client/design-system-current.html",
    import.meta.url,
  );
  await assert.rejects(() => stat(snapshotUrl));
});
