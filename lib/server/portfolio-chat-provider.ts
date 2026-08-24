import type { PortfolioGroundingEvidence } from "../portfolio-grounding";

export const INSUFFICIENT_EVIDENCE_MESSAGE =
  "The portfolio does not publish enough evidence to answer that question.";

export type PortfolioChatProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type PortfolioChatProviderInput = {
  question: string;
  evidence: PortfolioGroundingEvidence[];
  signal?: AbortSignal;
  safetyIdentifier?: string;
  onUsage?: (usage: PortfolioChatProviderUsage) => void;
};

export type PortfolioChatProvider = {
  streamAnswer(input: PortfolioChatProviderInput): AsyncIterable<string>;
};
