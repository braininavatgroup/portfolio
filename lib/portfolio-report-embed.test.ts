import { describe, expect, it } from "vitest";
import { isCampaignReportEmbedOrigin } from "./portfolio-report-embed";

describe("campaign report embedding", () => {
  it.each([
    ["https://bradleyberkman.com", true],
    ["https://www.bradleyberkman.com", true],
    ["http://bradleyberkman.com", false],
    ["https://bradleyberkman.com:55050", false],
    ["http://localhost:55050", true],
    ["http://localhost:55051", false],
    ["http://127.0.0.1:55050", false],
    ["https://bradleyberkman.com.example.org", false],
    ["", false],
  ])("allows %s only when included in the report host policy", (origin, allowed) => {
    expect(isCampaignReportEmbedOrigin(origin)).toBe(allowed);
  });
});
