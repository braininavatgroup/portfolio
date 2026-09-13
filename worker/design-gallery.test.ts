import { describe, expect, it } from "vitest";
import { isDesignGalleryRoute, withDesignGallery } from "./design-gallery";

// Failure this pins: /design was reachable in production behind the
// main-preview password (verified live 2026-09-13: 303 to the login). PER-16
// removed that gate, so without this the route would have become public — a
// full Three.js composition and every component fixture on the portfolio apex.
//
// Owner: worker/design-gallery.ts. Retire when /design is deleted or
// deliberately made public.

const served = async () => new Response("gallery", { status: 200 });

describe("design gallery route", () => {
  it("serves the gallery only where the flag is exactly \"true\"", async () => {
    const response = await withDesignGallery(
      new Request("https://localhost/design"),
      { PORTFOLIO_DESIGN_GALLERY_ENABLED: "true" },
      served,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("gallery");
  });

  // Fails closed: an absent, empty, mistyped or truthy-but-wrong flag must not
  // publish the gallery. "TRUE"/"1"/"yes" are the shapes a careless edit takes.
  it.each([undefined, "", "false", "TRUE", "1", "yes", " true"])(
    "404s the gallery when the flag is %j",
    async (flag) => {
      const response = await withDesignGallery(
        new Request("https://bradleyberkman.com/design"),
        flag === undefined ? {} : { PORTFOLIO_DESIGN_GALLERY_ENABLED: flag },
        served,
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("x-robots-tag")).toBe(
        "noindex, nofollow, noarchive",
      );
    },
  );

  // 404, never 303 or 403: the deployed site must not advertise that the route
  // exists, and must never redirect to the login path the gate used to serve.
  it("does not redirect or hint at a login", async () => {
    const response = await withDesignGallery(
      new Request("https://bradleyberkman.com/design"),
      {},
      served,
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).not.toContain("login");
  });

  it("leaves every other route alone whatever the flag says", async () => {
    for (const path of ["/", "/privacy", "/api/portfolio-chat", "/designs", "/design-system"]) {
      const response = await withDesignGallery(
        new Request(`https://bradleyberkman.com${path}`),
        {},
        served,
      );
      expect(response.status, path).toBe(200);
    }
  });

  it("matches the route with or without a trailing slash", () => {
    expect(isDesignGalleryRoute("/design")).toBe(true);
    expect(isDesignGalleryRoute("/design/")).toBe(true);
    expect(isDesignGalleryRoute("/designs")).toBe(false);
    expect(isDesignGalleryRoute("/design-system")).toBe(false);
  });
});
