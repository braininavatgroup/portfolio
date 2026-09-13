import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSupportingRoute, withPublicPortfolio } from "./public-portfolio";

// The real HTMLRewriter only exists in the Workers runtime. This records the
// attribute it would have set as a header so the policy stays assertable here.
class TestHTMLRewriter {
  private handler?: { element(element: { setAttribute(name: string, value: string): void }): void };

  on(_selector: string, handler: TestHTMLRewriter["handler"]) {
    this.handler = handler;
    return this;
  }

  transform(response: Response) {
    const headers = new Headers(response.headers);
    this.handler?.element({
      setAttribute(name, value) {
        headers.set(`x-test-html-${name}`, value);
      },
    });
    return new Response(response.body, { status: response.status, headers });
  }
}

beforeEach(() => {
  vi.stubGlobal("HTMLRewriter", TestHTMLRewriter);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const html = async () =>
  new Response("<!doctype html><html><body>Portfolio</body></html>", {
    headers: { "content-type": "text/html; charset=utf-8" },
  });

function marker(response: Response) {
  return response.headers.get("x-test-html-data-portfolio-analytics-context");
}

describe("public portfolio search and analytics policy", () => {
  it("marks public portfolio documents external once the login is removed", async () => {
    for (const host of ["bradleyberkman.com", "www.bradleyberkman.com"]) {
      const response = await withPublicPortfolio(new Request(`https://${host}/privacy`),
        html,
      );

      expect(marker(response)).toBe("external");
      expect(response.headers.get("x-robots-tag")).toBeNull();
    }
  });


  it("keeps local development and workers.dev previews unmarked", async () => {
    for (const url of [
      "http://localhost:5173/",
      "https://bradley-portfolio-main-preview.workers.dev/",
    ]) {
      const response = await withPublicPortfolio(new Request(url), html);
      expect(marker(response)).toBeNull();
    }
  });

  it("does not rewrite a non-HTML public response", async () => {
    const response = await withPublicPortfolio(new Request("https://bradleyberkman.com/api/portfolio-chat"),
      async () => Response.json({ ok: true }),
    );

    expect(marker(response)).toBeNull();
    expect(await response.json()).toEqual({ ok: true });
  });

  it("keeps supporting routes excluded from search and from analytics", async () => {
    for (const pathname of [
      "/design",
      "/_portfolio-feedback/notes",
      "/_portfolio-preview/login",
    ]) {
      const response = await withPublicPortfolio(new Request(`https://bradleyberkman.com${pathname}`),
        html,
      );

      expect(response.headers.get("x-robots-tag")).toBe(
        "noindex, nofollow, noarchive",
      );
      expect(marker(response)).toBeNull();
    }
  });

  it("treats portfolio record and demo routes as public", () => {
    for (const pathname of ["/", "/privacy", "/index/infamous", "/demos/touring"]) {
      expect(isSupportingRoute(pathname)).toBe(false);
    }
  });
});
