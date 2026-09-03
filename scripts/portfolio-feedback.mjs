#!/usr/bin/env node
// Pull reviewer notes off the password-protected preview, or mint a reviewer link.
//
//   PORTFOLIO_FEEDBACK_ADMIN_TOKEN=… node scripts/portfolio-feedback.mjs            # markdown digest
//   PORTFOLIO_FEEDBACK_ADMIN_TOKEN=… node scripts/portfolio-feedback.mjs --json     # raw notes
//   node scripts/portfolio-feedback.mjs --link alice                                  # https://…/?r=alice
//
// `--site <origin>` overrides the default https://bradleyberkman.com. The admin
// route sits outside the password gate and authenticates with the token alone,
// so this never needs the preview password.

const DEFAULT_SITE = "https://bradleyberkman.com";
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
  const token = process.env.PORTFOLIO_FEEDBACK_ADMIN_TOKEN;
  if (!token) throw new Error("Set PORTFOLIO_FEEDBACK_ADMIN_TOKEN to the Worker's admin secret.");
  process.stdout.write(await fetchNotes(options.site, token, options.json));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
