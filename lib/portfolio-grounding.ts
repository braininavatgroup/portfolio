import {
  portfolioBodyText,
  portfolioContact,
  portfolioThreads,
  portfolioThroughline,
  portfolioWorldNodes,
  type PortfolioWorldNode,
} from "./portfolio-world";
import {
  audienceStatement,
  careerTimeline,
  privateFacts,
} from "./portfolio-private-grounding";

export type PortfolioGroundingEvidence = {
  id: string;
  title: string;
  excerpt: string;
  href: string;
  projectTitle: string;
};

export type PortfolioGrounding = {
  question: string;
  evidence: PortfolioGroundingEvidence[];
};

const contentNodes = portfolioWorldNodes.filter(
  (node) => node.family !== "story",
);

function threadsContaining(nodeId: string) {
  return portfolioThreads.filter(({ members }) => members.includes(nodeId));
}

function nodeEvidence(node: PortfolioWorldNode): PortfolioGroundingEvidence {
  const threads = threadsContaining(node.id);
  const lines = [
    `Kind: ${node.kind}`,
    `Summary: ${node.summary}`,
    ...(node.principle ? [`Principle: ${node.principle}`] : []),
    ...portfolioBodyText(node.body),
    ...(threads.length
      ? [`Threads: ${threads.map(({ title }) => title).join("; ")}`]
      : []),
  ];
  return {
    id: `node:${node.id}`,
    title: node.label,
    excerpt: lines.join("\n"),
    href: `/?view=graph#${node.id}`,
    projectTitle: node.label,
  };
}

function completePortfolioEvidence(): PortfolioGroundingEvidence[] {
  const portfolioExcerpt = [
    `Throughline: ${portfolioThroughline}`,
    `Audience: ${audienceStatement}`,
    `Contact: ${portfolioContact.email}`,
    "Career:",
    ...careerTimeline.map(
      ({ period, title, detail }) => `${period}; ${title}: ${detail}`,
    ),
    ...privateFacts,
  ].join("\n");

  return [
    {
      id: "entity:portfolio:brain",
      title: "Bradley Berkman",
      excerpt: portfolioExcerpt,
      href: "/",
      projectTitle: "Portfolio",
    },
    ...contentNodes.map(nodeEvidence),
    ...portfolioThreads.map((thread) => ({
      id: `thread:${thread.id}`,
      title: thread.title,
      excerpt: [
        `Thread: ${thread.title}`,
        thread.lede,
        ...portfolioBodyText(thread.body),
        `Members: ${thread.members.join(", ")}`,
      ].join("\n"),
      href: `/?view=graph#thread/${thread.id}`,
      projectTitle: thread.title,
    })),
  ];
}

export function groundPortfolioQuestion(
  question: string,
  limit = Number.POSITIVE_INFINITY,
): PortfolioGrounding {
  return {
    question,
    evidence: completePortfolioEvidence().slice(0, Math.max(0, limit)),
  };
}
