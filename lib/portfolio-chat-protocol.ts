import type { PortfolioGroundingEvidence } from "./portfolio-grounding";
import type { PortfolioResponseEffects } from "./avatar/contracts";

export type PortfolioChatTurnMode = "portfolio" | "social" | "general";

/**
 * Reports how long the visitor's chat session stays good for, as epoch seconds.
 * The credential itself is an HttpOnly cookie; this header reports expiry
 * without exposing the credential.
 */
export const portfolioChatSessionHeader = "x-portfolio-chat-session";

export type PortfolioChatVisitState = {
  generalTurns: number;
  portfolioNudgeShown: boolean;
};

export type PortfolioChatEvent =
  | { type: "evidence"; evidence: PortfolioGroundingEvidence[] }
  | { type: "turn_mode"; mode: PortfolioChatTurnMode }
  | { type: "answer_delta"; delta: string }
  | { type: "effects"; effects: PortfolioResponseEffects }
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
