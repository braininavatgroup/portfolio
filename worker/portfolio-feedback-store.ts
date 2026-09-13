// The reviewer feedback ledger: one Durable Object holds every note left on
// the deployed site. Reviewers only ever read back what they
// sent in the current visit (the client keeps that list in memory), so the
// object needs no per-reviewer read path beyond ownership checks on delete.
// Bradley reads everything through the worker's admin route.

/** A selected run of text, with a little context so an agent can find the exact run. */
export type FeedbackQuote = {
  text: string;
  prefix?: string;
  suffix?: string;
};

export type FeedbackTarget = {
  selector: string;
  component?: string;
  text?: string;
  rect?: { x: number; y: number; width: number; height: number };
  offset?: { x: number; y: number };
  quote?: FeedbackQuote;
};

export type FeedbackNoteInput = {
  reviewer: string;
  /** What the reviewer typed when their link carried a placeholder code. */
  reviewerName?: string;
  path: string;
  /** May be empty when `suggestion` carries the feedback. */
  note: string;
  /** A replacement for `target.quote.text`, in suggesting mode. */
  suggestion?: string;
  pageTitle?: string;
  target?: FeedbackTarget;
  viewport?: { width: number; height: number };
  userAgent?: string;
};

export type FeedbackNote = FeedbackNoteInput & {
  id: string;
  createdAt: number;
};

type FeedbackStorage = {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(options: { prefix: string }): Promise<Map<string, unknown>>;
};

type FeedbackState = { storage: FeedbackStorage };

const NOTE_PREFIX = "note:";
export const MAX_NOTES_TOTAL = 2_000;
export const MAX_NOTES_PER_REVIEWER = 300;
export const MAX_NOTE_LENGTH = 4_000;
export const MAX_FIELD_LENGTH = 600;
export const MAX_QUOTE_LENGTH = 600;
export const MAX_CONTEXT_LENGTH = 80;
export const REVIEWER_CODE = /^[a-z0-9][a-z0-9-]{1,31}$/u;
export const MAX_REVIEWER_NAME_LENGTH = 80;

/**
 * Codes a link ends up with when a message template was sent unedited
 * (`?r=[name]`, `?r=<code>`). Such a link still works, but the widget asks the
 * reviewer for their name so the digest can tell people apart.
 */
const PLACEHOLDER_REVIEWER_CODES = new Set([
  "name",
  "your-name",
  "yourname",
  "first-name",
  "firstname",
  "their-name",
  "code",
  "reviewer",
  "reviewer-code",
  "person",
  "guest",
]);

export function isPlaceholderReviewerCode(code: string) {
  return PLACEHOLDER_REVIEWER_CODES.has(code);
}

/**
 * Turns whatever Bradley typed into a link into a canonical reviewer code, so
 * `?r=Sarah Smith`, `?r=sarah.smith@acme.com`, or `?r=Élan` all count. Lowercase
 * ASCII letters, digits and single hyphens, at most 32 characters; null when
 * nothing usable remains.
 */
export function normalizeReviewerCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-")
    .slice(0, 32)
    .replace(/-+$/u, "");
  return REVIEWER_CODE.test(code) ? code : null;
}

function json(status: number, body: unknown) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 1_000) / 1_000 : undefined;
}

function shortString(value: unknown, limit = MAX_FIELD_LENGTH) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().slice(0, limit)
    : undefined;
}

