import { describe, expect, it } from "vitest";
import { verifyScheduledDashboard, verifyStoredDashboard, verifyAssignmentSnapshot } from "./verify-scheduled-insights.mjs";

const now = new Date("2026-10-04T11:40:00.000Z");
const modified = "Sun, 04 Oct 2026 11:12:00 GMT";
const page = `
  <ul class="freshness">
    <li data-status="fresh"><span class="strip-name">Analytics Engine events</span></li>
    <li data-status="fresh"><span class="strip-name">Supabase assignments</span></li>
  </ul>
  <section id="assigned-links">
    <p>Link activity covers the last 90 days (since 2026-07-07).</p>
    <details class="assignment" data-state="active"><summary>
      <span class="row-title">Activity from Synthetic Recipient's assigned link</span>
      <span class="badge">137 link sessions</span>
      <span class="cell"><span class="cell-label">Link sessions</span><span class="cell-value">137</span></span>
    </summary></details>
  </section>`;
const zeroSessions = page.replace("137 link sessions", "No activity yet").replace('class="cell-value">137', 'class="cell-value">0');
const manySessions = page.replace("137 link sessions", "1,000 link sessions").replace('class="cell-value">137', 'class="cell-value">1,000');

describe("scheduled insights proof", () => {
  it("accepts a fresh saved page with consistent assigned-link activity", () => {
    expect(() => verifyScheduledDashboard(page, modified, now)).not.toThrow();
    expect(() => verifyScheduledDashboard(zeroSessions.replace('data-state="active"', 'data-state="idle"'), modified, now)).not.toThrow();
    expect(() => verifyScheduledDashboard(manySessions, modified, now)).not.toThrow();
    expect(() => verifyScheduledDashboard(page.replace(/<details class="assignment"[\s\S]*?<\/details>/u, ""), modified, now)).not.toThrow();
  });

  it("rejects an old page, a window fallback, stale sources, and inconsistent counts", () => {
    expect(() => verifyScheduledDashboard(page, "Fri, 02 Oct 2026 11:12:00 GMT", now)).toThrow(/recent/u);
    expect(() => verifyScheduledDashboard(page.replace("last 90 days", "report window"), modified, now)).toThrow(/90-day/u);
    expect(() => verifyScheduledDashboard(page.replace('data-status="fresh"', 'data-status="stale"'), modified, now)).toThrow(/fresh Analytics/u);
    expect(() => verifyScheduledDashboard(zeroSessions, modified, now)).toThrow(/disagrees/u);
  });

  it("reads only the scheduled dashboard object with the supplied token", async () => {
    const requests: Array<{ url: string; authorization: string }> = [];
    await verifyStoredDashboard({
      accountId: "a".repeat(32),
      token: "private-token",
      now,
      fetcher: async (input, options) => {
        requests.push({ url: String(input), authorization: new Headers(options?.headers).get("authorization") ?? "" });
        return new Response(page, { headers: { "last-modified": modified } });
      },
    });
    expect(requests).toEqual([{
      url: `https://api.cloudflare.com/client/v4/accounts/${"a".repeat(32)}/r2/buckets/biv-portfolio-insights/objects/runs/dashboard.html`,
      authorization: "Bearer private-token",
    }]);
  });

  it("requires the current scheduled source to contain the preserved assignments without configuration errors", () => {
    const snapshot: { capturedAt: string; value: { actionRecordId: string }[] | null; configurationErrors?: string[] } = {
      capturedAt: "2026-10-04T11:12:00.000Z", value: [{ actionRecordId: "first" }, { actionRecordId: "second" }],
    };
    expect(() => verifyAssignmentSnapshot(snapshot, ["first", "second"], now)).not.toThrow();
    expect(() => verifyAssignmentSnapshot({ ...snapshot, capturedAt: "2026-10-03T11:12:00.000Z" }, ["first"], now)).toThrow(/recent/u);
    expect(() => verifyAssignmentSnapshot({ ...snapshot, configurationErrors: ["invalid"] }, ["first"], now)).toThrow(/invalid/u);
    expect(() => verifyAssignmentSnapshot({ ...snapshot, value: null }, ["first"], now)).toThrow(/unavailable/u);
    expect(() => verifyAssignmentSnapshot(snapshot, ["third"], now)).toThrow(/preserved/u);
    expect(() => verifyAssignmentSnapshot(snapshot, ["first"], now, true)).toThrow(/differs/u);
    expect(() => verifyAssignmentSnapshot(snapshot, ["first", "second"], now, true)).not.toThrow();
  });

  it("checks the private source only when preserved Action IDs were supplied", async () => {
    const requests: string[] = [];
    await verifyStoredDashboard({
      accountId: "a".repeat(32), token: "private-token", expectedActionIds: ["first"], now,
      fetcher: async (input) => {
        requests.push(String(input));
        return String(input).endsWith("source-assignments.json")
          ? Response.json({ capturedAt: "2026-10-04T11:12:00.000Z", value: [{ actionRecordId: "first" }] })
          : new Response(page, { headers: { "last-modified": modified } });
      },
    });
    expect(requests.map((url) => url.split("/").at(-1))).toEqual(["dashboard.html", "source-assignments.json"]);
  });
});
