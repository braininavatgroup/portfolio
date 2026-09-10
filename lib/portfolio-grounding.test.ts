import { describe, expect, it } from "vitest";
import {
  audienceStatement,
  careerTimeline,
} from "./portfolio-private-grounding";
import {
  portfolioBodyText,
  portfolioContact,
  portfolioThreads,
  portfolioThroughline,
  portfolioWorldNodes,
} from "./portfolio-world";
import { groundPortfolioQuestion } from "./portfolio-grounding";

const contentNodeCount = portfolioWorldNodes.filter(
  ({ outlineType }) => outlineType !== "why",
).length;

describe("portfolio chat grounding", () => {
  // Owner: portfolio chat grounding. Retire only when a replacement context
  // provider proves that ordinary questions still reach the agent with every
  // published node and thread and unsupported questions remain safely refused.
  it.each([
    "Tell me about yourself.",
    "What do you do?",
    "What kind of work do you do?",
    "What quantum-computing patents did Bradley file?",
  ])("loads the complete working portfolio for %s", (question) => {
    const grounding = groundPortfolioQuestion(question);

    expect(grounding.evidence).toHaveLength(
      1 + contentNodeCount + portfolioThreads.length,
    );
    expect(grounding.evidence[0]).toMatchObject({
      id: "entity:portfolio:brain",
      title: "Bradley Berkman",
      href: "/",
    });
    expect(
      grounding.evidence.filter(({ id }) => id.startsWith("node:")),
    ).toHaveLength(contentNodeCount);
    expect(
      grounding.evidence.filter(({ id }) => id.startsWith("thread:")),
    ).toHaveLength(portfolioThreads.length);

    const portfolio = grounding.evidence[0];
    expect(portfolio.excerpt).toContain(portfolioThroughline);
    expect(portfolio.excerpt).toContain(audienceStatement);
    expect(portfolio.excerpt).toContain(portfolioContact.email);
    for (const milestone of careerTimeline) {
      expect(portfolio.excerpt).toContain(
        `${milestone.period}; ${milestone.title}: ${milestone.detail}`,
      );
    }
  });

  // Owner: portfolio chat grounding. Retire with complete-node context.
  it("groups every working field for a node into one citable source", () => {
    const pitching = groundPortfolioQuestion("Any question").evidence.find(
      ({ id }) => id === "node:pitching",
    );

    expect(pitching).toMatchObject({
      title: "Music Promo Campaign Pitching",
      href: "/?view=graph#pitching",
    });
    const node = portfolioWorldNodes.find(({ id }) => id === "pitching")!;
    expect(pitching?.excerpt).toContain(`Summary: ${node.summary}`);
    for (const line of portfolioBodyText(node.body)) {
      expect(pitching?.excerpt).toContain(line);
    }
    expect(pitching?.excerpt).toContain(
      "Themes: Making Work Playable; Philosophy",
    );
  });

  it("marks unfinished copy and planned visuals as editorial notes", () => {
    const thread = portfolioThreads.find(({ id }) => id === "making-work-playable")!;
    const originalBody = thread.body;
    thread.body = [
      { type: "copy-placeholder", id: "test-copy", prompt: "Write this section." },
      { type: "visual", id: "test-visual", status: "planned", purpose: "Capture this workflow." },
    ];
    try {
      const evidence = groundPortfolioQuestion("Any question").evidence;
      const unfinished = evidence.find(({ id }) => id === `thread:${thread.id}`);
      expect(unfinished?.excerpt).toContain(
        "[DRAFT COPY PLACEHOLDER — not a Bradley fact]",
      );
      expect(unfinished?.excerpt).toContain(
        "[PLANNED VISUAL — not published evidence]",
      );
    } finally {
      thread.body = originalBody;
    }
  });

  it("reads list lines and external addresses as plain text", () => {
    const evidence = groundPortfolioQuestion("Any question").evidence;
    const music = evidence.find(({ id }) => id === "node:music-practice");
    const consulting = evidence.find(({ id }) => id === "node:systems-consulting");
    expect(consulting?.excerpt).toMatch(/\n- \S/);
    expect(music?.excerpt).toMatch(/ \(https:\/\/[^)]+\)/);
    expect(music?.excerpt).not.toMatch(/\]\((record|thread|https?):/);
  });

  it("keeps the chat-only layer out of every rendered surface", () => {
    // The audience statement grounds the agent but never appears in node or
    // thread excerpts; it lives only on the root portfolio entity.
    const grounding = groundPortfolioQuestion("Any question");
    for (const item of grounding.evidence.slice(1)) {
      expect(item.excerpt).not.toContain(audienceStatement);
    }
  });

  it("retains an explicit caller limit without selecting by question words", () => {
    const grounding = groundPortfolioQuestion("reporting", 3);

    expect(grounding.evidence).toHaveLength(3);
    expect(grounding.evidence.map(({ id }) => id)).toEqual([
      "entity:portfolio:brain",
      "node:bradley",
      "node:infamous",
    ]);
  });
});
