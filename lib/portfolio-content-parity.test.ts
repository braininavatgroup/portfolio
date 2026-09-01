// Migration parity: the merged world/thread/contact exports must reproduce
// the exact authored copy captured before content moved into
// content/portfolio-content.json. The fixture is frozen; it is regenerated
// only when Bradley deliberately edits copy, so the editor can never silently
// restore older text or rewrite punctuation.
import { describe, expect, it } from "vitest";
import parityFixture from "../tests/fixtures/portfolio-content-parity.json";
import {
  portfolioContact,
  portfolioThreads,
  portfolioWorldNodes,
  type PortfolioBodyBlock,
} from "./portfolio-world";

type TextBody = {
  paragraphs: Record<string, string>;
  placeholders: Record<string, { prompt: string; questions?: Record<string, string> }>;
  visuals: Record<string, { purpose: string; alt?: string; caption?: string }>;
};

function extractBody(body: readonly PortfolioBodyBlock[]): TextBody {
  const out: TextBody = { paragraphs: {}, placeholders: {}, visuals: {} };
  let paragraph = 0;
  for (const block of body) {
    if (typeof block === "string") {
      paragraph += 1;
      out.paragraphs[`p${paragraph}`] = block;
      continue;
    }
    if (block.type === "copy-placeholder") {
      const questions = block.questions?.length
        ? Object.fromEntries(
            block.questions.map((question, index) => [`q${index + 1}`, question]),
          )
        : undefined;
      out.placeholders[block.id] = {
        prompt: block.prompt,
        ...(questions ? { questions } : {}),
      };
      continue;
    }
    out.visuals[block.id] = {
      purpose: block.purpose,
      ...(block.alt ? { alt: block.alt } : {}),
      ...(block.caption ? { caption: block.caption } : {}),
    };
  }
  return out;
}

describe("portfolio content migration parity", () => {
  it("reproduces every record's pre-migration copy", () => {
    const records = Object.fromEntries(
      portfolioWorldNodes.map((node) => [
        node.id,
        {
          label: node.label,
          kind: node.kind,
          summary: node.summary,
          ...(node.principle ? { principle: node.principle } : {}),
          ...extractBody(node.body),
        },
      ]),
    );
    expect(records).toEqual(parityFixture.records);
  });

  it("reproduces every thread's pre-migration copy", () => {
    const threads = Object.fromEntries(
      portfolioThreads.map((thread) => [
        thread.id,
        {
          title: thread.title,
          lede: thread.lede,
          ...extractBody(thread.body),
        },
      ]),
    );
    expect(threads).toEqual(parityFixture.threads);
  });

  it("reproduces the pre-migration contact values", () => {
    expect(portfolioContact.email).toBe(parityFixture.contact.email);
    expect(portfolioContact.cv.label).toBe(parityFixture.contact.cvLabel);
    expect(
      Object.fromEntries(
        portfolioContact.socials.map(({ key, label }) => [key, label]),
      ),
    ).toEqual(parityFixture.contact.socialLabels);
  });
});
