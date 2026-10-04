#!/usr/bin/env node
// Read only the private dashboard the scheduled Worker wrote. The page contains
// recipient names and campaign codes, so never print its body or API errors.
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const OBJECT_URL = (accountId) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/biv-portfolio-insights/objects/runs/dashboard.html`;

export function verifyScheduledDashboard(html, modifiedAt, now = new Date()) {
  const modified = new Date(modifiedAt).getTime();
  const scheduled = new Date(now);
  scheduled.setUTCHours(11, 10, 0, 0);
  if (scheduled.getTime() > now.getTime()) scheduled.setUTCDate(scheduled.getUTCDate() - 1);
  if (!Number.isFinite(modified) || modified < scheduled.getTime() || modified > now.getTime()) {
    throw new Error("The saved dashboard was not written by a recent scheduled run");
  }
  const document = new JSDOM(html).window.document;
  const assigned = document.querySelector("#assigned-links");
  if (!assigned?.textContent?.includes("Link activity covers the last 90 days")) {
    throw new Error("The saved dashboard does not show the 90-day assigned-link lookback");
  }
  const row = [...assigned.querySelectorAll("details.assignment")].find((entry) =>
    entry.querySelector("summary .row-title")?.textContent?.trim() === "Activity from Peter Travers's assigned link",
  );
  if (!row || row.getAttribute("data-state") !== "active") {
    throw new Error("The expected assigned link is not active in the saved dashboard");
  }
  const sessions = [...row.querySelectorAll("summary .cell")].find((cell) =>
    cell.querySelector(".cell-label")?.textContent?.trim() === "Link sessions",
  )?.querySelector(".cell-value")?.textContent?.trim();
  if (sessions !== "6" || row.querySelector("summary .badge")?.textContent?.trim() !== "6 link sessions") {
    throw new Error("The expected assigned link does not show six sessions");
  }
}

export async function verifyStoredDashboard({ accountId, token, fetcher = fetch, now = new Date() }) {
  if (!/^[a-f0-9]{32}$/iu.test(accountId ?? "") || !token) throw new Error("Cloudflare proof credentials are missing");
  const response = await fetcher(OBJECT_URL(accountId), {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`The saved dashboard read returned HTTP ${response.status}`);
  const modifiedAt = response.headers.get("last-modified");
  const html = await response.text();
  verifyScheduledDashboard(html, modifiedAt, now);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await verifyStoredDashboard({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
    });
    console.log("Scheduled insights proof passed: fresh 90-day assigned-link page with six sessions.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Scheduled insights proof failed");
    process.exitCode = 1;
  }
}
