import { describe, expect, it } from "vitest";
import contentJson from "../content/portfolio-content.json";
import {
  COPY_DECK_INTERFACE_LABELS,
  COPY_DECK_SITE_TEXT_NOTE,
  copyDeckNoteName,
  renderCopyDeckPages,
} from "./portfolio-copy-deck";
import {
  portfolioInterfaceTextKeys,
  type PortfolioContentDocument,
} from "./portfolio-content-schema";

const document = contentJson as PortfolioContentDocument;
const pages = renderCopyDeckPages(document);
const all = pages.map((page) => page.content).join("\n");
const pageAt = (path: string) => {
  const page = pages.find((candidate) => candidate.path === path);
  if (!page) throw new Error(`no page ${path}; have ${pages.map((p) => p.path).join(", ")}`);
  return page.content;
};

// Every string a visitor, screen reader, or the Guide chat can meet.
function everyEditableString(): string[] {
  const values: string[] = [];
  const body = (text: PortfolioContentDocument["records"][string] | PortfolioContentDocument["threads"][string]) => {
    values.push(...Object.values(text.paragraphs));
    for (const placeholder of Object.values(text.placeholders)) {
      values.push(placeholder.prompt, ...Object.values(placeholder.questions ?? {}));
    }
    for (const visual of Object.values(text.visuals)) {
      values.push(visual.purpose);
      if (visual.alt !== undefined) values.push(visual.alt);
      if (visual.caption !== undefined) values.push(visual.caption);
      for (const slide of visual.slides ?? []) values.push(slide.title, slide.caption);
    }
  };
  for (const record of Object.values(document.records)) {
    values.push(record.label, record.kind, record.summary);
    body(record);
  }
  for (const thread of Object.values(document.threads)) {
    values.push(thread.title, thread.lede);
    body(thread);
  }
  values.push(document.contact.email, document.contact.cvLabel, ...Object.values(document.contact.socialLabels));
  values.push(...portfolioInterfaceTextKeys.map((key) => document.interface[key]));
  return values;
}

describe("renderCopyDeckPages", () => {
  it("writes one note per page of the site, in site order, plus the site text", () => {
    expect(pages.map((page) => page.path)).toEqual([
      "Bradley Berkman.md",
      ...["music-practice", "systems-consulting", "product-studio", "infamous"].map(
        (id) => `${document.interface["index.section.background"]}/${copyDeckNoteName(document.records[id].label)}`,
      ),
      ...["kickoff", "pitching", "reporting"].map(
        (id) => `${document.interface["index.section.solutions"]}/${copyDeckNoteName(document.records[id].label)}`,
      ),
      ...["real-estate", "touring"].map(
        (id) => `${document.interface["index.section.solutions"]}/${copyDeckNoteName(document.records[id].label)}`,
      ),
      ...["dubs", "writ"].map(
        (id) => `${document.interface["index.section.products"]}/${copyDeckNoteName(document.records[id].label)}`,
      ),
      ...["making-work-playable", "philosophy"].map(
        (id) => `${document.interface["index.section.threads"]}/${copyDeckNoteName(document.threads[id].title)}`,
      ),
      COPY_DECK_SITE_TEXT_NOTE,
    ]);
  });

  it("carries every editable string somewhere in the folder", () => {
    for (const value of everyEditableString()) {
      expect(all).toContain(value);
    }
  });

  it("keeps keys, IDs, and site jargon out of every note", () => {
    expect(all).not.toMatch(/`/);
    expect(all).not.toMatch(/\brecord:[a-z-]+`|\b(records|threads|interface|placeholders|visuals)\.[a-zA-Z_]/);
    for (const key of portfolioInterfaceTextKeys) {
      expect(all).not.toContain(key);
      expect(COPY_DECK_INTERFACE_LABELS[key]).toBeDefined();
    }
    expect(all).not.toMatch(/\(one line\)|dossier|lede|summary:/i);
  });

  it("renders a page as its title, a bold opener, then the body in authored order", () => {
    const record = document.records.infamous;
    const page = pageAt(`${document.interface["index.section.background"]}/INFAMOUS PR.md`);
    expect(page.startsWith(`# INFAMOUS PR\n\n**${record.summary}**\n\n${record.paragraphs.p1}\n\n`)).toBe(true);
    const order = [
      `> [!info] ${record.visuals["infamous-clients"].purpose}`,
      record.paragraphs.p2,
      record.paragraphs.p3,
      record.paragraphs.p4,
    ];
    const positions = order.map((needle) => page.indexOf(needle));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(page.endsWith(`${record.paragraphs.p4}\n`)).toBe(true);
  });

  it("keeps a visual's caption and slides inside its callout", () => {
    const daySheet = document.records.dubs.visuals["dubs-loop"];
    expect(all).toContain(
      `> [!info] ${daySheet.purpose}\n> ${daySheet.caption}\n> 1. ${daySheet.slides?.[0].title}: ${daySheet.slides?.[0].caption}`,
    );
  });

  it("renders a thread as its title and bold lede, and parks its map node text in the site text", () => {
    const thread = document.threads["making-work-playable"];
    const node = document.records["thread-making-work-playable"];
    expect(pageAt(`${document.interface["index.section.threads"]}/Making Work Playable.md`).startsWith(`# ${thread.title}\n\n**${thread.lede}**\n\n`)).toBe(true);
    const siteText = pageAt(COPY_DECK_SITE_TEXT_NOTE);
    expect(siteText).toContain(`### ${node.label}\n\n${node.summary}`);
  });

  it("labels site text by where it shows and lists record kinds under Guide chat only", () => {
    const siteText = pageAt(COPY_DECK_SITE_TEXT_NOTE);
    expect(siteText).toContain(`Email: ${document.contact.email}`);
    expect(siteText).toContain(`Back button: ${document.interface["reader.backButton"]}`);
    expect(siteText).toContain(`First paragraph: ${document.interface["privacy.p1"]}`);
    expect(siteText.slice(siteText.indexOf("## Guide chat only"))).toContain(
      `${document.records.kickoff.label}: ${document.records.kickoff.kind}`,
    );
  });

  it("makes safe note names", () => {
    expect(copyDeckNoteName("Systems / AI: consulting")).toBe("Systems - AI- consulting.md");
  });
});
