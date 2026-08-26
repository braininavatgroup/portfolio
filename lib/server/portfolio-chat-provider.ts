import type { PortfolioGroundingEvidence } from "../portfolio-grounding";
import type { PortfolioChatMessage } from "../portfolio-chat-conversation";
import type { PortfolioResponseEffects } from "../avatar/contracts";
import type {
  PortfolioChatTurnMode,
  PortfolioChatVisitState,
} from "../portfolio-chat-protocol";

export const INSUFFICIENT_EVIDENCE_MESSAGE =
  "The portfolio does not publish enough evidence to answer that question.";

export type PortfolioChatProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type PortfolioChatProviderFailureKind =
  | "aborted"
  | "citation_label"
  | "invalid_evidence_output"
  | "invalid_final_output"
  | "max_turns"
  | "model_refusal"
  | "provider_error"
  | "provider_timeout"
  | "unknown_evidence";

export type PortfolioChatProviderInput = {
  question: string;
  evidence: PortfolioGroundingEvidence[];
  conversation?: PortfolioChatMessage[];
  visitState?: PortfolioChatVisitState;
  signal?: AbortSignal;
  safetyIdentifier?: string;
  onMode?: (mode: PortfolioChatTurnMode) => void;
  onEffects?: (effects: PortfolioResponseEffects) => void;
  onUsage?: (usage: PortfolioChatProviderUsage) => void;
  onFailure?: (kind: PortfolioChatProviderFailureKind) => void;
};

export type PortfolioChatProvider = {
  streamAnswer(input: PortfolioChatProviderInput): AsyncIterable<string>;
};
