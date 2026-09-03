import { describe, expect, it } from "vitest";
import {
  feedbackNotesToMarkdown,
  isPlaceholderReviewerCode,
  MAX_NOTES_PER_REVIEWER,
  normalizeReviewerCode,
  PortfolioFeedbackObject,
  readFeedbackNoteInput,
} from "./portfolio-feedback-store";

describe("isPlaceholderReviewerCode", () => {
  it("recognises the codes an unedited message template produces", () => {
    for (const raw of ["[name]", "<name>", "{Name}", "your-name", "CODE", "[reviewer]"]) {
      expect(isPlaceholderReviewerCode(normalizeReviewerCode(raw)!)).toBe(true);
    }
    for (const raw of ["mom", "sarah-smith", "acme-team", "nameless"]) {
      expect(isPlaceholderReviewerCode(normalizeReviewerCode(raw)!)).toBe(false);
    }
  });
});

describe("normalizeReviewerCode", () => {
  it.each([
    ["alice", "alice"],
    ["Sarah Smith", "sarah-smith"],
    ["sarah.smith@acme.com", "sarah-smith-acme-com"],
    ["  Élan Vital!! ", "elan-vital"],
    ["--Acme__Team--", "acme-team"],
    ["a-very-long-reviewer-name-that-keeps-going-forever", "a-very-long-reviewer-name-that-k"],
  ])("turns %j into %j", (raw, code) => {
    expect(normalizeReviewerCode(raw)).toBe(code);
  });

  it.each(["", "x", "!!!", null, undefined])("rejects %j", (raw) => {
    expect(normalizeReviewerCode(raw)).toBeNull();
  });
});

function storage() {
  const values = new Map<string, unknown>();
  return {
    values,
    storage: {
      get: async (key: string) => values.get(key),
      put: async (key: string, value: unknown) => {
        values.set(key, value);
      },
      delete: async (key: string) => values.delete(key),
      list: async ({ prefix }: { prefix: string }) =>
        new Map([...values].filter(([key]) => key.startsWith(prefix))),
    },
  };
}

function object(state = storage(), clock = { now: 1_000 }) {
  let sequence = 0;
  return new PortfolioFeedbackObject(
    state,
    {},
    () => clock.now,
    () => `note-${(sequence += 1)}`,
  );
}

