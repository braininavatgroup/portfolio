#!/usr/bin/env node
// Pull reviewer notes off the password-protected preview, or mint a reviewer link.
//
//   node scripts/portfolio-feedback.mjs                 # markdown digest
//   node scripts/portfolio-feedback.mjs --json          # raw notes
//   node scripts/portfolio-feedback.mjs --link alice    # https://…/?r=alice
//
// The admin token comes from PORTFOLIO_FEEDBACK_ADMIN_TOKEN if set, otherwise
// from the macOS login Keychain entry `scripts/setup-portfolio-feedback.sh`
// writes. `--site <origin>` overrides the default https://bradleyberkman.com.
// The admin route sits outside the password gate and authenticates with the
// token alone, so this never needs the preview password.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_SITE = "https://bradleyberkman.com";
const KEYCHAIN_SERVICE = "biv-portfolio-feedback";
const KEYCHAIN_ACCOUNT = "admin-token";
const ADMIN_PATH = "/_portfolio-feedback/admin/notes";
const REVIEWER_CODE = /^[a-z0-9][a-z0-9-]{1,31}$/u;

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

export function reviewerLink(site, code) {
  if (!REVIEWER_CODE.test(code)) {
    throw new Error("A reviewer code is 2–32 lowercase letters, digits, or hyphens, e.g. alice or acme-team.");
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
