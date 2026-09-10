import type { PortfolioGroundingEvidence } from "./portfolio-grounding";

export type GuidePrompt = {
  text: string;
  tone: "serious" | "playful";
  evidenceId?: string;
};

export type GuidePromptSubject = Pick<
  PortfolioGroundingEvidence,
  "id" | "title"
>;

const actionPrompts: readonly GuidePrompt[] = [
  { text: "Play Brain Food", tone: "playful" },
];

const starterSets = [
  [
    { text: "What kind of work does Bradley do?", evidenceId: "thread:making-work-playable" },
    { text: "What could Bradley help my team with?", evidenceId: "node:systems-consulting" },
  ],
  [
    { text: "Which projects can I try today?", evidenceId: "node:dubs" },
    { text: "How does Bradley decide what to automate?", evidenceId: "thread:philosophy" },
  ],
] as const;

function starterSetIndex(visitSeed: number) {
  const integerSeed = Number.isFinite(visitSeed) ? Math.trunc(visitSeed) : 0;
  return ((integerSeed % starterSets.length) + starterSets.length) % starterSets.length;
}

function subjectPrompts(subject: GuidePromptSubject): GuidePrompt[] {
  if (subject.id === "node:bradley" || subject.id === "entity:portfolio:brain") {
    return starterSets[0].map(prompt => ({ ...prompt, tone: "serious" }));
  }
  return [
    { text: `Tell me about ${subject.title}.`, tone: "serious", evidenceId: subject.id },
    { text: "How does this connect to Bradley's other work?", tone: "serious", evidenceId: subject.id },
  ];
}

export function getGuideInitialPrompts(
  visitSeed: number,
  subject?: GuidePromptSubject,
): GuidePrompt[] {
  const serious: GuidePrompt[] = subject
    ? subjectPrompts(subject)
    : starterSets[starterSetIndex(visitSeed)]!.map(prompt => ({ ...prompt, tone: "serious" }));
  return [...serious, ...actionPrompts];
}

export function getGuideFollowUpPrompts(
  citedEvidence: readonly PortfolioGroundingEvidence[],
  askedQuestions: readonly string[] = [],
): GuidePrompt[] {
  const subject = citedEvidence[0];
  const candidates: GuidePrompt[] = [
    ...(subject ? subjectPrompts(subject) : []),
    { text: "What kind of work does Bradley do?", tone: "serious" },
    { text: "Which projects can I try today?", tone: "serious" },
    { text: "What could Bradley help my team with?", tone: "serious" },
    { text: "How does Bradley decide what to automate?", tone: "serious" },
  ];
  const asked = new Set(askedQuestions.map(question => question.trim().toLowerCase()));
  const unasked = candidates.filter(prompt => {
    const key = prompt.text.toLowerCase();
    if (asked.has(key)) return false;
    asked.add(key);
    return true;
  });
  return [...unasked.slice(0, 2), ...actionPrompts];
}
