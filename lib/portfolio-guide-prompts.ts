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
  { text: "Wave hello", tone: "playful" },
  { text: "Can you dance?", tone: "playful" },
  { text: "Go for a swim", tone: "playful" },
  { text: "Play Brain Food", tone: "playful" },
];

const starterSets = [
  [
    { text: "What kind of work does Bradley do?", evidenceId: "thread:making-work-playable" },
    { text: "Which project best shows how Bradley thinks?", evidenceId: "node:music-practice" },
  ],
  [
    { text: "Which projects can I try today?", evidenceId: "node:dubs" },
    { text: "What could Bradley help my team with?", evidenceId: "node:systems-consulting" },
  ],
  [
    { text: "How did music lead Bradley into building software?", evidenceId: "thread:making-work-playable" },
    { text: "Which project has a measurable result?", evidenceId: "node:infamous" },
  ],
] as const;

function starterSetIndex(visitSeed: number) {
  const integerSeed = Number.isFinite(visitSeed) ? Math.trunc(visitSeed) : 0;
  return ((integerSeed % starterSets.length) + starterSets.length) % starterSets.length;
}

export function getGuideInitialPrompts(
  visitSeed: number,
  subject?: GuidePromptSubject,
): GuidePrompt[] {
  const set = starterSets[starterSetIndex(visitSeed)]!;
  const serious = subject
    ? [
        { text: `What problem does ${subject.title} solve?`, evidenceId: subject.id },
        { text: "How does this connect to Bradley's other work?", evidenceId: subject.id },
      ]
    : set.slice(0, 2);

  return [
    ...serious.map((prompt) => ({ ...prompt, tone: "serious" as const })),
    ...actionPrompts,
  ];
}

export function getGuideFollowUpPrompts(
  citedEvidence: readonly PortfolioGroundingEvidence[],
  askedQuestions: readonly string[] = [],
): GuidePrompt[] {
  const subject = citedEvidence[0];
  const candidates: GuidePrompt[] = [
    ...(subject ? [
      { text: `What problem does ${subject.title} solve?`, tone: "serious" as const, evidenceId: subject.id },
      { text: `What changed because of ${subject.title}?`, tone: "serious" as const, evidenceId: subject.id },
    ] : []),
    { text: "What kind of work does Bradley do?", tone: "serious" },
    { text: "Which projects can I try today?", tone: "serious" },
    { text: "What could Bradley help my team with?", tone: "serious" },
    { text: "How does Bradley decide what to automate?", tone: "serious" },
  ];
  const asked = new Set(askedQuestions.map(question => question.trim().toLowerCase()));
  return [...candidates.filter(prompt => !asked.has(prompt.text.toLowerCase())).slice(0, 2), ...actionPrompts];
}
