import { describe, expect, it } from "vitest";
import contentJson from "../content/portfolio-content.json";
import {
  COPY_DECK_TITLE,
  renderCopyDeck,
} from "./portfolio-copy-deck";
import {
  portfolioInterfaceTextKeys,
  type PortfolioContentDocument,
} from "./portfolio-content-schema";

const document = contentJson as PortfolioContentDocument;
const deck = renderCopyDeck(document, { exportedOn: "5 September 2026" });
const lines = deck.split("\n");
const fieldKeys = lines
  .map((line) => line.match(/^`([^`]+)`( \(one line\))?$/))
  .filter((match): match is RegExpMatchArray => match !== null);

// Every leaf string the content document holds, minus gallery slide text,
// which the deck shows as context because the schema has no path for it.
function countEditableStrings(): number {
  let count = 0;
  const body = (text: {
    paragraphs: Record<string, string>;
    placeholders: Record<string, { prompt: string; questions?: Record<string, string> }>;
    visuals: Record<string, { purpose: string; alt?: string; caption?: string }>;
  }) => {
    count += Object.keys(text.paragraphs).length;
    for (const placeholder of Object.values(text.placeholders)) {
      count += 1 + Object.keys(placeholder.questions ?? {}).length;
    }
    for (const visual of Object.values(text.visuals)) {
      count += 1 + (visual.alt !== undefined ? 1 : 0) + (visual.caption !== undefined ? 1 : 0);
    }
  };
  for (const record of Object.values(document.records)) {
    count += 3;
    body(record);
  }
  for (const thread of Object.values(document.threads)) {
    count += 2;
    body(thread);
  }
  count += 2 + Object.keys(document.contact.socialLabels).length;
  count += portfolioInterfaceTextKeys.length;
  return count;
}

describe("renderCopyDeck", () => {
  it("names the export and the content revision it came from", () => {
    expect(lines[0]).toBe(`# ${COPY_DECK_TITLE}`);
    expect(deck).toContain(`Exported 5 September 2026 from content revision ${document.revision}.`);
  });

  it("carries every editable string exactly once", () => {
    expect(fieldKeys).toHaveLength(countEditableStrings());
    for (const record of Object.values(document.records)) {
      for (const paragraph of Object.values(record.paragraphs)) {
        expect(deck.split(`\n${paragraph}\n`)).toHaveLength(2);
      }
    }
  });

  it("reads in site order: About, Threads, then the index groups, Contact, Interface", () => {
    const groups = lines.filter((line) => /^# /.test(line));
    expect(groups).toEqual([
      `# ${COPY_DECK_TITLE}`,
      "# About",
      "# Threads",
      `# ${document.interface["index.section.operations"]}`,
      `# ${document.interface["index.section.campaign"]}`,
      `# ${document.interface["index.section.client"]}`,
      `# ${document.interface["index.section.products"]}`,
      "# Contact",
      "# Interface strings",
    ]);
    const sections = lines
      .map((line) => line.match(/^## .* · `([^`]+)`$/)?.[1])
      .filter((scope): scope is string => scope !== undefined);
    expect(sections.slice(0, 6)).toEqual([
      "record:bradley",
      "thread:making-work-playable",
      "thread:from-argument-to-instrument",
      "thread:authorship",
      "thread:philosophy",
      "record:music-practice",
    ]);
    expect(sections.slice(-2)).toEqual(["contact", "interface"]);
  });

  it("follows each body's authored block order", () => {
    const infamous = deck.slice(deck.indexOf("`record:infamous`"), deck.indexOf("# Music promotions"));
    const order = ["`p1`", "`p2`", "`placeholder.infamous-early-days.prompt`", "`p3`", "`visual.infamous-service-evolution.purpose`", "`p4`"];
    const positions = order.map((key) => infamous.indexOf(key));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("marks single-line fields and leaves paragraphs unannotated", () => {
    expect(deck).toContain("`summary` (one line)\n");
    expect(deck).toContain("`p1`\n");
    expect(deck).not.toContain("`p1` (one line)");
    expect(deck).toContain("`privacy.p1`\n");
    expect(deck).toContain("`privacy.title` (one line)\n");
  });

  it("keeps a thread's own map node with it under node.* keys", () => {
    const playable = deck.slice(
      deck.indexOf("`thread:making-work-playable`"),
      deck.indexOf("`thread:from-argument-to-instrument`"),
    );
    expect(playable).toContain("`title` (one line)\nMaking work playable");
    expect(playable).toContain(`\`node.label\` (one line)\n${document.records["thread-making-work-playable"].label}`);
    expect(playable).toContain(`\`node.summary\` (one line)\n${document.records["thread-making-work-playable"].summary}`);
  });

  it("says where a record appears and which threads carry it", () => {
    expect(deck).toContain("> Work record · https://bradleyberkman.com/index/kickoff");
    expect(deck).toContain("> Practice record · past · https://bradleyberkman.com/index/infamous");
    expect(deck).toMatch(/`record:kickoff`\n\n> Work record[^\n]*\n\n> Appears in: Making work playable; Authorship\./);
  });

  it("shows gallery slide text as context, not as a field", () => {
    expect(deck).toContain("> Gallery slides (title and caption, edited through the agent, not here): 1. Day sheet");
    expect(deck).not.toMatch(/^`visual\.[a-z-]+\.slides/m);
  });
});
