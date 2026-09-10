import { describe, expect, it } from "vitest";
import {
  createReviewerCookieValue,
  handlePortfolioFeedbackAdmin,
  readReviewer,
  withPortfolioFeedback,
  type PortfolioFeedbackEnv,
} from "./portfolio-feedback";
import { PortfolioFeedbackObject } from "./portfolio-feedback-store";

const SECRET = "a-long-independent-session-signing-secret-for-preview-only";
const ADMIN_TOKEN = "an-equally-long-admin-token-that-only-bradley-holds-0001";

function namespace() {
  const values = new Map<string, unknown>();
  const object = new PortfolioFeedbackObject(
    {
      storage: {
        get: async (key) => values.get(key),
        put: async (key, value) => {
          values.set(key, value);
        },
        delete: async (key) => values.delete(key),
        list: async ({ prefix }) =>
          new Map([...values].filter(([key]) => key.startsWith(prefix))),
      },
    },
    {},
    () => 1_000,
    () => "note-1",
  );
  return {
    values,
    getByName: (name: string) => {
      expect(name).toBe("portfolio-feedback");
      return object;
    },
  };
}

function env(overrides: Partial<PortfolioFeedbackEnv> = {}): PortfolioFeedbackEnv {
  return {
    PORTFOLIO_FEEDBACK_ENABLED: "true",
    PORTFOLIO_FEEDBACK_ADMIN_TOKEN: ADMIN_TOKEN,
    PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET: SECRET,
    PORTFOLIO_FEEDBACK: namespace(),
    ...overrides,
  };
}

function downstream() {
  let calls = 0;
  return {
    calls: () => calls,
    next: async () => {
      calls += 1;
      return new Response("application");
    },
  };
}

async function reviewerCookie(code = "alice") {
  return `portfolio_reviewer=${await createReviewerCookieValue(SECRET, code)}`;
}

