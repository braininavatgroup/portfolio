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

test("project index links every data-derived project to its canonical case study", async () => {
  const response = await render("/index");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<main[^>]*data-theme=["']light["']/i);
  assert.match(html, /class=["'][^"']*portfolio-header[^"']*["']/i);
  assert.match(html, /href=["']\/["'][^>]*>Bradley Berkman</i);
  assert.match(html, /href=["']\/\?view=graph["'][^>]*>Map</i);
  assert.doesNotMatch(html, />Index</i);
  assert.match(html, />Project index</i);
  assert.doesNotMatch(html, /Portfolio\s*[·•]\s*\d+\s+projects?/i);
  assert.doesNotMatch(html, /Flat index \/ no WebGL required/i);
  assert.doesNotMatch(html, /Portfolio · \d+ projects/i);
  assert.doesNotMatch(html, /Brain in a Vat \/ container/i);
  assert.doesNotMatch(html, /The roster is the scale proof/i);
  assert.doesNotMatch(html, /Linear time \/ spatial entry at the pivot/i);
  assert.doesNotMatch(html, />Explore the map</i);
  assert.doesNotMatch(html, /Brain in a Vat roster|Material pending/i);
  assert.match(html, /data-index-layout=["']stacked-editorial["']/i);
  assert.doesNotMatch(html, /class=["'][^"']*domain-heading-meta/i);
  assert.doesNotMatch(html, /class=["'][^"']*artifact-index-number/i);
  assert.match(html, /data-project-count=["']3["'][^>]*id=["']music["']/i);
  assert.match(html, /data-project-count=["']2["'][^>]*id=["']consulting["']/i);
  assert.match(html, /data-project-count=["']4["'][^>]*id=["']development["']/i);
  assert.equal(
    (html.match(/class=["'][^"']*artifact-index-entry[^"']*["']/gi) ?? [])
      .length,
    9,
    "stacked editorial index renders every project as an entry",
  );

  assert.match(html, /aria-label=["']Portfolio views["']/i);
  assert.doesNotMatch(html, /Evidence undefined/i);
  const musicPosition = html.indexOf('id="music"');
  const consultingPosition = html.indexOf('id="consulting"');
  assert.ok(musicPosition >= 0, "music domain is rendered");
  assert.ok(consultingPosition > musicPosition, "domain order remains intact");
  assert.doesNotMatch(html, /Career timeline/i);
  assert.doesNotMatch(html, /For AI product teams/i);

  const projectLinks = new Map();
  for (const [, attributes, content] of html.matchAll(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
  )) {
    const route = attributes.match(/\bhref=["'](\/index\/[^"'#?]+)["']/i)?.[1];
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
    assert.match(caseStudyHtml, /class=["'][^"']*portfolio-header[^"']*["']/i);
    assert.match(caseStudyHtml, /href=["']\/["'][^>]*>Bradley Berkman</i);
    assert.match(caseStudyHtml, /href=["']\/\?view=graph["'][^>]*>Map</i);
    assert.doesNotMatch(caseStudyHtml, />Index</i);
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
    for (const role of ["Instinct", "Approach", "Output"]) {
      assert.match(caseStudyHtml, new RegExp(`>${role}<`));
    }
    for (const stepId of ["step-instinct", "step-approach", "step-output"]) {
      assert.match(caseStudyHtml, new RegExp(`id=["']${stepId}["']`));
    }
    assert.doesNotMatch(caseStudyHtml, /class=["']chain-marker["']/i);
    for (const legacyLabel of ["Spec or model", "Other minds"]) {
      assert.doesNotMatch(caseStudyHtml, new RegExp(`>${legacyLabel}<`));
    }
    for (const legacyId of ["judgment", "spec", "system", "artifact", "operation"]) {
      assert.doesNotMatch(caseStudyHtml, new RegExp(`id=["']${legacyId}["']`));
    }
    assert.match(caseStudyHtml, /Supporting material for /i);
    assert.match(caseStudyHtml, /Evidence (available|partial|needed)/i);
    assert.doesNotMatch(
      caseStudyHtml,
      new RegExp(`<a[^>]*href=["']${route}["'][^>]*>View case study<`, "i"),
      `${route} does not link its own canonical route as a case-study link`,
    );
  }
});

test("legacy work routes redirect to the canonical index routes", async () => {
  const indexResponse = await render("/work");
  assert.ok([301, 302, 307, 308].includes(indexResponse.status));
  assert.equal(new URL(indexResponse.headers.get("location"), "http://localhost").pathname, "/index");

  const caseStudyResponse = await render("/work/dubs");
  assert.ok([301, 302, 307, 308].includes(caseStudyResponse.status));
  assert.equal(
    new URL(caseStudyResponse.headers.get("location"), "http://localhost").pathname,
    "/index/dubs",
  );
});
