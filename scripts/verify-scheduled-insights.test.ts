import { describe, expect, it } from "vitest";
import { verifyScheduledDashboard, verifyStoredDashboard } from "./verify-scheduled-insights.mjs";

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
      <span class="row-title">Activity from Peter Travers's assigned link</span>
      <span class="badge">6 link sessions</span>
      <span class="cell"><span class="cell-label">Link sessions</span><span class="cell-value">6</span></span>
    </summary></details>
  </section>`;
const zeroSessions = page.replace("6 link sessions", "No activity yet").replace('class="cell-value">6', 'class="cell-value">0');

describe("scheduled insights proof", () => {
  it("accepts a fresh saved page with consistent assigned-link activity", () => {
    expect(() => verifyScheduledDashboard(page, modified, now)).not.toThrow();
    expect(() => verifyScheduledDashboard(zeroSessions.replace('data-state="active"', 'data-state="idle"'), modified, now)).not.toThrow();
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
});
