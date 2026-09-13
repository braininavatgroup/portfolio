#!/usr/bin/env node
// Pull reviewer notes off the deployed site, or mint a reviewer link.
//
//   node scripts/portfolio-feedback.mjs                 # markdown digest
//   node scripts/portfolio-feedback.mjs --json          # raw notes
//   node scripts/portfolio-feedback.mjs --link alice    # https://…/?r=alice
//
// The admin token comes from PORTFOLIO_FEEDBACK_ADMIN_TOKEN if set, otherwise
// from the macOS login Keychain entry `scripts/setup-portfolio-feedback.sh`
// writes. `--site <origin>` overrides the default https://bradleyberkman.com.
// The admin route sits outside the reviewer cookie check and authenticates with
// the token alone.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_SITE = "https://bradleyberkman.com";
const KEYCHAIN_SERVICE = "biv-portfolio-feedback";
const KEYCHAIN_ACCOUNT = "admin-token";
const ADMIN_PATH = "/_portfolio-feedback/admin/notes";
const REVIEWER_CODE = /^[a-z0-9][a-z0-9-]{1,31}$/u;
// Mirrors PLACEHOLDER_REVIEWER_CODES in worker/portfolio-feedback-store.ts.
const PLACEHOLDER_CODES = new Set([
  "name", "your-name", "yourname", "first-name", "firstname", "their-name",
  "code", "reviewer", "reviewer-code", "person", "guest",
]);

function parseArguments(argv) {
  const options = { site: DEFAULT_SITE, json: false, link: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--site") options.site = argv[(index += 1)] ?? options.site;
    else if (argument === "--link") options.link = argv[(index += 1)] ?? "";
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

// Mirrors normalizeReviewerCode in worker/portfolio-feedback-store.ts: the
// worker applies the same rule when the link is opened, so a hand-typed
// `?r=Sarah Smith` still counts; this only shows the canonical form up front.
export function normalizeReviewerCode(raw) {
  const code = String(raw ?? "")
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

export function reviewerLink(site, raw) {
  const code = normalizeReviewerCode(raw);
  if (!code) {
    throw new Error("A reviewer code needs at least two letters or digits, e.g. alice or \"Sarah Smith\".");
  }
  if (PLACEHOLDER_CODES.has(code)) {
    throw new Error(`"${raw}" looks like a placeholder; put the person's actual name in the link.`);
  }
  const url = new URL(site);
  url.pathname = "/";
  url.search = `?r=${code}`;
  return url.href;
}

async function resolveAdminToken() {
  const explicit = process.env.PORTFOLIO_FEEDBACK_ADMIN_TOKEN?.trim();
  if (explicit) return explicit;
  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync(
        "/usr/bin/security",
        ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT, "-w"],
        { encoding: "utf8" },
      );
      if (stdout.trim()) return stdout.trim();
    } catch {
      // The setup message below is the useful error for every Keychain failure.
    }
  }
  throw new Error(
    "No admin token. Run `npm run setup:feedback` once, or set PORTFOLIO_FEEDBACK_ADMIN_TOKEN.",
  );
}

async function fetchNotes(site, token, json) {
  const url = new URL(ADMIN_PATH, site);
  if (!json) url.searchParams.set("format", "markdown");
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new Error(`The feedback route answered ${response.status}. Is PORTFOLIO_FEEDBACK_ADMIN_TOKEN current and feedback enabled?`);
  }
  return response.text();
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.link !== null) {
    process.stdout.write(`${reviewerLink(options.site, options.link)}\n`);
    return;
  }
  process.stdout.write(await fetchNotes(options.site, await resolveAdminToken(), options.json));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
