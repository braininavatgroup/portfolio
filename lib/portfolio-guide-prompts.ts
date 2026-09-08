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
    { text: "Where should I start?", evidenceId: "thread:making-work-playable" },
    { text: "What does Brain in a Vat do?", evidenceId: "node:music-practice" },
  ],
  [
    { text: "Which projects are in production?", evidenceId: "node:dubs" },
    { text: "How did the agency lead to consulting?", evidenceId: "node:systems-consulting" },
  ],
  [
    { text: "What is Making work playable about?", evidenceId: "thread:making-work-playable" },
    { text: "What did Bradley do at INFAMOUS PR?", evidenceId: "node:infamous" },
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
        { text: `Summarise ${subject.title}`, evidenceId: subject.id },
        { text: "What is related to this?", evidenceId: subject.id },
      ]
    : set.slice(0, 2);

  return [
    ...serious.map((prompt) => ({ ...prompt, tone: "serious" as const })),
    ...actionPrompts,
  ];
}

export function getGuideFollowUpPrompts(
  citedEvidence: readonly PortfolioGroundingEvidence[],
): GuidePrompt[] {
  const subject = citedEvidence[0];
  if (subject) {
    return [
      {
        text: `Summarise ${subject.title}`,
        tone: "serious",
        evidenceId: subject.id,
      },
      {
        text: "What is related to this?",
        tone: "serious",
        evidenceId: subject.id,
      },
      ...actionPrompts,
    ];
  }
  return [
    { text: "Where should Bradley's story start?", tone: "serious" },
    { text: "Which projects are in production?", tone: "serious" },
    ...actionPrompts,
  ];
}
