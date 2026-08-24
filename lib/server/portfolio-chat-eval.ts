import { groundPortfolioQuestion } from "../portfolio-grounding";
import {
  INSUFFICIENT_EVIDENCE_MESSAGE,
  type PortfolioChatProvider,
  type PortfolioChatProviderInput,
  type PortfolioChatProviderUsage,
} from "./portfolio-chat-provider";

type PortfolioChatEvalCaseBase = {
  id: string;
  question: string;
  requiredEvidenceIds?: string[];
};

export type PortfolioChatEvalCase =
  | (PortfolioChatEvalCaseBase & {
      expected: "answer";
      expectedAnswerIncludes: [string, ...string[]];
    })
  | (PortfolioChatEvalCaseBase & {
      expected: "refusal";
    });

export type PortfolioChatEvalUsage = PortfolioChatProviderUsage;

export type PortfolioChatEvalFailureCode =
  | "missing_citation"
  | "unknown_citation"
  | "unattributed_claim"
  | "missing_required_evidence"
  | "incorrect_answer"
  | "unexpected_answer"
  | "unexpected_refusal"
  | "provider_failure";

export type PortfolioChatEvalResult = {
  caseId: string;
  passed: boolean;
  expected: PortfolioChatEvalCase["expected"];
  outcome: "answer" | "refusal" | "citation_failure" | "provider_failure";
  evidenceIds: string[];
  citedEvidenceIds: string[];
  latencyMs: number;
  failureCode?: PortfolioChatEvalFailureCode;
  usage?: PortfolioChatEvalUsage;
};

export type PortfolioChatEvalSummary = {
  totalCases: number;
  passCount: number;
  failureCount: number;
  expectedRefusalCount: number;
  correctRefusalCount: number;
  refusalAccuracy: number | null;
  averageLatencyMs: number;
  p95LatencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  usageReportedCaseCount: number;
};

export type PortfolioChatEvalRun = {
  name: string;
  results: PortfolioChatEvalResult[];
  summary: PortfolioChatEvalSummary;
};

export type PortfolioChatEvalConfiguration = {
  name: string;
  provider: PortfolioChatProvider;
  now?: () => number;
};

export type PortfolioChatEvalPricingSnapshot = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

export type PortfolioChatEvalComparisonRun = PortfolioChatEvalSummary & {
  name: string;
  estimatedCostUsd?: number;
};

export type PortfolioChatEvalComparison = {
  runs: PortfolioChatEvalComparisonRun[];
  bestPassCount: string[];
  fastestAverageLatency: string[];
};

type CitationCheck =
  | { ok: true; citedEvidenceIds: string[] }
  | { ok: false; failureCode: PortfolioChatEvalFailureCode };

