import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { handleFamilyWalkthrough } from "./family-walkthrough";

const prefix = "ab".repeat(16);
const digest = createHash("sha256").update(prefix).digest("hex");
const base = "https://bradleyberkman.com/" + prefix;
const binding = () => ({ fetch: vi.fn<(request: Request) => Promise<Response>>(async () => new Response("asset", {
  status: 206,
  headers: { "content-type": "model/gltf-binary", "content-range": "bytes 0-4/20", "set-cookie": "internal=1" },
})) });

describe("unlisted static walkthrough", () => {
  it("leaves unrelated portfolio paths, including other hex directories, to the existing router", async () => {
    const origin = binding();
    for (const path of ["/", "/privacy", "/api/portfolio-insights", "/" + "cd".repeat(16), "/" + prefix + "0/world"]) {
      expect(await handleFamilyWalkthrough(new Request("https://bradleyberkman.com" + path), origin, digest)).toBeNull();
    }
    // The test directory must not be a second production route.
    expect(await handleFamilyWalkthrough(new Request(base + "/"), origin)).toBeNull();
    expect(origin.fetch).not.toHaveBeenCalled();
  });

  it("redirects only the bare directory, to a relative Location without the query", async () => {
    const origin = binding();
    const response = await handleFamilyWalkthrough(new Request(base + "?source=test"), origin, digest);
    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe("/" + prefix + "/");
    expect(response?.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response?.headers.get("x-robots-tag")).toContain("noindex");
    expect(origin.fetch).not.toHaveBeenCalled();
  });

  it("serves index files and nested assets from the binding with only read headers", async () => {
    const origin = binding();
    for (const [method, suffix, asset] of [["HEAD", "/", "/index.html"], ["HEAD", "/sub/", "/sub/index.html"], ["GET", "/world/site.glb", "/world/site.glb"]]) {
      const response = await handleFamilyWalkthrough(new Request(base + suffix + "?ignored=1", { method, headers: {
        authorization: "fixture", cookie: "fixture=1", referer: "https://example.test/", range: "bytes=0-4", "x-example": "omit",
      } }), origin, digest);
      const forwarded = origin.fetch.mock.lastCall![0];
      expect(forwarded.url).toBe("https://walkthrough.internal/" + prefix + asset);
      expect(forwarded.method).toBe(method);
      expect(forwarded.redirect).toBe("manual");
      expect([...forwarded.headers]).toEqual([["range", "bytes=0-4"]]);
      expect(response?.status).toBe(206);
      expect(await response?.text()).toBe(method === "HEAD" ? "" : "asset");
      expect(response?.headers.get("content-range")).toBe("bytes 0-4/20");
      expect(response?.headers.get("set-cookie")).toBeNull();
      expect(response?.headers.get("x-robots-tag")).toContain("noindex");
      expect(response?.headers.get("referrer-policy")).toBe("no-referrer");
    }
  });

  it("does not forward other methods, hosts or non-asset paths", async () => {
    const origin = binding();
    for (const url of [base.replace("://", "://www.") + "/", base.replace("bradleyberkman.com", "portfolio.workers.dev") + "/", base + "//", base + "/bad%2Fpath"]) {
      expect((await handleFamilyWalkthrough(new Request(url), origin, digest))?.status).toBe(404);
    }
    expect((await handleFamilyWalkthrough(new Request(base + "/", { method: "POST" }), origin, digest))?.status).toBe(405);
    expect(origin.fetch).not.toHaveBeenCalled();
  });

  it("keeps missing assets missing, and does not expose upstream redirects or binding errors", async () => {
    const request = new Request(base + "/unknown");
    for (const status of [304, 404]) {
      const response = await handleFamilyWalkthrough(request, { fetch: async () => new Response(null, { status }) }, digest);
      expect(response?.status).toBe(status);
    }
    const redirect = await handleFamilyWalkthrough(request, { fetch: async () => Response.redirect("https://example.test/") }, digest);
    expect(redirect?.status).toBe(502);
    expect(redirect?.headers.has("location")).toBe(false);
    expect((await handleFamilyWalkthrough(request, undefined, digest))?.status).toBe(503);
    expect((await handleFamilyWalkthrough(request, { fetch: async () => { throw new Error("unavailable"); } }, digest))?.status).toBe(502);
  });
});
