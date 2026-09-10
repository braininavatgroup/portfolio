import { groundPortfolioQuestion } from "../portfolio-grounding";
import {
  type PortfolioChatProvider,
  type PortfolioChatProviderInput,
  type PortfolioChatProviderUsage,
} from "./portfolio-chat-provider";

type PortfolioChatEvalCaseBase = {
  id: string;
  question: string;
  requiredEvidenceIds?: string[];
};

export type PortfolioChatEvalCase = PortfolioChatEvalCaseBase & {
  expected: "answer";
  expectedAnswerIncludes: [string, ...string[]];
};

export type PortfolioChatEvalUsage = PortfolioChatProviderUsage;

export type PortfolioChatEvalFailureCode =
  | "unknown_citation"
  | "unattributed_claim"
  | "missing_required_evidence"
  | "incorrect_answer"
  | "provider_failure";

export type PortfolioChatEvalResult = {
  caseId: string;
  passed: boolean;
  expected: PortfolioChatEvalCase["expected"];
  outcome: "answer" | "citation_failure" | "provider_failure";
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

function validatePortfolioSegment(
  segment: string,
  evidenceIds: string[],
): CitationCheck {
  const labels = [...segment.matchAll(/\[E(\d+)\]/g)];
  if (labels.length === 0) {
    return { ok: true, citedEvidenceIds: [] };
  }

  const citedEvidenceIds: string[] = [];
  for (const label of labels) {
    const evidenceId = evidenceIds[Number(label[1]) - 1];
    if (!evidenceId) {
      return { ok: false, failureCode: "unknown_citation" };
    }
    citedEvidenceIds.push(evidenceId);
  }

  const claim = segment.replace(/\[([^\]\n]+)\]\[E[1-9]\d*\]/g, "$1").replace(/(?:\s*\[E\d+\])+\s*$/, "").trim();
  if (!claim || /[.!?]["')\]]?\s+\S/.test(claim)) {
    return { ok: false, failureCode: "unattributed_claim" };
  }

  return { ok: true, citedEvidenceIds };
}

function validateCitations(answer: string, evidenceIds: string[]): CitationCheck {
  if (answer.includes("\n\n")) {
    const checks = answer.split(/\n\n+/).map(paragraph => validateCitations(paragraph, evidenceIds));
    const failure = checks.find(check => !check.ok);
    if (failure) return failure;
    return { ok: true, citedEvidenceIds: [...new Set(checks.flatMap(check => check.ok ? check.citedEvidenceIds : []))] };
  }
  let buffer = answer.trim();
  const citedEvidenceIds: string[] = [];
  const followedCitation = /(?<!\])\[E\d+\](?:\s*\[E\d+\])*(?=\s+[^\s[])/;
  let boundary = followedCitation.exec(buffer);

  while (boundary) {
    const end = boundary.index + boundary[0].length;
    const segment = buffer.slice(0, end).trim();
    const check = validatePortfolioSegment(segment, evidenceIds);
    if (!check.ok) return check;
    citedEvidenceIds.push(...check.citedEvidenceIds);
    buffer = buffer.slice(end).trimStart();
    boundary = followedCitation.exec(buffer);
  }

  const finalCheck = validatePortfolioSegment(buffer, evidenceIds);
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
  const latencies = results.map(({ latencyMs }) => latencyMs);
  const usage = results.flatMap((result) => (result.usage ? [result.usage] : []));

  return {
    totalCases: results.length,
    passCount,
    failureCount: results.length - passCount,
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
      const providerInput: PortfolioChatProviderInput = {
        ...grounding,
        onUsage(reportedUsage) {
          if (validUsage(reportedUsage)) usage = { ...reportedUsage };
        },
      };
      for await (const delta of configuration.provider.streamAnswer(providerInput)) {
        output += delta;
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
    const incorrectAnswer = evalCase.expectedAnswerIncludes.some(
      (expectedText) =>
        !expectedText.trim() ||
        !normalizedOutput.includes(expectedText.trim().toLocaleLowerCase()),
    );
    const passed = !missingRequiredEvidence && !incorrectAnswer;
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
              : ("incorrect_answer" as const),
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
