import { describe, expect, it } from "vitest";
import type {
  PortfolioChatProvider,
  PortfolioChatProviderInput,
  PortfolioChatProviderUsage,
} from "./portfolio-chat-provider";
import {
  comparePortfolioChatEvalRuns,
  runPortfolioChatEval,
  type PortfolioChatEvalCase,
} from "./portfolio-chat-eval";

function deterministicProvider(
  answer: (input: PortfolioChatProviderInput) => {
    chunks: string[];
    usage?: PortfolioChatProviderUsage;
    error?: Error;
  },
): PortfolioChatProvider {
  return {
    async *streamAnswer(providerInput) {
      const result = answer(providerInput);
      for (const chunk of result.chunks) yield chunk;
      if (result.usage) providerInput.onUsage?.(result.usage);
      if (result.error) throw result.error;
    },
  };
}

function citationFor(input: PortfolioChatProviderInput, evidenceId: string) {
  const index = input.evidence.findIndex(({ id }) => id === evidenceId);
  if (index < 0) throw new Error(`Missing eval evidence: ${evidenceId}`);
  return `[E${index + 1}]`;
}

const answerCase: PortfolioChatEvalCase = {
  id: "pitching-approval",
  question: "How does pitching preserve human approval and taste?",
  expected: "answer",
  expectedAnswerIncludes: ["human approval"],
  requiredEvidenceIds: ["node:pitching"],
};

const unknownDetailCase: PortfolioChatEvalCase = {
  id: "pitching-vendor",
  question: "Does the pitching system use a specific software vendor?",
  expected: "answer",
  expectedAnswerIncludes: ["don't know"],
};

