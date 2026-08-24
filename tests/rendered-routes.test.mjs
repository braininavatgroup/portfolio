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

test("project index links every canonical project to its own five-section case study", async () => {
  const response = await render("/work");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<main[^>]*data-theme=["']light["']/i);
  assert.match(html, /href=["']\/\?view=graph["']/);
  assert.match(html, /aria-current=["']page["'][^>]*>Project index</i);
  assert.match(html, />Project index</i);
  assert.doesNotMatch(html, /Flat index \/ no WebGL required/i);
  assert.doesNotMatch(html, /Brain in a Vat \/ container/i);
  assert.doesNotMatch(html, /The roster is the scale proof/i);
  assert.doesNotMatch(html, /Linear time \/ spatial entry at the pivot/i);
  assert.doesNotMatch(html, />Explore the map</i);
  assert.doesNotMatch(html, /Brain in a Vat roster|Material pending/i);

  assert.match(html, /aria-label=["']Portfolio views["']/i);
  assert.match(html, /aria-label=["']Portfolio projects["']/i);
  assert.match(html, />Partial evidence</i);
  assert.doesNotMatch(html, /Evidence undefined/i);

  const projectLinks = new Map();
  for (const [, attributes, content] of html.matchAll(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
  )) {
    const route = attributes.match(/\bhref=["'](\/work\/[^"'#?]+)["']/i)?.[1];
    if (!route) continue;

    const title = content.match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i)?.[1];
    assert.ok(title, `${route} index link contains its project title`);
    projectLinks.set(route, title.trim());
  }
  assert.ok(projectLinks.size > 0, "at least one project route is linked");

  for (const [route, expectedTitle] of projectLinks) {
    const response = await render(route);
    assert.equal(response.status, 200);
    const caseStudyHtml = await response.text();
    assert.match(caseStudyHtml, /<main[^>]*data-theme=["']light["']/i);
    assert.match(
      caseStudyHtml,
      /href=["']\/\?view=graph["'][^>]*>Portfolio map</i,
    );
    assert.match(
      caseStudyHtml,
      /href=["']\/work["'][^>]*>Project index</i,
    );
    assert.doesNotMatch(caseStudyHtml, />All work</i);
    const caseStudyTitle = caseStudyHtml.match(
      /<h1\b[^>]*>([\s\S]*?)<\/h1>/i,
    )?.[1];
    assert.ok(caseStudyTitle, `${route} renders a case-study title`);
    assert.equal(
      caseStudyTitle.trim(),
      expectedTitle,
      `${route} renders its linked project`,
    );
    for (const layer of [
      "Judgment",
      "Spec or model",
      "System",
      "Artifact",
      "Other minds",
    ]) {
      assert.match(caseStudyHtml, new RegExp(`>${layer}<`));
    }
    for (const layerId of ["judgment", "spec", "system", "artifact", "operation"]) {
      assert.match(caseStudyHtml, new RegExp(`id=["']${layerId}["']`));
    }
    assert.match(caseStudyHtml, />Decision</);
    assert.match(caseStudyHtml, /Evidence (available|partial|needed)/i);
  }
});
