import type { PortfolioGroundingEvidence } from "./portfolio-grounding";

export type GuideEvidenceTarget =
  | { type: "home" }
  | { type: "node"; id: string }
  | { type: "thread"; id: string };

export type GuideAnswerSegment =
  | { type: "text"; text: string }
  | {
      type: "citation";
      text: string;
      label: number;
      evidence: PortfolioGroundingEvidence;
      target: GuideEvidenceTarget;
    };

export function resolveGuideEvidenceTarget(
  evidence: PortfolioGroundingEvidence,
): GuideEvidenceTarget | null {
  if (evidence.id === "entity:portfolio:brain" || evidence.href === "/") {
    return { type: "home" };
  }
  if (evidence.id.startsWith("node:")) {
    return { type: "node", id: evidence.id.slice("node:".length) };
  }
  if (evidence.id.startsWith("thread:")) {
    return { type: "thread", id: evidence.id.slice("thread:".length) };
  }

  const threadMatch = evidence.href.match(/#thread\/([^/]+)/);
  if (threadMatch?.[1]) return { type: "thread", id: threadMatch[1] };
  const nodeMatch = evidence.href.match(/#([^/]+)$/);
  if (nodeMatch?.[1]) return { type: "node", id: nodeMatch[1] };
  return null;
}

export function parseGuideAnswerSegments(
  answer: string,
  evidence: readonly PortfolioGroundingEvidence[],
): GuideAnswerSegment[] {
  const segments: GuideAnswerSegment[] = [];
  const labels = /(?:\[(?!E[1-9]\d*\])([^\]\n]+)\])?\[E([1-9]\d*)\]/g;
  let textStart = 0;

  for (const match of answer.matchAll(labels)) {
    const index = match.index;
    const label = Number(match[2]);
    const item = evidence[label - 1];
    const target = item ? resolveGuideEvidenceTarget(item) : null;
    if (!item || !target) continue;

    if (index > textStart) {
      segments.push({ type: "text", text: answer.slice(textStart, index) });
    }
    segments.push({
      type: "citation",
      text: match[1] ?? match[0],
      label,
      evidence: item,
      target,
    });
    textStart = index + match[0].length;
  }

  if (textStart < answer.length) {
    segments.push({ type: "text", text: answer.slice(textStart) });
  }
  return segments;
}
