import { describe, expect, it } from "vitest";
import { verifyScheduledDashboard, verifyStoredDashboard } from "./verify-scheduled-insights.mjs";

const now = new Date("2026-10-04T11:40:00.000Z");
const modified = "Sun, 04 Oct 2026 11:12:00 GMT";
const page = `
  <section id="assigned-links">
    <p>Link activity covers the last 90 days (since 2026-07-07).</p>
    <details class="assignment" data-state="active"><summary>
      <span class="row-title">Activity from Peter Travers's assigned link</span>
      <span class="badge">6 link sessions</span>
      <span class="cell"><span class="cell-label">Link sessions</span><span class="cell-value">6</span></span>
    </summary></details>
  </section>`;

describe("scheduled insights proof", () => {
  it("accepts the fresh saved page with the 90-day label and six sessions", () => {
    expect(() => verifyScheduledDashboard(page, modified, now)).not.toThrow();
  });

  it("rejects an old page, a window fallback, and a missing link session", () => {
    expect(() => verifyScheduledDashboard(page, "Fri, 02 Oct 2026 11:12:00 GMT", now)).toThrow(/recent/u);
    expect(() => verifyScheduledDashboard(page.replace("last 90 days", "report window"), modified, now)).toThrow(/90-day/u);
    expect(() => verifyScheduledDashboard(page.replaceAll("6", "0"), modified, now)).toThrow(/six sessions/u);
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
