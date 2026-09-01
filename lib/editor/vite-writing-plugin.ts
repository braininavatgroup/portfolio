// Local writing endpoint for the inline portfolio editor. This Vite plugin
// runs only in the Node process that starts the development server; the
// Cloudflare Worker application and production route graph receive no
// filesystem or Git capability, and production builds omit the endpoints
// entirely (`apply: "serve"`).
//
// It owns: the /__portfolio-editor session, save, and status routes; token and
// origin checks; schema validation; atomic writes; branch guards; content-only
// Git commits; and a bounded commit flush at shutdown. It never pushes, opens
// a pull request, deploys, or changes branch.

import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promises as fs, realpathSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import type { Plugin } from "vite";
import {
  applyContentEdit,
  validatePortfolioContentDocument,
  type PortfolioContentDocument,
} from "../portfolio-content-schema";

const execFileAsync = promisify(execFile);

export const PORTFOLIO_CONTENT_FILE = "content/portfolio-content.json";
export const COMMIT_MESSAGE = "content: update portfolio copy";
const DEFAULT_COMMIT_DELAY_MS = 2000;
const FLUSH_TIMEOUT_MS = 5000;
const HOT_SUPPRESS_WINDOW_MS = 3000;
const PROTECTED_BRANCHES = new Set(["main", "master", "HEAD", ""]);

export type WritingRuntimeOptions = {
  cwd?: string;
  contentFileName?: string;
  commitDelayMs?: number;
};

export type SaveRequestContext = {
  token: string | undefined;
  origin: string | undefined;
  host: string | undefined;
};

export type EndpointResult = {
  status: number;
  body: Record<string, unknown>;
};

type LastCommit = { hash: string } | { error: string } | null;

export class PortfolioWritingRuntime {
  readonly repoRoot: string;
  readonly branch: string;
  readonly contentPath: string;
  readonly token: string;
  private readonly commitDelayMs: number;
  private revision: number;
  private commitTimer: ReturnType<typeof setTimeout> | null = null;
  private committing: Promise<void> | null = null;
  private lastCommit: LastCommit = null;
  private lastWriteMs = 0;
  private writeCounter = 0;

  private constructor(args: {
    repoRoot: string;
    branch: string;
    contentPath: string;
    commitDelayMs: number;
    revision: number;
  }) {
    this.repoRoot = args.repoRoot;
    this.branch = args.branch;
    this.contentPath = args.contentPath;
    this.commitDelayMs = args.commitDelayMs;
    this.revision = args.revision;
    this.token = randomBytes(24).toString("hex");
  }

