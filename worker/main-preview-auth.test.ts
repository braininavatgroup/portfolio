import { afterEach, describe, expect, it, vi } from "vitest";
import {
  withMainPreviewPassword,
  type MainPreviewAuthEnv,
} from "./main-preview-auth";

const NOW = Date.UTC(2026, 7, 27, 16, 0, 0);
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1_000;

afterEach(() => {
  vi.unstubAllGlobals();
});

const enabledEnv: MainPreviewAuthEnv = {
  PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED: "true",
  PORTFOLIO_MAIN_PREVIEW_PASSWORD: "correct horse battery staple",
  PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET:
    "a-long-independent-session-signing-secret-for-preview-only",
};

function downstream(body = "application") {
  let calls = 0;
  return {
    calls: () => calls,
    next: async () => {
      calls += 1;
      return new Response(body, { headers: { "x-application": "reached" } });
    },
  };
}

function postLogin(password: string, next = "/") {
  return new Request(
    `https://preview.example/_portfolio-preview/login?next=${encodeURIComponent(next)}`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password }),
    },
  );
}

function cookiePair(response: Response) {
  return response.headers.get("set-cookie")?.split(";", 1)[0];
}

describe("main preview password boundary", () => {
  it("keeps the working surfaces behind the password after the site is public", async () => {
    const publicEnv: MainPreviewAuthEnv = {
      ...enabledEnv,
      PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED: "false",
    };

    for (const pathname of ["/copy-deck", "/copy-deck.zip", "/design"]) {
      const app = downstream();
      const response = await withMainPreviewPassword(
        new Request(`https://bradleyberkman.com${pathname}`),
        publicEnv,
        app.next,
        () => NOW,
      );

      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(
        `/_portfolio-preview/login?next=${encodeURIComponent(pathname)}`,
      );
      expect(app.calls()).toBe(0);
    }
  });

  it("still serves portfolio pages publicly while the working surfaces are gated", async () => {
    const app = downstream();

    const response = await withMainPreviewPassword(
      new Request("https://bradleyberkman.com/privacy"),
      { ...enabledEnv, PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED: "false" },
      app.next,
      () => NOW,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBeNull();
    expect(app.calls()).toBe(1);
  });

  it("leaves the working surfaces open where no password is configured", async () => {
    const app = downstream();

    const response = await withMainPreviewPassword(
      new Request("http://localhost:5173/design"),
      {},
      app.next,
      () => NOW,
    );

    expect(response.status).toBe(200);
    expect(app.calls()).toBe(1);
  });

  it("passes through unchanged when the password gate is disabled", async () => {
    const app = downstream();

    const response = await withMainPreviewPassword(
      new Request("https://preview.example/index"),
      {},
      app.next,
      () => NOW,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-application")).toBe("reached");
    expect(response.headers.get("x-robots-tag")).toBeNull();
    expect(app.calls()).toBe(1);
  });

  it.each([
    {
      ...enabledEnv,
      PORTFOLIO_MAIN_PREVIEW_PASSWORD: undefined,
    },
    {
      ...enabledEnv,
      PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET: undefined,
    },
  ])("fails closed without exposing configuration details", async (env) => {
    const app = downstream();

    const response = await withMainPreviewPassword(
      new Request("https://preview.example/"),
      env,
      app.next,
      () => NOW,
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Preview unavailable");
    expect(response.headers.get("x-robots-tag")).toBe(
      "noindex, nofollow, noarchive",
    );
    expect(app.calls()).toBe(0);
  });

  it("redirects an unauthenticated navigation to login with a safe return path", async () => {
    const app = downstream();
    const response = await withMainPreviewPassword(
      new Request("https://preview.example/index?draft=1", {
        headers: { accept: "text/html" },
      }),
      enabledEnv,
      app.next,
      () => NOW,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/_portfolio-preview/login?next=%2Findex%3Fdraft%3D1",
    );
    expect(response.headers.get("x-robots-tag")).toBe(
      "noindex, nofollow, noarchive",
    );
    expect(app.calls()).toBe(0);
  });

  it("serves a self-contained login form", async () => {
    const response = await withMainPreviewPassword(
      new Request(
        "https://preview.example/_portfolio-preview/login?next=%2Fwork%3Fdraft%3D1",
      ),
      enabledEnv,
      downstream().next,
      () => NOW,
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("x-robots-tag")).toBe(
      "noindex, nofollow, noarchive",
    );
    expect(body).toContain('type="password"');
    expect(body).toContain('name="password"');
    expect(body).toContain(
      '<meta name="robots" content="noindex,nofollow,noarchive">',
    );
    expect(body).toContain("Bradley Berkman");
    expect(body).not.toMatch(/<(?:script|link)\b/i);
  });

  it("returns JSON for an unauthenticated non-navigation request", async () => {
    const app = downstream();
    const response = await withMainPreviewPassword(
      new Request("https://preview.example/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      enabledEnv,
      app.next,
      () => NOW,
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required" });
    expect(response.headers.get("x-robots-tag")).toBe(
      "noindex, nofollow, noarchive",
    );
    expect(app.calls()).toBe(0);
  });

  it("rejects a wrong password with a generic error and no cookie", async () => {
    const response = await withMainPreviewPassword(
      postLogin("definitely wrong", "/index"),
      enabledEnv,
      downstream().next,
      () => NOW,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).toContain("That password did not work.");
  });

  it("issues a seven-day secure cookie and redirects after a correct password", async () => {
    const response = await withMainPreviewPassword(
      postLogin(enabledEnv.PORTFOLIO_MAIN_PREVIEW_PASSWORD!, "/index?draft=1"),
      enabledEnv,
      downstream().next,
      () => NOW,
    );
    const cookie = response.headers.get("set-cookie");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/index?draft=1");
    expect(cookie).toMatch(/^portfolio_main_preview_session=[^;]+/);
    expect(cookie).toContain("Max-Age=604800");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  it("accepts any non-empty shared password chosen by the operator", async () => {
    const env = {
      ...enabledEnv,
      PORTFOLIO_MAIN_PREVIEW_PASSWORD: "draft",
    };

    const response = await withMainPreviewPassword(
      postLogin("draft", "/index"),
      env,
      downstream().next,
      () => NOW,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/index");
    expect(response.headers.get("set-cookie")).toContain(
      "portfolio_main_preview_session=",
    );
  });

  it("accepts a valid signed cookie and adds noindex without buffering the app response", async () => {
    const login = await withMainPreviewPassword(
      postLogin(enabledEnv.PORTFOLIO_MAIN_PREVIEW_PASSWORD!),
      enabledEnv,
      downstream().next,
      () => NOW,
    );
    const app = downstream("protected application");
    const response = await withMainPreviewPassword(
      new Request("https://preview.example/index", {
        headers: { cookie: cookiePair(login)! },
      }),
      enabledEnv,
      app.next,
      () => NOW + 1_000,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-application")).toBe("reached");
    expect(response.headers.get("x-robots-tag")).toBe(
      "noindex, nofollow, noarchive",
    );
    expect(await response.text()).toBe("protected application");
    expect(app.calls()).toBe(1);
  });

  it("marks authenticated preview HTML as excluded from external analytics", async () => {
    class TestHTMLRewriter {
      private handler?: {
        element(element: { setAttribute(name: string, value: string): void }): void;
      };

      on(
        selector: string,
        handler: {
          element(element: { setAttribute(name: string, value: string): void }): void;
        },
      ) {
        expect(selector).toBe("html");
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
        return new Response(response.body, { ...response, headers });
      }
    }
    vi.stubGlobal("HTMLRewriter", TestHTMLRewriter);
    const login = await withMainPreviewPassword(
      postLogin(enabledEnv.PORTFOLIO_MAIN_PREVIEW_PASSWORD!),
      enabledEnv,
      downstream().next,
      () => NOW,
    );
    const response = await withMainPreviewPassword(
      new Request("https://preview.example/index", {
        headers: { cookie: cookiePair(login)! },
      }),
      enabledEnv,
      async () => new Response("<!doctype html><html><body>Preview</body></html>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
      () => NOW + 1_000,
    );

    expect(
      response.headers.get("x-test-html-data-portfolio-analytics-context"),
    ).toBe("preview");
    expect(response.headers.get("x-robots-tag")).toBe(
      "noindex, nofollow, noarchive",
    );
  });

  it.each([
    { name: "tampered", offset: 1_000, tamper: true },
    { name: "expired", offset: SEVEN_DAYS + 1, tamper: false },
  ])("rejects a $name session cookie", async ({ offset, tamper }) => {
    const login = await withMainPreviewPassword(
      postLogin(enabledEnv.PORTFOLIO_MAIN_PREVIEW_PASSWORD!),
      enabledEnv,
      downstream().next,
      () => NOW,
    );
    const original = cookiePair(login)!;
    const cookie = tamper
      ? `${original.slice(0, -1)}${original.endsWith("a") ? "b" : "a"}`
      : original;
    const app = downstream();

    const response = await withMainPreviewPassword(
      new Request("https://preview.example/index", {
        headers: { accept: "text/html", cookie },
      }),
      enabledEnv,
      app.next,
      () => NOW + offset,
    );

    expect(response.status).toBe(303);
    expect(app.calls()).toBe(0);
  });

  it("rejects an off-site return target after successful login", async () => {
    const response = await withMainPreviewPassword(
      postLogin(enabledEnv.PORTFOLIO_MAIN_PREVIEW_PASSWORD!, "//evil.example/steal"),
      enabledEnv,
      downstream().next,
      () => NOW,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
  });

  it("rejects login request bodies larger than 4 KiB", async () => {
    const response = await withMainPreviewPassword(
      postLogin("x".repeat(4_096)),
      enabledEnv,
      downstream().next,
      () => NOW,
    );

    expect(response.status).toBe(413);
    expect(await response.text()).toBe("Request too large");
    expect(response.headers.get("x-robots-tag")).toBe(
      "noindex, nofollow, noarchive",
    );
  });
});
