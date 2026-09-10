// Matches the approved frame-ancestors policy for the MAMA SAY report.
// Other preview origins retain the authentic capture and the full-report link.
export function isCampaignReportEmbedOrigin(origin: string): boolean {
  return origin === "https://bradleyberkman.com"
    || origin === "https://www.bradleyberkman.com"
    || origin === "http://localhost:55050";
}
