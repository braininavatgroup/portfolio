import type { PortfolioGroundingEvidence } from "./portfolio-grounding";

export type PortfolioChatTurnMode = "portfolio" | "social" | "general";

export type PortfolioChatVisitState = {
  generalTurns: number;
  portfolioNudgeShown: boolean;
};

export type PortfolioChatEvent =
  | { type: "evidence"; evidence: PortfolioGroundingEvidence[] }
  | { type: "turn_mode"; mode: PortfolioChatTurnMode }
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
