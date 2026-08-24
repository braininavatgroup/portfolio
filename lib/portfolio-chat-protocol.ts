import type { PortfolioGroundingEvidence } from "./portfolio-grounding";

export type PortfolioChatEvent =
  | { type: "evidence"; evidence: PortfolioGroundingEvidence[] }
  | { type: "answer_delta"; delta: string }
  | {
      type: "notice";
      code: "insufficient_evidence";
      message: string;
    }
  | {
      type: "error";
      code: "provider_unavailable";
      message: string;
    }
  | { type: "done" };

export function encodePortfolioChatEvent(event: PortfolioChatEvent) {
  return `${JSON.stringify(event)}\n`;
}