function readTarget(value: unknown): FeedbackTarget | undefined {
  if (!value || typeof value !== "object") return undefined;
  const selector = shortString(Reflect.get(value, "selector"));
  if (!selector) return undefined;
  const target: FeedbackTarget = { selector };
  const component = shortString(Reflect.get(value, "component"), 120);
  const text = shortString(Reflect.get(value, "text"), 240);
  if (component) target.component = component;
  if (text) target.text = text;
  const rect = Reflect.get(value, "rect");
  if (rect && typeof rect === "object") {
    const x = finiteNumber(Reflect.get(rect, "x"));
    const y = finiteNumber(Reflect.get(rect, "y"));
    const width = finiteNumber(Reflect.get(rect, "width"));
    const height = finiteNumber(Reflect.get(rect, "height"));
    if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
      target.rect = { x, y, width, height };
    }
  }
  const offset = Reflect.get(value, "offset");
  if (offset && typeof offset === "object") {
    const x = finiteNumber(Reflect.get(offset, "x"));
    const y = finiteNumber(Reflect.get(offset, "y"));
    if (x !== undefined && y !== undefined) target.offset = { x, y };
  }
  const quote = Reflect.get(value, "quote");
  if (quote && typeof quote === "object") {
    const quoteText = shortString(Reflect.get(quote, "text"), MAX_QUOTE_LENGTH);
    if (quoteText) {
      target.quote = { text: quoteText };
      const prefix = shortString(Reflect.get(quote, "prefix"), MAX_CONTEXT_LENGTH);
      const suffix = shortString(Reflect.get(quote, "suffix"), MAX_CONTEXT_LENGTH);
      if (prefix) target.quote.prefix = prefix;
      if (suffix) target.quote.suffix = suffix;
    }
  }
  return target;
}

/**
 * Validates an untrusted note body into a `FeedbackNoteInput`, or returns the
 * field that failed. The reviewer is supplied by the worker from the signed
 * cookie, never from the body.
 */
export function readFeedbackNoteInput(
  body: unknown,
  reviewer: string,
): { input: FeedbackNoteInput } | { error: string } {
  if (!REVIEWER_CODE.test(reviewer)) return { error: "reviewer" };
  if (!body || typeof body !== "object") return { error: "body" };
  const note = shortString(Reflect.get(body, "note"), MAX_NOTE_LENGTH);
  const suggestion = shortString(Reflect.get(body, "suggestion"), MAX_NOTE_LENGTH);
  if (!note && !suggestion) return { error: "note" };
  const path = shortString(Reflect.get(body, "path"));
  if (!path || !path.startsWith("/")) return { error: "path" };

  const input: FeedbackNoteInput = { reviewer, path, note: note ?? "" };
  const reviewerName = shortString(Reflect.get(body, "reviewerName"), MAX_REVIEWER_NAME_LENGTH);
  if (reviewerName) input.reviewerName = reviewerName;
  const pageTitle = shortString(Reflect.get(body, "pageTitle"), 200);
  if (pageTitle) input.pageTitle = pageTitle;
  const target = readTarget(Reflect.get(body, "target"));
  if (target) input.target = target;
  if (suggestion) {
    // A suggestion replaces a quoted run of text; without the quote it is just a note.
    if (!target?.quote) return { error: "quote" };
    if (suggestion === target.quote.text) return { error: "suggestion" };
    input.suggestion = suggestion;
  }
  const viewport = Reflect.get(body, "viewport");
  if (viewport && typeof viewport === "object") {
    const width = finiteNumber(Reflect.get(viewport, "width"));
    const height = finiteNumber(Reflect.get(viewport, "height"));
    if (width !== undefined && height !== undefined) input.viewport = { width, height };
  }
  const userAgent = shortString(Reflect.get(body, "userAgent"), 300);
  if (userAgent) input.userAgent = userAgent;
  return { input };
}

function isFeedbackNote(value: unknown): value is FeedbackNote {
  if (!value || typeof value !== "object") return false;
  return (
    typeof Reflect.get(value, "id") === "string" &&
    Number.isSafeInteger(Reflect.get(value, "createdAt")) &&
    typeof Reflect.get(value, "reviewer") === "string" &&
    typeof Reflect.get(value, "note") === "string" &&
    typeof Reflect.get(value, "path") === "string"
  );
}

function noteKey(createdAt: number, id: string) {
  return `${NOTE_PREFIX}${String(createdAt).padStart(15, "0")}:${id}`;
}

