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
  assert.doesNotMatch(html, /Evidence undefined/i);
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

  const nodeLinks = new Map();
  for (const [, attributes, content] of html.matchAll(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
  )) {
    const route = attributes.match(/\bhref=["'](\/index\/[^"'#?]+)["']/i)?.[1];
    if (!route) continue;

    const title = content.match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i)?.[1];
    assert.ok(title, `${route} index link contains its node label`);
    nodeLinks.set(route, title.trim());
  }
  assert.equal(nodeLinks.size, 14, "every node links to a canonical page");

  for (const [route, expectedTitle] of nodeLinks) {
    const response = await render(route);
    assert.equal(response.status, 200);
    const nodeHtml = await response.text();
    assert.match(nodeHtml, /<main[^>]*data-theme=["']light["']/i);
    assert.match(nodeHtml, /class=["'][^"']*portfolio-header[^"']*["']/i);
    const nodeTitle = nodeHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    assert.ok(nodeTitle, `${route} renders a node title`);
    assert.equal(
      nodeTitle.trim(),
      expectedTitle,
      `${route} renders its linked node`,
    );
    for (const retiredLabel of ["Instinct", "Approach", "Output"]) {
      assert.doesNotMatch(nodeHtml, new RegExp(`>${retiredLabel}<`));
    }
    assert.doesNotMatch(nodeHtml, /case stud/i);
    assert.match(nodeHtml, /View on the map/i);
  }

  const bradleyResponse = await render("/index/bradley");
  const bradleyHtml = await bradleyResponse.text();
  assert.match(bradleyHtml, /mailto:bradley@braininavat\.dance/i);
  assert.match(bradleyHtml, /bradley-berkman-cv\.pdf/i);
  for (const social of ["LinkedIn", "GitHub", "Instagram"]) {
    assert.match(bradleyHtml, new RegExp(`>${social}<`));
  }

  const pitchingResponse = await render("/index/pitching");
  const pitchingHtml = await pitchingResponse.text();
  assert.match(pitchingHtml, /Evidence (available|partial|needed)/i);
  assert.match(pitchingHtml, /Taste is encodable\. The approval step stays human\./i);
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
    assert.equal(
      new URL(response.headers.get("location"), "http://localhost").pathname,
      `/index/${target}`,
      `/index/${legacySlug} → /index/${target}`,
    );
  }
});

test("the retired design-system snapshot is no longer shipped", async () => {
  const snapshotUrl = new URL(
    "../dist/client/design-system-current.html",
    import.meta.url,
  );
  await assert.rejects(() => stat(snapshotUrl));
});
