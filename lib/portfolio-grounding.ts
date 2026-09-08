import {
  portfolioBodyText,
  portfolioContact,
  portfolioThreads,
  portfolioThroughline,
  portfolioWorldNodes,
  portfolioWorldIndexSections,
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
};

export type PortfolioGrounding = {
  question: string;
  evidence: PortfolioGroundingEvidence[];
};

const contentNodes = portfolioWorldNodes.filter(
  (node) => node.outlineType !== "why",
);

function threadsContaining(nodeId: string) {
  return portfolioThreads.filter(({ members }) => members.includes(nodeId));
}

function nodeEvidence(node: PortfolioWorldNode): PortfolioGroundingEvidence {
  const threads = threadsContaining(node.id);
  const lines = [
    `Kind: ${node.kind}`,
    ...portfolioWorldIndexSections
      .filter((section) => section.type === "nodes" && section.nodeIds.includes(node.id))
      .map((section) => `Section: ${section.title}`),
    `Summary: ${node.summary}`,
    ...portfolioBodyText(node.body),
    ...(threads.length
      ? [`Themes: ${threads.map(({ title }) => title).join("; ")}`]
      : []),
  ];
  return {
    id: `node:${node.id}`,
    title: node.label,
    excerpt: lines.join("\n"),
    href: `/?view=graph#${node.id}`,
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