export class PortfolioFeedbackObject {
  constructor(
    private readonly state: FeedbackState,
    _env: unknown = {},
    private readonly now: () => number = Date.now,
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {
    void _env;
  }

  private async allNotes() {
    const stored = await this.state.storage.list({ prefix: NOTE_PREFIX });
    const notes: FeedbackNote[] = [];
    for (const value of stored.values()) {
      if (isFeedbackNote(value)) notes.push(value);
    }
    return notes.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const [, root, id] = url.pathname.split("/");
    if (root !== "notes") return json(404, { error: "Not found" });

    if (request.method === "GET" && !id) {
      const reviewer = url.searchParams.get("reviewer");
      const notes = await this.allNotes();
      return json(200, {
        notes: reviewer ? notes.filter((note) => note.reviewer === reviewer) : notes,
      });
    }

    if (request.method === "POST" && !id) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json(400, { error: "body" });
      }
      const reviewer = body && typeof body === "object" ? Reflect.get(body, "reviewer") : undefined;
      const read = readFeedbackNoteInput(body, typeof reviewer === "string" ? reviewer : "");
      if ("error" in read) return json(400, { error: read.error });

      const notes = await this.allNotes();
      if (notes.length >= MAX_NOTES_TOTAL) return json(507, { error: "full" });
      if (notes.filter((note) => note.reviewer === read.input.reviewer).length >= MAX_NOTES_PER_REVIEWER) {
        return json(429, { error: "reviewer-limit" });
      }

      const note: FeedbackNote = { ...read.input, id: this.newId(), createdAt: this.now() };
      await this.state.storage.put(noteKey(note.createdAt, note.id), note);
      return json(201, { note });
    }

    if (request.method === "DELETE" && id) {
      const reviewer = url.searchParams.get("reviewer");
      const existing = (await this.allNotes()).find((note) => note.id === id);
      if (!existing) return json(404, { error: "Not found" });
      if (reviewer && existing.reviewer !== reviewer) return json(404, { error: "Not found" });
      await this.state.storage.delete(noteKey(existing.createdAt, existing.id));
      return json(200, { deleted: existing.id });
    }

    return json(405, { error: "Method not allowed" });
  }
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** The agent-readable digest Bradley pulls: grouped by reviewer, oldest first. */
export function feedbackNotesToMarkdown(notes: FeedbackNote[]) {
  const lines = [`# Portfolio feedback — ${notes.length} note${notes.length === 1 ? "" : "s"}`, ""];
  const byReviewer = new Map<string, FeedbackNote[]>();
  for (const note of notes) {
    byReviewer.set(note.reviewer, [...(byReviewer.get(note.reviewer) ?? []), note]);
  }
  for (const [reviewer, reviewerNotes] of byReviewer) {
    const names = [...new Set(reviewerNotes.map((note) => note.reviewerName).filter(Boolean))];
    const heading = names.length > 0 ? `${reviewer} — ${names.map((name) => `“${name}”`).join(", ")}` : reviewer;
    lines.push(`## ${heading} (${reviewerNotes.length})`, "");
    for (const note of reviewerNotes) {
      lines.push(`### ${dateFormatter.format(note.createdAt)} UTC · \`${note.path}\``, "");
      if (note.reviewerName && names.length > 1) lines.push(`- Name: ${note.reviewerName}`);
      if (note.note) {
        for (const paragraph of note.note.split(/\n+/u)) lines.push(`> ${paragraph}`);
        lines.push("");
      }
      if (note.target?.quote && note.suggestion) {
        lines.push("- Suggested edit:", "", "```diff", `- ${note.target.quote.text}`, `+ ${note.suggestion}`, "```", "");
      }
      if (note.pageTitle) lines.push(`- Page: ${note.pageTitle}`);
      if (note.target?.quote) {
        const { text, prefix, suffix } = note.target.quote;
        lines.push(`- Quote: “${text}”`);
        if (prefix || suffix) lines.push(`- Around: …${prefix ?? ""}⟨${text}⟩${suffix ?? ""}…`);
      }
      if (note.target) {
        const parts = [`- Target: \`${note.target.selector}\``];
        if (note.target.component) parts.push(`in \`${note.target.component}\``);
        if (note.target.text && !note.target.quote) parts.push(`— “${note.target.text}”`);
        lines.push(parts.join(" "));
        if (note.target.rect) {
          const { x, y, width, height } = note.target.rect;
          lines.push(`- Box: ${Math.round(width)}×${Math.round(height)} at (${Math.round(x)}, ${Math.round(y)})`);
        }
      }
      if (note.viewport) lines.push(`- Viewport: ${note.viewport.width}×${note.viewport.height}`);
      if (note.userAgent) lines.push(`- Browser: ${note.userAgent}`);
      lines.push(`- Note id: \`${note.id}\``, "");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
