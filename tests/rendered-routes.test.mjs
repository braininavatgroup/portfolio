import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
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

test("canonical /index/<id> URLs redirect into the map reader", async () => {
  // The flat /index page is gone; the dossier is the index. The per-record
  // URLs stay as canonical addresses that land on the map with the record open.
  const content = JSON.parse(
    await readFile(new URL("../content/portfolio-content.json", import.meta.url), "utf8"),
  );
  const nodeIds = Object.keys(content.records).filter((id) => !id.startsWith("thread-"));
  assert.equal(nodeIds.length, 13, "thirteen nodes carry canonical URLs");

  const flatIndex = await render("/index");
  assert.equal(flatIndex.status, 404, "/index is no longer a page");

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

test("the quarterly dashboard demo renders as a complete public route", async () => {
  const response = await render("/demos/quarterly-dashboard");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Ryan \+ Ryan Quarterly Pitch Conversion/i);
  assert.match(html, /Trend over time/i);
  assert.match(html, /Quarterly Summary/i);
  assert.match(html, /Pitch Detail/i);
  assert.match(html, /Print or save as PDF/i);
  assert.match(html, /href="\/\?view=graph#real-estate"/i);
  assert.match(html, /Back to Real-estate deal tracker/i);
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

test("the copy deck is served as Markdown and from its export page", async () => {
  const content = JSON.parse(
    await readFile(new URL("../content/portfolio-content.json", import.meta.url), "utf8"),
  );

  const markdown = await render("/copy-deck.md");
  assert.equal(markdown.status, 200);
  assert.match(markdown.headers.get("content-type"), /^text\/markdown/);
  assert.match(markdown.headers.get("content-disposition"), /portfolio-copy-deck-\d{4}-\d{2}-\d{2}\.md/);
  const deck = await markdown.text();
  assert.match(deck, /^# Portfolio copy deck\n/);
  assert.ok(deck.includes(`from content revision ${content.revision}.`));
  assert.ok(deck.includes("## Bradley Berkman · `record:bradley`"));
  assert.ok(deck.includes(`\n${content.records.bradley.paragraphs.p1}\n`));

  const page = await render("/copy-deck");
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<h1>Copy deck<\/h1>/);
  assert.match(html, /New Google Doc/);
  assert.match(html, /New Obsidian note/);
  assert.match(html, /href="\/copy-deck\.md"/);
  assert.match(html, /noindex/);
});

test("the retired design-system snapshot is no longer shipped", async () => {
  const snapshotUrl = new URL(
    "../dist/client/design-system-current.html",
    import.meta.url,
  );
  await assert.rejects(() => stat(snapshotUrl));
});
