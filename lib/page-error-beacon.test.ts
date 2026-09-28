// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { createPageErrorBeacon, ERROR_INTAKE_BEACON_URL } from "./page-error-beacon";

function beaconAt(origin: string, pathname = "/work/brain-food") {
  const sent: { url: string; body: Blob }[] = [];
  const beacon = createPageErrorBeacon({
    location: { origin, pathname },
    send: (url, body) => {
      sent.push({ url, body });
      return true;
    },
  });
  return { beacon, sent };
}

async function payload(body: Blob) {
  return JSON.parse(await body.text()) as Record<string, string>;
}

describe("page error beacon", () => {
  it("sends each distinct error once per page view", () => {
    const { beacon, sent } = beaconAt("https://bradleyberkman.com");

    beacon.report(new TypeError("x is undefined"));
    beacon.report(new TypeError("x is undefined"));
    beacon.report(new RangeError("x is undefined"));
    beacon.report(new TypeError("y is undefined"));

    expect(sent).toHaveLength(3);
    expect(sent.every((s) => s.url === ERROR_INTAKE_BEACON_URL)).toBe(true);
    expect(sent[0].body.type).toBe("text/plain");
  });

  it("sends the path and error only: no query, hash, or anything about the visitor", async () => {
    const { beacon, sent } = beaconAt("https://www.bradleyberkman.com", "/reader");
    const error = new Error("render failed");
    error.stack =
      "Error: render failed\n    at a (https://www.bradleyberkman.com/assets/app.js?token=secret#frag:10:5)";

    beacon.report(error, "https://www.bradleyberkman.com/assets/app.js?token=secret#frag");

    const body = await payload(sent[0].body);
    expect(Object.keys(body).sort()).toEqual(["filename", "message", "name", "page", "stack"]);
    expect(body).toMatchObject({
      name: "Error",
      message: "render failed",
      page: "/reader",
      filename: "https://www.bradleyberkman.com/assets/app.js",
    });
    expect(JSON.stringify(body)).not.toMatch(/[?#]|secret|frag/);
  });

  it("listens for uncaught errors and unhandled rejections, and stops when removed", async () => {
    const { beacon, sent } = beaconAt("https://bradleyberkman.com");
    // A bare target: vitest treats an error event on the real window as a test failure.
    const target = new EventTarget() as unknown as Window;
    const remove = beacon.install(target);

    target.dispatchEvent(
      new ErrorEvent("error", {
        error: new TypeError("boom"),
        message: "boom",
        filename: "https://bradleyberkman.com/assets/a.js",
      }),
    );
    const rejection = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(rejection, "reason", { value: "chat closed" });
    target.dispatchEvent(rejection);
    remove();
    target.dispatchEvent(new ErrorEvent("error", { error: new Error("after removal") }));

    expect(sent).toHaveLength(2);
    expect(await payload(sent[0].body)).toMatchObject({ name: "TypeError", message: "boom" });
    expect(await payload(sent[1].body)).toMatchObject({
      name: "UnhandledRejection",
      message: "chat closed",
    });
  });

  it("sends nothing from origins the intake does not accept, or for opaque cross-origin errors", () => {
    for (const origin of ["http://localhost:3000", "https://insights.braininavat.dance"]) {
      const { beacon, sent } = beaconAt(origin);
      beacon.report(new Error("boom"));
      expect(sent).toHaveLength(0);
    }
    const { beacon, sent } = beaconAt("https://bradleyberkman.com");
    beacon.report({ message: "Script error." });
    expect(sent).toHaveLength(0);
  });

  it("never throws when sending fails", () => {
    const beacon = createPageErrorBeacon({
      location: { origin: "https://bradleyberkman.com", pathname: "/" },
      send: () => {
        throw new Error("sendBeacon refused");
      },
    });
    expect(beacon.report(new Error("boom"))).toBe(false);
  });
});
