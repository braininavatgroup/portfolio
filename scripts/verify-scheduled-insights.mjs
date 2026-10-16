#!/usr/bin/env node
// Read only the private dashboard the scheduled Worker wrote. The page contains
// recipient names and campaign codes, so never print its body or API errors.
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const OBJECT_URL = (accountId, name) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/biv-portfolio-insights/objects/runs/${name}`;

function readObject(fetcher, accountId, token, name) {
  return fetcher(OBJECT_URL(accountId, name), {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
}

function scheduledAt(now) {
  const scheduled = new Date(now);
  scheduled.setUTCHours(11, 10, 0, 0);
  if (scheduled.getTime() > now.getTime()) scheduled.setUTCDate(scheduled.getUTCDate() - 1);
  return scheduled.getTime();
}

export function verifyScheduledDashboard(html, modifiedAt, now = new Date()) {
  const modified = new Date(modifiedAt).getTime();
  if (!Number.isFinite(modified) || modified < scheduledAt(now) || modified > now.getTime()) {
    throw new Error("The saved dashboard was not written by a recent scheduled run");
  }
  const document = new JSDOM(html).window.document;
  const assigned = document.querySelector("#assigned-links");
  if (!assigned?.textContent?.includes("Link activity covers the last 90 days")) {
    throw new Error("The saved dashboard does not show the 90-day assigned-link lookback");
  }
  for (const source of ["Analytics Engine events", "Supabase assignments"]) {
    const entry = [...document.querySelectorAll(".freshness li")].find((item) =>
      item.querySelector(".strip-name")?.textContent?.trim() === source,
    );
    if (entry?.getAttribute("data-status") !== "fresh") {
      throw new Error(`The saved dashboard has no fresh ${source} source`);
    }
  }
  for (const row of assigned.querySelectorAll("details.assignment")) {
    const sessions = [...row.querySelectorAll("summary .cell")].find((cell) =>
      cell.querySelector(".cell-label")?.textContent?.trim() === "Link sessions",
    )?.querySelector(".cell-value")?.textContent?.trim();
    const count = Number(sessions?.replaceAll(",", ""));
    const state = row.getAttribute("data-state");
    const badge = row.querySelector("summary .badge")?.textContent?.trim();
    if (!sessions || !Number.isSafeInteger(count) || count < 0 ||
        state !== (count > 0 ? "active" : "idle") ||
        badge !== (count === 0 ? "No activity yet" : count === 1 ? "1 link session" : `${count.toLocaleString("en-US")} link sessions`)) {
      throw new Error("An assigned-link row disagrees with its session count");
    }
  }
}

export function verifyAssignmentSnapshot(snapshot, expectedActionIds, now = new Date(), requireExactSet = false) {
  const capturedAt = Date.parse(snapshot?.capturedAt);
  if (!Number.isFinite(capturedAt) || capturedAt < scheduledAt(now) || capturedAt > now.getTime()) {
    throw new Error('The assignment source was not captured by a recent scheduled run');
  }
  if (!Array.isArray(snapshot.value) || snapshot.configurationErrors?.length) {
    throw new Error('The scheduled assignment source is unavailable or invalid');
  }
  const actionIds = new Set(snapshot.value.map((row) => row?.actionRecordId));
  if (expectedActionIds.some((id) => !actionIds.has(id))) {
    throw new Error('A preserved assignment is missing from the scheduled source');
  }
  if (requireExactSet && (actionIds.size !== expectedActionIds.length || snapshot.value.length !== expectedActionIds.length)) {
    throw new Error('The scheduled assignment set differs from the reviewed migration');
  }
}

/** @param {{accountId: string, token: string, expectedActionIds?: string[], requireExactSet?: boolean, fetcher?: typeof fetch, now?: Date}} options */
export async function verifyStoredDashboard({ accountId, token, expectedActionIds = [], requireExactSet = false, fetcher = fetch, now = new Date() }) {
  if (!/^[a-f0-9]{32}$/iu.test(accountId ?? "") || !token) throw new Error("Cloudflare proof credentials are missing");
  const response = await readObject(fetcher, accountId, token, 'dashboard.html');
  if (!response.ok) throw new Error(`The saved dashboard read returned HTTP ${response.status}`);
  const modifiedAt = response.headers.get("last-modified");
  const html = await response.text();
  verifyScheduledDashboard(html, modifiedAt, now);
  if (expectedActionIds.length) {
    const source = await readObject(fetcher, accountId, token, 'source-assignments.json');
    if (!source.ok) throw new Error(`The assignment source read returned HTTP ${source.status}`);
    let snapshot;
    try { snapshot = await source.json(); }
    catch { throw new Error('The assignment source is not JSON'); }
    verifyAssignmentSnapshot(snapshot, expectedActionIds, now, requireExactSet);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const expectedActionIds = process.env.EXPECTED_ACTION_IDS?.split(',').map((id) => id.trim()).filter(Boolean) ?? [];
    if (expectedActionIds.some((id) => !/^[a-f0-9-]{36}$/iu.test(id))) throw new Error('Expected Action IDs must be UUIDs');
    const requireExactSet = process.env.RETIRE_LEGACY_CREDENTIAL === 'true';
    if (requireExactSet && (expectedActionIds.length !== 2 || new Set(expectedActionIds).size !== 2)) {
      throw new Error('Credential retirement requires two distinct preserved Action IDs');
    }
    await verifyStoredDashboard({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
      expectedActionIds,
      requireExactSet,
    });
    console.log(`Scheduled insights proof passed: fresh dashboard${expectedActionIds.length ? ' and preserved assignments' : ''}; identities omitted.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Scheduled insights proof failed");
    process.exitCode = 1;
  }
}