function validateCitedSegment(
  segment: string,
  evidenceIds: string[],
): CitationCheck {
  const labels = [...segment.matchAll(/\[E(\d+)\]/g)];
  if (labels.length === 0) {
    return { ok: false, failureCode: "missing_citation" };
  }

  const citedEvidenceIds: string[] = [];
  for (const label of labels) {
    const evidenceId = evidenceIds[Number(label[1]) - 1];
    if (!evidenceId) {
      return { ok: false, failureCode: "unknown_citation" };
    }
    citedEvidenceIds.push(evidenceId);
  }

  const claim = segment.replace(/(?:\s*\[E\d+\])+\s*$/, "").trim();
  if (!claim || /[.!?]["')\]]?\s+\S/.test(claim)) {
    return { ok: false, failureCode: "unattributed_claim" };
  }

  return { ok: true, citedEvidenceIds };
}

function validateCitations(answer: string, evidenceIds: string[]): CitationCheck {
  let buffer = answer.trim();
  const citedEvidenceIds: string[] = [];
  const followedCitation = /\[E\d+\](?:\s*\[E\d+\])*(?=\s+[^\s[])/;
  let boundary = followedCitation.exec(buffer);

  while (boundary) {
    const end = boundary.index + boundary[0].length;
    const segment = buffer.slice(0, end).trim();
    const check = validateCitedSegment(segment, evidenceIds);
    if (!check.ok) return check;
    citedEvidenceIds.push(...check.citedEvidenceIds);
    buffer = buffer.slice(end).trimStart();
    boundary = followedCitation.exec(buffer);
  }

  const finalCheck = validateCitedSegment(buffer, evidenceIds);
  if (!finalCheck.ok) return finalCheck;
  citedEvidenceIds.push(...finalCheck.citedEvidenceIds);

  return {
    ok: true,
    citedEvidenceIds: [...new Set(citedEvidenceIds)],
  };
}

function validUsage(usage: PortfolioChatEvalUsage) {
  return (
    Number.isFinite(usage.inputTokens) &&
    usage.inputTokens >= 0 &&
    Number.isFinite(usage.outputTokens) &&
    usage.outputTokens >= 0 &&
    Number.isFinite(usage.totalTokens) &&
    usage.totalTokens >= 0
  );
}

function percentile95(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0;
}

function summarize(results: PortfolioChatEvalResult[]): PortfolioChatEvalSummary {
  const passCount = results.filter(({ passed }) => passed).length;
  const refusalResults = results.filter(({ expected }) => expected === "refusal");
  const correctRefusalCount = refusalResults.filter(
    ({ passed, outcome }) => passed && outcome === "refusal",
  ).length;
  const latencies = results.map(({ latencyMs }) => latencyMs);
  const usage = results.flatMap((result) => (result.usage ? [result.usage] : []));

  return {
    totalCases: results.length,
    passCount,
    failureCount: results.length - passCount,
    expectedRefusalCount: refusalResults.length,
    correctRefusalCount,
    refusalAccuracy:
      refusalResults.length === 0
        ? null
        : correctRefusalCount / refusalResults.length,
    averageLatencyMs:
      latencies.length === 0
        ? 0
        : latencies.reduce((total, latency) => total + latency, 0) /
          latencies.length,
    p95LatencyMs: percentile95(latencies),
    inputTokens: usage.reduce((total, item) => total + item.inputTokens, 0),
    outputTokens: usage.reduce((total, item) => total + item.outputTokens, 0),
    totalTokens: usage.reduce((total, item) => total + item.totalTokens, 0),
    usageReportedCaseCount: usage.length,
  };
}

export async function runPortfolioChatEval(
  configuration: PortfolioChatEvalConfiguration,
  cases: readonly PortfolioChatEvalCase[],
): Promise<PortfolioChatEvalRun> {
  const now = configuration.now ?? performance.now.bind(performance);
  const results: PortfolioChatEvalResult[] = [];

  for (const evalCase of cases) {
    const grounding = groundPortfolioQuestion(evalCase.question);
    const evidenceIds = grounding.evidence.map(({ id }) => id);
    const startedAt = now();
    let usage: PortfolioChatEvalUsage | undefined;
    let output = "";

    try {
      if (grounding.evidence.length === 0) {
        output = INSUFFICIENT_EVIDENCE_MESSAGE;
      } else {
        const providerInput: PortfolioChatProviderInput = {
          ...grounding,
          onUsage(reportedUsage) {
            if (validUsage(reportedUsage)) usage = { ...reportedUsage };
          },
        };
        for await (const delta of configuration.provider.streamAnswer(providerInput)) {
          output += delta;
        }
      }
    } catch {
      results.push({
        caseId: evalCase.id,
        passed: false,
        expected: evalCase.expected,
        outcome: "provider_failure",
        evidenceIds,
        citedEvidenceIds: [],
        latencyMs: Math.max(0, now() - startedAt),
        failureCode: "provider_failure",
        ...(usage ? { usage } : {}),
      });
      continue;
    }

    const latencyMs = Math.max(0, now() - startedAt);
    if (output.trim() === INSUFFICIENT_EVIDENCE_MESSAGE) {
      const passed = evalCase.expected === "refusal";
      results.push({
        caseId: evalCase.id,
        passed,
        expected: evalCase.expected,
        outcome: "refusal",
        evidenceIds,
        citedEvidenceIds: [],
        latencyMs,
        ...(!passed ? { failureCode: "unexpected_refusal" as const } : {}),
        ...(usage ? { usage } : {}),
      });
      continue;
    }

    const citationCheck = validateCitations(output, evidenceIds);
    if (!citationCheck.ok) {
      results.push({
        caseId: evalCase.id,
        passed: false,
        expected: evalCase.expected,
        outcome: "citation_failure",
        evidenceIds,
        citedEvidenceIds: [],
        latencyMs,
        failureCode: citationCheck.failureCode,
        ...(usage ? { usage } : {}),
      });
      continue;
    }

    const missingRequiredEvidence = evalCase.requiredEvidenceIds?.some(
      (id) => !citationCheck.citedEvidenceIds.includes(id),
    );
    const normalizedOutput = output.toLocaleLowerCase();
    const incorrectAnswer =
      evalCase.expected === "answer" &&
      evalCase.expectedAnswerIncludes.some(
        (expectedText) =>
          !expectedText.trim() ||
          !normalizedOutput.includes(expectedText.trim().toLocaleLowerCase()),
      );
    const passed =
      evalCase.expected === "answer" &&
      !missingRequiredEvidence &&
      !incorrectAnswer;
    results.push({
      caseId: evalCase.id,
      passed,
      expected: evalCase.expected,
      outcome:
        missingRequiredEvidence || incorrectAnswer
          ? "citation_failure"
          : "answer",
      evidenceIds,
      citedEvidenceIds: citationCheck.citedEvidenceIds,
      latencyMs,
      ...(!passed
        ? {
            failureCode: missingRequiredEvidence
              ? ("missing_required_evidence" as const)
              : incorrectAnswer
                ? ("incorrect_answer" as const)
              : ("unexpected_answer" as const),
          }
        : {}),
      ...(usage ? { usage } : {}),
    });
  }

  return {
    name: configuration.name,
    results,
    summary: summarize(results),
  };
}

function validatePricing(snapshot: PortfolioChatEvalPricingSnapshot) {
  if (
    !Number.isFinite(snapshot.inputUsdPerMillion) ||
    snapshot.inputUsdPerMillion < 0 ||
    !Number.isFinite(snapshot.outputUsdPerMillion) ||
    snapshot.outputUsdPerMillion < 0
  ) {
    throw new Error("Pricing snapshots must contain non-negative rates.");
  }
}

export function comparePortfolioChatEvalRuns(
  runs: readonly PortfolioChatEvalRun[],
  pricingSnapshots: Readonly<
    Record<string, PortfolioChatEvalPricingSnapshot>
  > = {},
): PortfolioChatEvalComparison {
  const names = new Set<string>();
  const comparisonRuns = runs.map(({ name, summary }) => {
    if (names.has(name)) throw new Error(`Duplicate evaluation name: ${name}`);
    names.add(name);
    const pricing = pricingSnapshots[name];
    if (!pricing) return { name, ...summary };
    validatePricing(pricing);
    return {
      name,
      ...summary,
      estimatedCostUsd:
        (summary.inputTokens * pricing.inputUsdPerMillion +
          summary.outputTokens * pricing.outputUsdPerMillion) /
        1_000_000,
    };
  });

  const bestPassCount = Math.max(...comparisonRuns.map(({ passCount }) => passCount));
  const fastestLatency = Math.min(
    ...comparisonRuns.map(({ averageLatencyMs }) => averageLatencyMs),
  );

  return {
    runs: comparisonRuns,
    bestPassCount: comparisonRuns
      .filter(({ passCount }) => passCount === bestPassCount)
      .map(({ name }) => name),
    fastestAverageLatency: comparisonRuns
      .filter(({ averageLatencyMs }) => averageLatencyMs === fastestLatency)
      .map(({ name }) => name),
  };
}
