import assert from "node:assert/strict";
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

test("flat index is a compact public directory of every canonical artifact", async () => {
  const response = await render("/work");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /href=["']\/#brain["']/);
  assert.match(html, />Selected work</);
  assert.doesNotMatch(html, /Flat index \/ no WebGL required/i);
  assert.doesNotMatch(html, /Brain in a Vat \/ container/i);
  assert.doesNotMatch(html, /The roster is the scale proof/i);
  assert.doesNotMatch(html, /Linear time \/ spatial entry at the pivot/i);

  const musicPosition = html.indexOf('id="music"');
  const rosterPosition = html.indexOf("Brain in a Vat roster");
  const consultingPosition = html.indexOf('id="consulting"');
  assert.ok(musicPosition >= 0, "music domain is rendered");
  assert.ok(rosterPosition > musicPosition, "roster sits inside the music section");
  assert.ok(consultingPosition > rosterPosition, "roster no longer interrupts the page introduction");

  for (const slug of [
    "kickoff-intake",
    "pitching",
    "reporting",
    "real-estate-deal-tracker",
    "touring-advancing-tool",
    "dubs",
    "three-maturity-bundle",
    "personal-tooling",
    "spec-discipline",
  ]) {
    assert.match(html, new RegExp(`href=["']/work/${slug}["']`));
  }
});

for (const [slug, title] of [
  ["kickoff-intake", "Campaign kickoff and intake"],
  ["pitching", "Pitching system"],
  ["reporting", "Campaign reporting"],
  ["real-estate-deal-tracker", "Real-estate deal tracker"],
  ["touring-advancing-tool", "Touring advancing tool"],
  ["dubs", "Dubs"],
  ["three-maturity-bundle", "Three stages of becoming real"],
  ["personal-tooling", "Personal tooling"],
  ["spec-discipline", "Spec discipline"],
]) {
  test(`artifact route renders the full ${slug} chain`, async () => {
    const response = await render(`/work/${slug}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(title));
    for (const layer of [
      "Judgment",
      "Spec or model",
      "System",
      "Artifact",
      "Other minds",
    ]) {
      assert.match(html, new RegExp(`>${layer}<`));
    }
    for (const layerId of ["judgment", "spec", "system", "artifact", "operation"]) {
      assert.match(html, new RegExp(`id=["']${layerId}["']`));
    }
    assert.match(html, />Decision</);
    assert.match(html, /Evidence (available|partial|needed)/i);
  });
}
