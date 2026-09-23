import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

async function render(pathname, userAgent = "LinkedInBot/1.0") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html", "user-agent": userAgent },
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

function assertCanonical(head, url) {
  const link = head.match(/<link\b[^>]*\brel="canonical"[^>]*>/)?.[0] ?? "";
  const href = link.match(/\bhref="([^"]+)"/)?.[1];
  assert.ok(href, `canonical link must exist for ${url}`);
  assert.equal(new URL(href).href, new URL(url).href, `canonical link must point to ${url}`);
}

async function assertSharingImage(id) {
  const png = await readFile(new URL(`../dist/client/sharing/${id}.png`, import.meta.url));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 1200, `${id} image width`);
  assert.equal(png.readUInt32BE(20), 630, `${id} image height`);
}

test("all canonical record and theme URLs return their own crawler-readable previews", async () => {
  const content = JSON.parse(await readFile(new URL("../content/portfolio-content.json", import.meta.url), "utf8"));
  for (const [id, record] of Object.entries(content.records)) {
    const response = await render(`/index/${id}`);
    assert.equal(response.status, 200, id);
    assert.equal(response.headers.get("location"), null, "crawlers must not be redirected to generic home metadata");
    const html = await response.text();
    const head = html.split("</head>")[0];
    assert.match(head, /property="og:title"/);
    assert.match(head, /property="og:description"/);
    assertCanonical(head, `https://bradleyberkman.com/index/${id}`);
    assert.ok(head.includes(`/sharing/${id}.png`));
    assert.match(head, /name="twitter:card" content="summary_large_image"/);
    assert.ok(html.includes(record.label.replaceAll("&", "&amp;")), `${id} is server rendered`);
    await assertSharingImage(id);
  }
  assert.equal((await render("/index")).status, 404);
  assert.equal((await render("/index/not-a-project")).status, 404);
});

test("every supporting HTML page has its own canonical, Open Graph and Twitter preview", async () => {
  for (const [path, image] of [["/", "home"], ["/privacy", "privacy"], ["/demos/touring", "demo-touring"], ["/demos/quarterly-dashboard", "demo-quarterly-dashboard"]]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const head = (await response.text()).split("</head>")[0];
    assert.match(head, /property="og:title"/);
    assert.match(head, /property="og:description"/);
    assertCanonical(head, `https://bradleyberkman.com${path}`);
    assert.ok(head.includes(`/sharing/${image}.png`));
    await assertSharingImage(image);
    assert.match(head, /name="twitter:card" content="summary_large_image"/);
  }
});

test("the quarterly dashboard demo renders as a complete public route", async () => {
  const response = await render("/demos/quarterly-dashboard");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Brokerage Pitch Conversion/i);
  assert.match(html, /Trend over time/i);
  assert.match(html, /Quarterly Summary/i);
  assert.match(html, /Pitch Detail/i);
  assert.match(html, /Print or save as PDF/i);
  assert.match(html, /href="\/\?view=graph#real-estate"/i);
  assert.match(html, /Real-Estate Deal Tracker/i);
});

test("retired work routes stay retired", async () => {
  const indexResponse = await render("/work");
  assert.equal(indexResponse.status, 404);

  const workResponse = await render("/work/dubs");
  assert.equal(workResponse.status, 404);
});

test("the sitemap lists every public page and no supporting surface", async () => {
  const response = await render("/sitemap.xml");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/xml/);
  assert.equal(response.headers.get("x-robots-tag"), null, "the sitemap itself must be crawlable");
  const xml = await response.text();
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => new URL(url).pathname);

  const content = JSON.parse(await readFile(new URL("../content/portfolio-content.json", import.meta.url), "utf8"));
  for (const id of Object.keys(content.records)) {
    assert.ok(locations.includes(`/index/${id}`), `sitemap lists /index/${id}`);
  }
  for (const path of ["/", "/privacy", "/demos/touring", "/demos/quarterly-dashboard"]) {
    assert.ok(locations.includes(path), `sitemap lists ${path}`);
  }
  for (const path of ["/design", "/copy-deck"]) {
    assert.ok(!locations.includes(path), `sitemap must not list ${path}`);
  }
  assert.equal(new Set(locations).size, locations.length, "no duplicate locations");
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
  assert.match(html, /mailto:bradley@braininavat\.dance/i);
});

// PER-16 deleted the stale copy deck and made the design gallery dev-only.
// Both used to answer 200 behind the main-preview password; the built Worker
// must now 404 them outright, with no redirect to a login that no longer exists.
test("the retired copy deck and the dev-only design gallery are not served", async () => {
  for (const path of ["/copy-deck", "/copy-deck.zip", "/design"]) {
    const response = await render(path);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("location"), null, path);
  }
});

test("the retired design-system snapshot is no longer shipped", async () => {
  const snapshotUrl = new URL(
    "../dist/client/design-system-current.html",
    import.meta.url,
  );
  await assert.rejects(() => stat(snapshotUrl));
});
