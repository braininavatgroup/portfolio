import { describe, expect, it } from "vitest";
import { withoutPhantomBody } from "./inbound-request";

const inbound = (init: RequestInit = {}) =>
  new Request("https://bradleyberkman.com/privacy", {
    method: "GET",
    ...init,
  });

describe("withoutPhantomBody", () => {
  // The regression: every app route answered 500 for any client that sent a
  // bodyless GET or HEAD declaring Content-Length.
  it("drops a Content-Length declared on a bodyless GET", () => {
    const shaped = withoutPhantomBody(
      inbound({ headers: { "content-length": "0" } }),
    );

    expect(shaped.headers.get("content-length")).toBeNull();
  });

  it("drops it on HEAD too, which link checkers send more often", () => {
    const shaped = withoutPhantomBody(
      inbound({ method: "HEAD", headers: { "content-length": "0" } }),
    );

    expect(shaped.method).toBe("HEAD");
    expect(shaped.headers.get("content-length")).toBeNull();
  });

  it("drops a Transfer-Encoding making the same false claim", () => {
    const shaped = withoutPhantomBody(
      inbound({ headers: { "transfer-encoding": "chunked" } }),
    );

    expect(shaped.headers.get("transfer-encoding")).toBeNull();
  });

  it("keeps the method, URL and every header the response varies on", () => {
    const shaped = withoutPhantomBody(
      inbound({
        headers: {
          "content-length": "0",
          "accept-encoding": "gzip, br",
          "if-none-match": 'W/"abc"',
          cookie: "pc_session=v1",
        },
      }),
    );

    expect(shaped.method).toBe("GET");
    expect(shaped.url).toBe("https://bradleyberkman.com/privacy");
    expect(shaped.headers.get("accept-encoding")).toBe("gzip, br");
    expect(shaped.headers.get("if-none-match")).toBe('W/"abc"');
    expect(shaped.headers.get("cookie")).toBe("pc_session=v1");
  });

  // `new Request()` copies none of these, and the repaired request is the only
  // one the rest of the Worker ever sees.
  it("keeps the redirect mode the Workers runtime hands in", () => {
    const shaped = withoutPhantomBody(
      new Request("https://bradleyberkman.com/privacy", {
        method: "GET",
        headers: { "content-length": "0" },
        redirect: "manual",
      }),
    );

    expect(shaped.redirect).toBe("manual");
  });

  it("keeps the abort signal so a disconnect still cancels the render", () => {
    const controller = new AbortController();
    const shaped = withoutPhantomBody(
      inbound({ headers: { "content-length": "0" }, signal: controller.signal }),
    );

    expect(shaped.signal.aborted).toBe(false);
    controller.abort();
    expect(shaped.signal.aborted).toBe(true);
  });

  // Insight geo reads `request.cf` alone and never the headers, so losing it
  // silently blanks region, city and metro for every repaired request.
  it("re-attaches the Cloudflare request metadata", () => {
    const request = inbound({ headers: { "content-length": "0" } });
    Object.defineProperty(request, "cf", {
      value: { city: "New York City", region: "New York", metroCode: "501" },
      enumerable: true,
      configurable: true,
    });

    const shaped = withoutPhantomBody(request);

    expect((shaped as { cf?: unknown }).cf).toEqual({
      city: "New York City",
      region: "New York",
      metroCode: "501",
    });
  });

  it("repairs a request that carries no cf metadata", () => {
    const shaped = withoutPhantomBody(
      inbound({ headers: { "content-length": "0" } }),
    );

    expect((shaped as { cf?: unknown }).cf).toBeUndefined();
    expect(shaped.headers.get("content-length")).toBeNull();
  });

  it("leaves an untouched request as the same object", () => {
    const request = inbound();

    expect(withoutPhantomBody(request)).toBe(request);
  });

  // On POST the declaration is true, and rebuilding would discard the body.
  it("leaves a real bodied request alone", async () => {
    const request = new Request("https://bradleyberkman.com/api/portfolio-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "How does pitching preserve approval?" }),
    });

    const shaped = withoutPhantomBody(request);

    expect(shaped).toBe(request);
    await expect(shaped.text()).resolves.toContain("pitching");
  });
});