function postNote(cookie: string | null, body: unknown, contentType = "application/json") {
  const headers = new Headers({ "content-type": contentType });
  if (cookie) headers.set("cookie", cookie);
  return new Request("https://preview.example/_portfolio-feedback/notes", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("reviewer links", () => {
  it("turns ?r=<code> into a signed cookie and a named reviewer URL", async () => {
    const app = downstream();
    const response = await withPortfolioFeedback(
      new Request("https://preview.example/?view=graph&r=alice"),
      env(),
      app.next,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?view=graph&reviewer=alice");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(
      /^portfolio_reviewer=v1\.alice\.[A-Za-z0-9_-]+; Max-Age=7776000; Secure; SameSite=Lax; Path=\/$/u,
    );
    expect(cookie).not.toContain("HttpOnly");
    expect(app.calls()).toBe(0);

    const value = cookie.split(";", 1)[0];
    expect(
      await readReviewer(new Request("https://preview.example/", { headers: { cookie: value } }), SECRET),
    ).toBe("alice");
  });

  it("omits Secure on plain http so the local dev server can preview the flow", async () => {
    const response = await withPortfolioFeedback(
      new Request("http://localhost:5173/?r=alice"),
      env(),
      downstream().next,
    );
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^portfolio_reviewer=v1\.alice\./u);
    expect(cookie).not.toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("normalizes a typed code so a link written by hand still counts", async () => {
    const response = await withPortfolioFeedback(
      new Request("https://preview.example/?r=Sarah%20Smith"),
      env(),
      downstream().next,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?reviewer=sarah-smith");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^portfolio_reviewer=v1\.sarah-smith\./u);
    expect(await readReviewer(new Request("https://x/", { headers: { cookie: cookie.split(";", 1)[0] } }), SECRET)).toBe("sarah-smith");
  });

  it("strips a code with nothing usable in it without issuing a cookie", async () => {
    const response = await withPortfolioFeedback(
      new Request("https://preview.example/?r=%21%21"),
      env(),
      downstream().next,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("ignores a cookie signed with another secret or tampered with", async () => {
    const other = await createReviewerCookieValue(
      "a-different-secret-that-is-also-long-enough-0000",
      "alice",
    );
    expect(
      await readReviewer(
        new Request("https://x/", { headers: { cookie: `portfolio_reviewer=${other}` } }),
        SECRET,
      ),
    ).toBeNull();
    const good = await createReviewerCookieValue(SECRET, "alice");
    const renamed = good.replace("v1.alice.", "v1.bob.");
    expect(
      await readReviewer(
        new Request("https://x/", { headers: { cookie: `portfolio_reviewer=${renamed}` } }),
        SECRET,
      ),
    ).toBeNull();
  });

  it("passes every other request through untouched when disabled", async () => {
    const app = downstream();
    const response = await withPortfolioFeedback(
      new Request("https://preview.example/?r=alice"),
      env({ PORTFOLIO_FEEDBACK_ENABLED: "false" }),
      app.next,
    );
    expect(response.status).toBe(200);
    expect(app.calls()).toBe(1);

    const api = await withPortfolioFeedback(
      postNote(await reviewerCookie(), { note: "hi", path: "/" }),
      env({ PORTFOLIO_FEEDBACK_ENABLED: "false" }),
      app.next,
    );
    expect(api.status).toBe(404);
    expect(app.calls()).toBe(1);
  });
});

describe("reviewer note routes", () => {
  it("stores a note under the cookie's reviewer, ignoring any reviewer in the body", async () => {
    const feedback = env();
    const response = await withPortfolioFeedback(
      postNote(await reviewerCookie("alice"), {
        reviewer: "bradley",
        note: "The map label overlaps the mast.",
        path: "/?view=graph",
        target: { selector: "canvas.portfolio-world-canvas", offset: { x: 0.4, y: 0.3 } },
      }),
      feedback,
      downstream().next,
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      note: {
        id: "note-1",
        createdAt: 1_000,
        reviewer: "alice",
        note: "The map label overlaps the mast.",
        path: "/?view=graph",
        target: { selector: "canvas.portfolio-world-canvas", offset: { x: 0.4, y: 0.3 } },
      },
    });
  });

  it("requires the reviewer cookie", async () => {
    const response = await withPortfolioFeedback(
      postNote(null, { note: "hi", path: "/" }),
      env(),
      downstream().next,
    );
    expect(response.status).toBe(401);
  });

  it.each([
    ["a non-JSON content type", "text/plain", JSON.stringify({ note: "hi", path: "/" }), 415],
    ["a malformed body", "application/json", "{", 400],
    ["a note without text", "application/json", JSON.stringify({ path: "/" }), 400],
    [
      "an oversized body",
      "application/json",
      JSON.stringify({ note: "x".repeat(17_000), path: "/" }),
      400,
    ],
  ])("rejects %s", async (_label, contentType, body, status) => {
    const response = await withPortfolioFeedback(
      postNote(await reviewerCookie(), body, contentType),
      env(),
      downstream().next,
    );
    expect(response.status).toBe(status);
  });

  it("deletes only the reviewer's own note", async () => {
    const feedback = env();
    await withPortfolioFeedback(
      postNote(await reviewerCookie("alice"), { note: "mine", path: "/" }),
      feedback,
      downstream().next,
    );
    const asBob = await withPortfolioFeedback(
      new Request("https://preview.example/_portfolio-feedback/notes/note-1", {
        method: "DELETE",
        headers: { cookie: await reviewerCookie("bob") },
      }),
      feedback,
      downstream().next,
    );
    expect(asBob.status).toBe(404);
    const asAlice = await withPortfolioFeedback(
      new Request("https://preview.example/_portfolio-feedback/notes/note-1", {
        method: "DELETE",
        headers: { cookie: await reviewerCookie("alice") },
      }),
      feedback,
      downstream().next,
    );
    expect(asAlice.status).toBe(200);
  });

  it("never serves the admin route from inside the gate", async () => {
    const response = await withPortfolioFeedback(
      new Request("https://preview.example/_portfolio-feedback/admin/notes", {
        headers: { cookie: await reviewerCookie(), authorization: `Bearer ${ADMIN_TOKEN}` },
      }),
      env(),
      downstream().next,
    );
    expect(response.status).toBe(404);
  });
});

describe("admin route", () => {
  it("returns null for every other path", async () => {
    expect(
      await handlePortfolioFeedbackAdmin(new Request("https://preview.example/"), env()),
    ).toBeNull();
    expect(
      await handlePortfolioFeedbackAdmin(
        new Request("https://preview.example/_portfolio-feedback/notes"),
        env(),
      ),
    ).toBeNull();
  });

  it("requires the bearer token and never the password session", async () => {
    const feedback = env();
    await withPortfolioFeedback(
      postNote(await reviewerCookie("alice"), { note: "mine", path: "/" }),
      feedback,
      downstream().next,
    );

    const unauthenticated = await handlePortfolioFeedbackAdmin(
      new Request("https://preview.example/_portfolio-feedback/admin/notes"),
      feedback,
    );
    expect(unauthenticated?.status).toBe(401);
    const wrong = await handlePortfolioFeedbackAdmin(
      new Request("https://preview.example/_portfolio-feedback/admin/notes", {
        headers: { authorization: `Bearer ${ADMIN_TOKEN.slice(0, -1)}x` },
      }),
      feedback,
    );
    expect(wrong?.status).toBe(401);

    const json = await handlePortfolioFeedbackAdmin(
      new Request("https://preview.example/_portfolio-feedback/admin/notes", {
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      }),
      feedback,
    );
    expect(json?.status).toBe(200);
    expect(await json?.json()).toEqual({
      notes: [{ id: "note-1", createdAt: 1_000, reviewer: "alice", note: "mine", path: "/" }],
    });

    const markdown = await handlePortfolioFeedbackAdmin(
      new Request("https://preview.example/_portfolio-feedback/admin/notes?format=markdown", {
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      }),
      feedback,
    );
    expect(markdown?.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(await markdown?.text()).toContain("## alice (1)");
  });

  it("is absent without a strong token", async () => {
    const response = await handlePortfolioFeedbackAdmin(
      new Request("https://preview.example/_portfolio-feedback/admin/notes", {
        headers: { authorization: "Bearer short" },
      }),
      env({ PORTFOLIO_FEEDBACK_ADMIN_TOKEN: "short" }),
    );
    expect(response?.status).toBe(404);
  });
});
