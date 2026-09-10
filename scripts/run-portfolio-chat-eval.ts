#!/usr/bin/env tsx

/**
 * The runner `lib/server/portfolio-chat-eval.ts` never had.
 *
 * The engine was built correctly and deliberately cannot discover credentials
 * or construct a live provider — which is exactly why nothing called it. This
 * supplies both, from the environment and from a case file, so the harness is
 * reachable without weakening that property.
 *
 *   OPENAI_API_KEY=… npx tsx scripts/run-portfolio-chat-eval.ts \
 *     --model gpt-5.6-terra [--cases path/to/cases.json] [--json]
 *
 * It makes real, billable model calls, so it is deliberately not wired into CI.
 */

import { readFile } from "node:fs/promises";
import { createOpenAIPortfolioProvider } from "../lib/server/openai-portfolio-provider";
import {
  runPortfolioChatEval,
  type PortfolioChatEvalCase,
} from "../lib/server/portfolio-chat-eval";

const defaultCases: PortfolioChatEvalCase[] = [
  {
    id: "reporting",
    question: "How does campaign reporting work?",
    expected: "answer",
    expectedAnswerIncludes: ["reporting"],
  },
  {
    id: "dubs",
    question: "What is Dubs?",
    expected: "answer",
    expectedAnswerIncludes: ["Dubs"],
  },
];

function flag(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is required. This runner makes real model calls.");
    process.exitCode = 1;
    return;
  }

  const model = flag("model") ?? process.env.OPENAI_PORTFOLIO_MODEL;
  if (!model) {
    console.error("Pass --model, or set OPENAI_PORTFOLIO_MODEL.");
    process.exitCode = 1;
    return;
  }

  const casesPath = flag("cases");
  const cases: PortfolioChatEvalCase[] = casesPath
    ? (JSON.parse(await readFile(casesPath, "utf8")) as PortfolioChatEvalCase[])
    : defaultCases;

  const run = await runPortfolioChatEval(
    { name: model, provider: createOpenAIPortfolioProvider({ apiKey, model }) },
    cases,
  );

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(run, null, 2));
    return;
  }

  const { summary } = run;
  console.log(`${run.name} — ${summary.totalCases} case(s)`);
  console.log(`  passed     ${summary.passCount}/${summary.totalCases}`);
  console.log(`  latency    avg ${summary.averageLatencyMs.toFixed(0)}ms · p95 ${summary.p95LatencyMs.toFixed(0)}ms`);
  console.log(`  tokens     ${summary.totalTokens} (${summary.usageReportedCaseCount} case(s) reported usage)`);
  for (const result of run.results.filter(({ passed }) => !passed)) {
    console.log(`  FAILED ${result.caseId}: ${result.failureCode ?? result.outcome}`);
  }
}

await main();
