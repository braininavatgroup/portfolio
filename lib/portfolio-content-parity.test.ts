// Content-adapter fidelity: the merged world/thread/contact exports must
// reproduce content/portfolio-content.json exactly — every paragraph in
// authored order under its stable ID, every placeholder and visual text field
// injected into the right block, every contact label carried through. The
// one-time migration-parity fixture (BIV-357) proved the migration itself and
// retired with the frozen fixture; this test guards the adapter as the copy
// keeps changing through the copy deck.
import { describe, expect, it } from "vitest";
import contentDocument from "../content/portfolio-content.json";
import {
  isPortfolioVisualReady,
  portfolioContact,
  portfolioThreads,
  portfolioWorldNodes,
  type PortfolioBodyBlock,
  type PortfolioVisualBlock,
} from "./portfolio-world";

type TextBody = {
  paragraphs: Record<string, string>;
  placeholders: Record<string, { prompt: string; questions?: Record<string, string> }>;
  visuals: Record<string, {
    purpose: string;
    alt?: string;
    caption?: string;
    slides?: Array<{
      title: string;
      caption: string;
      assets: Array<{ alt: string; label?: string }>;
    }>;
  }>;
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
      ...(block.slides ? {
        slides: block.slides.map((slide) => ({
          title: slide.title,
          caption: slide.caption,
          assets: slide.assets.map((asset) => ({
            alt: asset.alt,
            ...(asset.label ? { label: asset.label } : {}),
          })),
        })),
      } : {}),
    };
  }
  return out;
}

describe("portfolio content adapter fidelity", () => {
  it("reproduces every record's text from the content document", () => {
    const records = Object.fromEntries(
      portfolioWorldNodes.map((node) => [
        node.id,
        {
          label: node.label,
          kind: node.kind,
          summary: node.summary,
          ...extractBody(node.body),
        },
      ]),
    );
    const expected = Object.fromEntries(
      Object.entries(contentDocument.records).map(([id, record]) => [
        id,
        {
          label: record.label,
          kind: record.kind,
          summary: record.summary,
          paragraphs: record.paragraphs,
          placeholders: record.placeholders,
          visuals: record.visuals,
        },
      ]),
    );
    expect(records).toEqual(expected);
  });

  it("reproduces every thread's text from the content document", () => {
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
    const expected = Object.fromEntries(
      Object.entries(contentDocument.threads).map(([id, thread]) => [
        id,
        {
          title: thread.title,
          lede: thread.lede,
          paragraphs: thread.paragraphs,
          placeholders: thread.placeholders,
          visuals: thread.visuals,
        },
      ]),
    );
    expect(threads).toEqual(expected);
  });

  it("reproduces the contact values from the content document", () => {
    expect(portfolioContact.email).toBe(contentDocument.contact.email);
    expect(portfolioContact.cv.label).toBe(contentDocument.contact.cvLabel);
    expect(
      Object.fromEntries(
        portfolioContact.socials.map(({ key, label }) => [key, label]),
      ),
    ).toEqual(contentDocument.contact.socialLabels);
  });

  it("publishes the quarterly dashboard without an empty real-estate visual", () => {
    const realEstate = portfolioWorldNodes.find((node) => node.id === "real-estate");
    const interactive = realEstate?.body.at(-1);

    expect(realEstate?.body).toHaveLength(4);
    expect(
      realEstate?.body.some(
        (block) => typeof block !== "string" && block.id === "real-estate-operation-map",
      ),
    ).toBe(false);
    expect(interactive).toMatchObject({
      format: "interactive",
      href: "/demos/quarterly-dashboard",
      id: "real-estate-quarterly-dashboard",
      preview: "quarterly-dashboard",
      status: "ready",
      type: "visual",
    });
    expect(isPortfolioVisualReady(interactive as PortfolioVisualBlock)).toBe(true);
  });
});