function post(target: PortfolioFeedbackObject, body: unknown) {
  return target.fetch(
    new Request("https://portfolio-feedback/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("readFeedbackNoteInput", () => {
  it("keeps only the fields it understands and trims them", () => {
    const read = readFeedbackNoteInput(
      {
        note: "  The summary wraps oddly.  ",
        path: "/?view=graph",
        pageTitle: "Bradley Berkman",
        reviewer: "spoofed",
        target: {
          selector: "main > .reader-summary",
          component: "reader-summary",
          text: "Make complexity legible",
          rect: { x: 10.12345, y: 20, width: 300, height: 48 },
          offset: { x: 0.5, y: 0.25 },
          extra: "dropped",
        },
        viewport: { width: 1440, height: 900 },
        userAgent: "TestBrowser/1.0",
        admin: true,
      },
      "alice",
    );

    expect(read).toEqual({
      input: {
        reviewer: "alice",
        path: "/?view=graph",
        note: "The summary wraps oddly.",
        pageTitle: "Bradley Berkman",
        target: {
          selector: "main > .reader-summary",
          component: "reader-summary",
          text: "Make complexity legible",
          rect: { x: 10.123, y: 20, width: 300, height: 48 },
          offset: { x: 0.5, y: 0.25 },
        },
        viewport: { width: 1440, height: 900 },
        userAgent: "TestBrowser/1.0",
      },
    });
  });

  it.each([
    [{ path: "/" }, "note"],
    [{ note: "   ", path: "/" }, "note"],
    [{ note: "hi", path: "https://elsewhere" }, "path"],
    [{ note: "hi" }, "path"],
    ["text", "body"],
  ])("rejects %j as %s", (body, error) => {
    expect(readFeedbackNoteInput(body, "alice")).toEqual({ error });
  });

  it("keeps a quote with its context and a suggestion that replaces it", () => {
    const read = readFeedbackNoteInput(
      {
        note: "",
        suggestion: "Make complexity legible enough to act on.",
        path: "/",
        target: {
          selector: "p.reader-summary",
          quote: { text: "Make complexity legible.", prefix: "I ", suffix: " Hey," },
        },
      },
      "alice",
    );
    expect(read).toEqual({
      input: {
        reviewer: "alice",
        path: "/",
        note: "",
        suggestion: "Make complexity legible enough to act on.",
        target: {
          selector: "p.reader-summary",
          quote: { text: "Make complexity legible.", prefix: "I", suffix: "Hey," },
        },
      },
    });
  });

  it.each([
    [{ suggestion: "new", path: "/", target: { selector: "p" } }, "quote"],
    [{ suggestion: "same", path: "/", target: { selector: "p", quote: { text: "same" } } }, "suggestion"],
    [{ note: "", path: "/", target: { selector: "p", quote: { text: "q" } } }, "note"],
  ])("rejects a suggestion without a differing quote: %j", (body, error) => {
    expect(readFeedbackNoteInput(body, "alice")).toEqual({ error });
  });

  it("keeps the name a reviewer typed on a placeholder link", () => {
    const read = readFeedbackNoteInput(
      { note: "Lovely.", path: "/", reviewerName: "  Mom  " },
      "name",
    );
    expect(read).toEqual({ input: { reviewer: "name", reviewerName: "Mom", path: "/", note: "Lovely." } });
  });

  it("rejects a reviewer code the cookie could never carry", () => {
    expect(readFeedbackNoteInput({ note: "hi", path: "/" }, "Not Valid")).toEqual({
      error: "reviewer",
    });
  });
});

describe("PortfolioFeedbackObject", () => {
  it("stores notes in arrival order and lists them per reviewer or in full", async () => {
    const state = storage();
    const clock = { now: 1_000 };
    const ledger = object(state, clock);

    const first = await post(ledger, { reviewer: "alice", note: "one", path: "/" });
    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({
      note: { id: "note-1", createdAt: 1_000, reviewer: "alice", note: "one", path: "/" },
    });
    clock.now = 2_000;
    await post(ledger, { reviewer: "bob", note: "two", path: "/privacy" });
    clock.now = 3_000;
    await post(ledger, { reviewer: "alice", note: "three", path: "/" });

    const all = await (await ledger.fetch(new Request("https://portfolio-feedback/notes"))).json();
    expect((all as { notes: { note: string }[] }).notes.map((note) => note.note)).toEqual([
      "one",
      "two",
      "three",
    ]);
    const alice = await (
      await ledger.fetch(new Request("https://portfolio-feedback/notes?reviewer=alice"))
    ).json();
    expect((alice as { notes: { note: string }[] }).notes.map((note) => note.note)).toEqual([
      "one",
      "three",
    ]);
  });

  it("lets a reviewer delete only their own note", async () => {
    const ledger = object();
    await post(ledger, { reviewer: "alice", note: "mine", path: "/" });

    const asBob = await ledger.fetch(
      new Request("https://portfolio-feedback/notes/note-1?reviewer=bob", { method: "DELETE" }),
    );
    expect(asBob.status).toBe(404);

    const asAlice = await ledger.fetch(
      new Request("https://portfolio-feedback/notes/note-1?reviewer=alice", { method: "DELETE" }),
    );
    expect(asAlice.status).toBe(200);
    expect(await asAlice.json()).toEqual({ deleted: "note-1" });

    const again = await ledger.fetch(
      new Request("https://portfolio-feedback/notes/note-1?reviewer=alice", { method: "DELETE" }),
    );
    expect(again.status).toBe(404);
  });

  it("rejects malformed bodies and caps one reviewer's notes", async () => {
    const ledger = object();
    const malformed = await ledger.fetch(
      new Request("https://portfolio-feedback/notes", { method: "POST", body: "{" }),
    );
    expect(malformed.status).toBe(400);
    expect((await post(ledger, { reviewer: "alice", path: "/" })).status).toBe(400);

    for (let index = 0; index < MAX_NOTES_PER_REVIEWER; index += 1) {
      expect((await post(ledger, { reviewer: "carol", note: `n${index}`, path: "/" })).status).toBe(201);
    }
    const overflow = await post(ledger, { reviewer: "carol", note: "one more", path: "/" });
    expect(overflow.status).toBe(429);
    expect((await post(ledger, { reviewer: "dave", note: "fine", path: "/" })).status).toBe(201);
  });
});

describe("feedbackNotesToMarkdown", () => {
  it("groups by reviewer with the target details an agent needs", () => {
    const markdown = feedbackNotesToMarkdown([
      {
        id: "a1",
        createdAt: Date.UTC(2026, 8, 3, 14, 2),
        reviewer: "alice",
        path: "/?view=graph",
        note: "The summary wraps oddly.\nSecond line.",
        pageTitle: "Bradley Berkman",
        target: {
          selector: "main > .reader-summary",
          component: "reader-summary",
          text: "Make complexity legible",
          rect: { x: 10, y: 20, width: 300.4, height: 48 },
        },
        viewport: { width: 1440, height: 900 },
      },
      { id: "b1", createdAt: Date.UTC(2026, 8, 3, 15), reviewer: "bob", path: "/", note: "Lovely." },
      { id: "n1", createdAt: Date.UTC(2026, 8, 3, 16), reviewer: "name", reviewerName: "Mom", path: "/", note: "So proud." },
      { id: "n2", createdAt: Date.UTC(2026, 8, 3, 16, 5), reviewer: "name", reviewerName: "Uncle Ray", path: "/", note: "Nice map." },
      {
        id: "b2",
        createdAt: Date.UTC(2026, 8, 3, 15, 5),
        reviewer: "bob",
        path: "/",
        note: "",
        suggestion: "trading sheep for bricks",
        target: {
          selector: "p.reader-composed-body",
          component: "reader-composed-body",
          text: "trading sheep for brick over a Catan board",
          quote: { text: "trading sheep for brick", prefix: "consciousness, ", suffix: " over a Catan" },
        },
      },
    ]);

    expect(markdown).toBe(`# Portfolio feedback — 5 notes

## alice (1)

### 3 Sept 2026, 14:02 UTC · \`/?view=graph\`

> The summary wraps oddly.
> Second line.

- Page: Bradley Berkman
- Target: \`main > .reader-summary\` in \`reader-summary\` — “Make complexity legible”
- Box: 300×48 at (10, 20)
- Viewport: 1440×900
- Note id: \`a1\`

## bob (2)

### 3 Sept 2026, 15:00 UTC · \`/\`

> Lovely.

- Note id: \`b1\`

### 3 Sept 2026, 15:05 UTC · \`/\`

- Suggested edit:

\`\`\`diff
- trading sheep for brick
+ trading sheep for bricks
\`\`\`

- Quote: “trading sheep for brick”
- Around: …consciousness, ⟨trading sheep for brick⟩ over a Catan…
- Target: \`p.reader-composed-body\` in \`reader-composed-body\`
- Note id: \`b2\`

## name — “Mom”, “Uncle Ray” (2)

### 3 Sept 2026, 16:00 UTC · \`/\`

- Name: Mom
> So proud.

- Note id: \`n1\`

### 3 Sept 2026, 16:05 UTC · \`/\`

- Name: Uncle Ray
> Nice map.

- Note id: \`n2\`
`);
  });
});
