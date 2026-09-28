// The feature map (.agents/skills/verify-portfolio/features/README.md) is what
// `npm run live` walks. These tests run its offline half: the committed map
// must agree with this checkout, and each way a map goes stale must be caught
// with a message that names the row and the fix.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mapPath, readFeatureMap, routePath, staleRows } from "../scripts/feature-map.mjs";
import { probes } from "../scripts/live-probes.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const committed = readFileSync(`${ROOT}${mapPath}`, "utf8");
const probeNames = new Set(Object.keys(probes));

async function staleAfter(from: string, to: string) {
  expect(committed, `fixture anchor not in the map: ${from}`).toContain(from);
  const { stale } = await staleRows({ text: committed.replace(from, to), probes: probeNames });
  return stale as string[];
}

describe("feature map", () => {
  it("agrees with this checkout", async () => {
    const { rows, stale } = await staleRows({ text: committed, probes: probeNames });
    expect(stale).toEqual([]);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("is what npm run live checks first", () => {
    const output = execFileSync(process.execPath, ["scripts/live.mjs", "--map-only"], { cwd: ROOT, encoding: "utf8" });
    expect(output).toContain("live: feature map is current");
  });

  it("maps URLs from route files", () => {
    expect(routePath("app/page.tsx")).toBe("/");
    expect(routePath("app/demos/touring/page.tsx")).toBe("/demos/touring");
    expect(routePath("app/sitemap.xml/route.ts")).toBe("/sitemap.xml");
    expect(routePath("app/index/[id]/page.tsx")).toBeNull();
  });

  it("fails a row whose record is gone from the content file", async () => {
    const stale = await staleAfter(
      "`content/portfolio-content.json#writ` | `page`",
      "`content/portfolio-content.json#retired-record` | `page`",
    );
    expect(stale).toContainEqual(expect.stringMatching(/\(Writ\): content\/portfolio-content\.json has no record "retired-record"/));
    expect(stale).toContainEqual(expect.stringMatching(/^record "writ" is in content\/portfolio-content\.json but no feature map row names/));
  });

  it("fails a record row at the wrong URL", async () => {
    const stale = await staleAfter("`https://bradleyberkman.com/index/dubs`", "`https://bradleyberkman.com/index/dubs-app`");
    expect(stale).toContainEqual(expect.stringMatching(/record dubs is served at \/index\/dubs, but the row says \/index\/dubs-app/));
  });

  it("fails a route row whose file moved or whose URL drifted", async () => {
    expect(await staleAfter("`app/privacy/page.tsx`", "`app/legal/privacy/page.tsx`")).toContainEqual(
      expect.stringMatching(/app\/legal\/privacy\/page\.tsx is not a file in this checkout/),
    );
    expect(await staleAfter("`https://bradleyberkman.com/privacy`", "`https://bradleyberkman.com/privacy-policy`")).toContainEqual(
      expect.stringMatching(/app\/privacy\/page\.tsx is served at \/privacy, but the row says \/privacy-policy/),
    );
    expect(await staleAfter("`https://bradleyberkman.com/robots.txt`", "`https://bradleyberkman.com/robot.txt`")).toContainEqual(
      expect.stringMatching(/public\/robots\.txt is served at \/robots\.txt, but the row says \/robot\.txt/),
    );
  });

  it("fails when a route file has no row", async () => {
    const row = committed.split("\n").find((line) => line.includes("`app/demos/touring/page.tsx`"))!;
    expect(await staleAfter(`${row}\n`, "")).toContainEqual(
      "app/demos/touring/page.tsx is a route but no feature map row names it; add a row (or an `uncovered: why` row)",
    );
  });

  it("fails when a component sheet has no row", async () => {
    const row = committed.split("\n").find((line) => line.includes("`docs/components/CursorInstrument.md`"))!;
    expect(await staleAfter(`${row}\n`, "")).toContainEqual(expect.stringMatching(/^docs\/components\/CursorInstrument\.md is a component sheet but no feature map row names it/));
  });

  it("fails a probe row the probes do not define, and a probe no row runs", async () => {
    const stale = await staleAfter("`probe cursor`", "`probe cursor-trail`");
    expect(stale).toContainEqual(expect.stringMatching(/scripts\/live-probes\.mjs defines no probe "cursor-trail"/));
    expect(stale).toContainEqual('scripts/live-probes.mjs defines probe "cursor" but no feature map row runs it');
  });

  it("fails a row it cannot read", async () => {
    const stale = await staleAfter("`status 405` |", "`405` |");
    expect(stale).toContainEqual(expect.stringMatching(/"`405`" is not a check this map defines/));
  });

  it("reads quoted text with escaped quotes", () => {
    const { rows } = readFeatureMap('| A | `https://bradleyberkman.com/x` | `app/page.tsx` | `status 200 "\\"required\\":true"` |');
    expect(rows[0]).toMatchObject({ kind: "status", status: 200, text: '"required":true' });
  });
});