describe("portfolio chat offline evaluation", () => {
  // Protects against scoring conversational uncertainty as a failed refusal.
  // Owner: portfolio chat evaluator. Retire if evaluation moves out of process.
  it("passes a grounded answer and a conversational unknown-detail answer", async () => {
    const provider = deterministicProvider((input) => ({
      chunks: input.question.includes("vendor")
        ? ["I don't know which software vendor it uses."]
        : ["Human approval remains explicit. ", citationFor(input, "node:pitching")],
    }));
    const clock = [0, 12, 20, 40];

    const run = await runPortfolioChatEval(
      { name: "balanced", provider, now: () => clock.shift() ?? 0 },
      [answerCase, unknownDetailCase],
    );

    expect(run.results).toEqual([
      expect.objectContaining({
        caseId: "pitching-approval",
        passed: true,
        outcome: "answer",
        citedEvidenceIds: ["node:pitching"],
        latencyMs: 12,
      }),
      expect.objectContaining({
        caseId: "pitching-vendor",
        passed: true,
        outcome: "answer",
        citedEvidenceIds: [],
        latencyMs: 20,
      }),
    ]);
    expect(run.summary).toMatchObject({
      totalCases: 2,
      passCount: 2,
      failureCount: 0,
      averageLatencyMs: 16,
      p95LatencyMs: 20,
    });
    expect(run.summary).not.toHaveProperty("expectedRefusalCount");
    expect(run.summary).not.toHaveProperty("correctRefusalCount");
    expect(run.summary).not.toHaveProperty("refusalAccuracy");
  });

  it.each([
    ["An unsupported answer.", "missing_required_evidence"],
    ["An answer with the wrong source. [E99]", "unknown_citation"],
    ["First claim. Second claim. [E1]", "unattributed_claim"],
  ])("rejects citation failure for %s", async (output, failureCode) => {
    const provider = deterministicProvider(() => ({ chunks: [output] }));

    const run = await runPortfolioChatEval(
      { name: "citation-check", provider },
      [answerCase],
    );

    expect(run.results[0]).toMatchObject({
      passed: false,
      outcome: "citation_failure",
      failureCode,
    });
    expect(run.summary).toMatchObject({ passCount: 0, failureCount: 1 });
  });

  it("rejects answers that omit evidence required by the reference case", async () => {
    const provider = deterministicProvider(() => ({
      chunks: ["The workflow has an output. [E2]"],
    }));

    const run = await runPortfolioChatEval(
      { name: "wrong-grounding", provider },
      [answerCase],
    );

    expect(run.results[0]).toMatchObject({
      passed: false,
      outcome: "citation_failure",
      failureCode: "missing_required_evidence",
    });
  });

  it("rejects an attributed answer that misses the reference answer anchors", async () => {
    const provider = deterministicProvider((input) => ({
      chunks: [`Bradley won a Grammy. ${citationFor(input, "node:pitching")}`],
    }));

    const run = await runPortfolioChatEval(
      { name: "fabricated-answer", provider },
      [answerCase],
    );

    expect(run.results[0]).toMatchObject({
      passed: false,
      outcome: "citation_failure",
      failureCode: "incorrect_answer",
    });
  });

  it("records provider failure without leaking the exception", async () => {
    const provider = deterministicProvider(() => ({
      chunks: [],
      error: new Error("secret upstream detail"),
    }));

    const run = await runPortfolioChatEval(
      { name: "failed-provider", provider },
      [answerCase],
    );

    expect(run.results[0]).toMatchObject({
      passed: false,
      outcome: "provider_failure",
      failureCode: "provider_failure",
    });
    expect(JSON.stringify(run)).not.toContain("secret upstream detail");
  });

  it("computes nearest-rank p95 latency and provider-reported usage totals", async () => {
    let call = 0;
    const provider = deterministicProvider((input) => {
      call += 1;
      return {
        chunks: [`Grounded answer. ${citationFor(input, "node:pitching")}`],
        usage: {
          inputTokens: call * 100,
          outputTokens: call * 10,
          totalTokens: call * 110,
        },
      };
    });
    const clock = [0, 10, 20, 40, 50, 80, 90, 130, 140, 240];

    const run = await runPortfolioChatEval(
      { name: "measured", provider, now: () => clock.shift() ?? 0 },
      Array.from({ length: 5 }, (_, index) => ({
        ...answerCase,
        id: `answer-${index + 1}`,
        expectedAnswerIncludes: ["grounded answer"],
      })),
    );

    expect(run.summary).toMatchObject({
      averageLatencyMs: 40,
      p95LatencyMs: 100,
      inputTokens: 1_500,
      outputTokens: 150,
      totalTokens: 1_650,
      usageReportedCaseCount: 5,
    });
  });

  it("compares named runs and prices only configurations with explicit snapshots", async () => {
    const fastProvider = deterministicProvider((input) => {
      input.onUsage?.({ inputTokens: 1_000_000, outputTokens: 500_000, totalTokens: 1_500_000 });
      return { chunks: [`Grounded answer. ${citationFor(input, "node:pitching")}`] };
    });
    const slowProvider = deterministicProvider((input) => ({
      chunks: [`Grounded answer. ${citationFor(input, "node:pitching")}`],
    }));
    const fastClock = [0, 10];
    const slowClock = [0, 30];
    const fast = await runPortfolioChatEval(
      { name: "fast", provider: fastProvider, now: () => fastClock.shift() ?? 0 },
      [{ ...answerCase, expectedAnswerIncludes: ["grounded answer"] }],
    );
    const slow = await runPortfolioChatEval(
      { name: "slow", provider: slowProvider, now: () => slowClock.shift() ?? 0 },
      [{ ...answerCase, expectedAnswerIncludes: ["grounded answer"] }],
    );

    const comparison = comparePortfolioChatEvalRuns([slow, fast], {
      fast: { inputUsdPerMillion: 2, outputUsdPerMillion: 8 },
    });

    expect(comparison.runs).toEqual([
      expect.objectContaining({
        name: "slow",
        passCount: 1,
        averageLatencyMs: 30,
      }),
      expect.objectContaining({
        name: "fast",
        passCount: 1,
        averageLatencyMs: 10,
        estimatedCostUsd: 6,
      }),
    ]);
    expect(comparison.runs[0]).not.toHaveProperty("estimatedCostUsd");
    expect(comparison.bestPassCount).toEqual(["slow", "fast"]);
    expect(comparison.fastestAverageLatency).toEqual(["fast"]);
  });
});