  static async create(
    options: WritingRuntimeOptions = {},
  ): Promise<PortfolioWritingRuntime> {
    const cwd = options.cwd ?? process.cwd();
    const repoRoot = (
      await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd })
    ).stdout.trim();
    const branch = (
      await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd })
    ).stdout.trim();
    const contentPath = path.resolve(
      repoRoot,
      options.contentFileName ?? PORTFOLIO_CONTENT_FILE,
    );
    const relative = path.relative(repoRoot, contentPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("portfolio content file must live inside the repository");
    }
    const document = await readContentDocument(contentPath);
    return new PortfolioWritingRuntime({
      repoRoot,
      branch,
      contentPath,
      commitDelayMs: options.commitDelayMs ?? DEFAULT_COMMIT_DELAY_MS,
      revision: document.revision,
    });
  }

  get writable(): boolean {
    return !PROTECTED_BRANCHES.has(this.branch);
  }

  session(): EndpointResult {
    return {
      status: 200,
      body: {
        token: this.token,
        revision: this.revision,
        branch: this.branch,
        writable: this.writable,
      },
    };
  }

  status(context: SaveRequestContext): EndpointResult {
    if (context.token !== this.token) {
      return { status: 403, body: { message: "invalid editor session token" } };
    }
    return {
      status: 200,
      body: {
        revision: this.revision,
        pending: this.commitTimer !== null || this.committing !== null,
        lastCommit: this.lastCommit,
      },
    };
  }

  private async guardBranch(): Promise<string | null> {
    if (!this.writable) {
      return `writes are disabled on branch ${this.branch || "(detached)"}`;
    }
    const current = (
      await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: this.repoRoot,
      })
    ).stdout.trim();
    if (current !== this.branch) {
      return `HEAD moved from ${this.branch} to ${current || "(detached)"}; restart the dev server`;
    }
    const relative = path.relative(this.repoRoot, this.contentPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return "content path escaped the repository root";
    }
    return null;
  }

  async save(
    payload: unknown,
    context: SaveRequestContext,
  ): Promise<EndpointResult> {
    if (context.token !== this.token) {
      return { status: 403, body: { message: "invalid editor session token" } };
    }
    if (context.origin !== undefined) {
      const originHost = safeOriginHost(context.origin);
      if (!originHost || originHost !== context.host) {
        return { status: 403, body: { message: "cross-origin save rejected" } };
      }
    }
    const branchProblem = await this.guardBranch();
    if (branchProblem) {
      return { status: 409, body: { code: "branch", message: branchProblem } };
    }
    if (typeof payload !== "object" || payload === null) {
      return { status: 400, body: { message: "save payload must be an object" } };
    }
    const edit = payload as { path?: unknown; value?: unknown; revision?: unknown };

    let document: PortfolioContentDocument;
    try {
      document = await readContentDocument(this.contentPath);
    } catch (error) {
      return {
        status: 500,
        body: {
          message: `content file is unreadable: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
    this.revision = document.revision;

    const result = applyContentEdit(document, {
      path: edit.path,
      value: edit.value,
      revision: edit.revision,
    });
    if (!result.ok) {
      const status = result.code === "stale-revision" ? 409 : 400;
      return {
        status,
        body: {
          code: result.code,
          message: result.message,
          ...(result.currentRevision !== undefined
            ? { revision: result.currentRevision }
            : {}),
        },
      };
    }

    if (result.unchanged) {
      return {
        status: 200,
        body: { revision: this.revision, save: "unchanged", commit: "none" },
      };
    }

    try {
      await this.writeAtomically(result.document);
    } catch (error) {
      return {
        status: 500,
        body: {
          message: `save failed; previous content preserved: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
    this.revision = result.document.revision;
    this.scheduleCommit();
    return {
      status: 200,
      body: { revision: this.revision, save: "saved", commit: "pending" },
    };
  }

  private async writeAtomically(document: PortfolioContentDocument) {
    this.writeCounter += 1;
    const tmpPath = `${this.contentPath}.tmp-${process.pid}-${this.writeCounter}`;
    const serialized = `${JSON.stringify(document, null, 2)}\n`;
    try {
      await fs.writeFile(tmpPath, serialized, "utf8");
      await fs.rename(tmpPath, this.contentPath);
    } catch (error) {
      await fs.rm(tmpPath, { force: true }).catch(() => undefined);
      throw error;
    }
    this.lastWriteMs = Date.now();
  }

  // The Vite hot-update hook uses this to suppress reload propagation for the
  // plugin's own writes while an editor session is active.
  suppressesHotUpdate(file: string): boolean {
    let resolved = path.resolve(file);
    try {
      resolved = realpathSync(resolved);
    } catch {
      // Keep the lexically resolved path when the file vanished mid-check.
    }
    return (
      resolved === this.contentPath &&
      Date.now() - this.lastWriteMs < HOT_SUPPRESS_WINDOW_MS
    );
  }

  private scheduleCommit() {
    if (this.commitTimer) clearTimeout(this.commitTimer);
    this.commitTimer = setTimeout(() => {
      this.commitTimer = null;
      this.committing = this.commitContentOnly().finally(() => {
        this.committing = null;
      });
    }, this.commitDelayMs);
  }

  // Commits only the content file, with the repository's configured identity
  // and hooks. Unrelated staged and unstaged changes are never touched.
  async commitContentOnly(): Promise<void> {
    try {
      const branchProblem = await this.guardBranch();
      if (branchProblem) {
        this.lastCommit = { error: branchProblem };
        return;
      }
      const relativeContent = path.relative(this.repoRoot, this.contentPath);
      const { stdout: pending } = await execFileAsync(
        "git",
        ["status", "--porcelain", "--", relativeContent],
        { cwd: this.repoRoot },
      );
      if (!pending.trim()) return;
      await execFileAsync(
        "git",
        ["commit", "-m", COMMIT_MESSAGE, "--", relativeContent],
        { cwd: this.repoRoot },
      );
      const { stdout: hash } = await execFileAsync(
        "git",
        ["rev-parse", "--short", "HEAD"],
        { cwd: this.repoRoot },
      );
      this.lastCommit = { hash: hash.trim() };
    } catch (error) {
      this.lastCommit = {
        error: error instanceof Error ? sanitizeGitError(error.message) : "git commit failed",
      };
    }
  }

  // One bounded commit attempt at shutdown. If it fails, the saved content
  // remains recoverable from the working tree.
  async flush(): Promise<void> {
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
      this.committing = this.commitContentOnly().finally(() => {
        this.committing = null;
      });
    }
    if (this.committing) {
      await Promise.race([
        this.committing,
        new Promise((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS)),
      ]);
    }
  }
}

async function readContentDocument(
  contentPath: string,
): Promise<PortfolioContentDocument> {
  const raw = await fs.readFile(contentPath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  const issues = validatePortfolioContentDocument(parsed);
  if (issues.length > 0) {
    throw new Error(
      `invalid content document: ${issues[0].path}: ${issues[0].message}`,
    );
  }
  return parsed as PortfolioContentDocument;
}

function safeOriginHost(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

function sanitizeGitError(message: string): string {
  return message.split("\n").slice(0, 3).join(" ").slice(0, 300);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 512 * 1024) throw new Error("save payload too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res: ServerResponse, result: EndpointResult) {
  res.statusCode = result.status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(result.body));
}

export function createEditorRequestHandler(runtime: PortfolioWritingRuntime) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url ?? "";
    const route = url.split("?")[0];
    const context: SaveRequestContext = {
      token: firstHeader(req.headers["x-portfolio-editor-token"]),
      origin: firstHeader(req.headers.origin),
      host: firstHeader(req.headers.host),
    };
    try {
      if (route === "/session" && req.method === "GET") {
        if (context.origin !== undefined) {
          const originHost = safeOriginHost(context.origin);
          if (!originHost || originHost !== context.host) {
            sendJson(res, {
              status: 403,
              body: { message: "cross-origin session rejected" },
            });
            return;
          }
        }
        sendJson(res, runtime.session());
        return;
      }
      if (route === "/status" && req.method === "GET") {
        sendJson(res, runtime.status(context));
        return;
      }
      if (route === "/save" && req.method === "POST") {
        let payload: unknown;
        try {
          payload = await readJsonBody(req);
        } catch (error) {
          sendJson(res, {
            status: 400,
            body: {
              message:
                error instanceof Error ? error.message : "invalid JSON payload",
            },
          });
          return;
        }
        sendJson(res, await runtime.save(payload, context));
        return;
      }
      next();
    } catch (error) {
      sendJson(res, {
        status: 500,
        body: {
          message: error instanceof Error ? error.message : "editor endpoint failed",
        },
      });
    }
  };
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function portfolioWritingPlugin(): Plugin {
  let runtime: PortfolioWritingRuntime | null = null;
  return {
    name: "portfolio-writing",
    apply: "serve",
    async configureServer(server) {
      try {
        runtime = await PortfolioWritingRuntime.create();
      } catch (error) {
        server.config.logger.warn(
          `[portfolio-writing] disabled: ${error instanceof Error ? error.message : String(error)}`,
        );
        return;
      }
      const handler = createEditorRequestHandler(runtime);
      server.middlewares.use("/__portfolio-editor", (req, res, next) => {
        void handler(req, res, next);
      });
      server.httpServer?.once("close", () => {
        void runtime?.flush();
      });
    },
    hotUpdate(context) {
      if (runtime?.suppressesHotUpdate(context.file)) {
        // Writing the content file must not reload the page or steal the
        // caret mid-edit; a manual reload picks up the saved content.
        return [];
      }
    },
  };
}
