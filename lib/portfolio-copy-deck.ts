// The copy deck: one Markdown document holding every editable string on the
// portfolio, ordered the way a visitor reads the site. Bradley exports it from
// the live site into Google Docs or Obsidian, edits there, and hands the
// edited deck to an agent, who diffs it against a fresh export and applies
// the changes to content/portfolio-content.json by hand. Nothing parses the
// deck back; it is a reading and writing surface, not a wire format.
//
// Deck shape:
//   # <group>                    a reading-order group (About, Threads, ...)
//   ## <title> · `<scope>`       one record, thread, or catalog; scope is
//                                record:<id>, thread:<id>, contact, interface
//   > ...                        context: where the text appears, what it does
//   `<key>` [annotation]         one editable field; the text below it is the
//                                live value. docs/content/copy-deck.md maps
//                                keys to content paths.

import {
  isMultiLineContentPath,
  portfolioInterfaceTextKeys,
  type PortfolioContentBodyText,
  type PortfolioContentDocument,
} from "./portfolio-content-schema";
import {
  portfolioContactStructure,
  portfolioRecordStructures,
  portfolioThreadStructures,
  type PortfolioBodyBlockSkeleton,
  type PortfolioRecordStructure,
} from "./portfolio-structure";

export const COPY_DECK_TITLE = "Portfolio copy deck";
export const COPY_DECK_SITE_URL = "https://bradleyberkman.com";

export function copyDeckFileName(exportedOn: string): string {
  return `portfolio-copy-deck-${exportedOn}.md`;
}

/** Index groups in reading order; titles come from the interface catalog. */
const RECORD_GROUPS: readonly { titleKey: string; recordIds: readonly string[] }[] = [
  { titleKey: "index.section.operations", recordIds: ["music-practice", "systems-consulting", "product-studio", "infamous"] },
  { titleKey: "index.section.campaign", recordIds: ["kickoff", "pitching", "reporting"] },
  { titleKey: "index.section.client", recordIds: ["real-estate", "touring"] },
  { titleKey: "index.section.products", recordIds: ["dubs", "writ", "yoohoo"] },
];

const HOME_RECORD_ID = "bradley";

const INTERFACE_GROUPS: readonly { title: string; prefix: string }[] = [
  { title: "Map and index", prefix: "index." },
  { title: "Map and index", prefix: "world." },
  { title: "Map and index", prefix: "indexPage." },
  { title: "Map and index", prefix: "visualStage." },
  { title: "Dossier", prefix: "reader." },
  { title: "Guide chat", prefix: "chat." },
  { title: "Privacy page", prefix: "privacy." },
  { title: "Accessibility", prefix: "layout." },
];

const OUTLINE_LABEL: Record<PortfolioRecordStructure["outlineType"], string> = {
  who: "About",
  where: "Practice",
  what: "Work",
  why: "Thread",
};

export type CopyDeckOptions = {
  /** ISO date or human date shown in the header. */
  exportedOn: string;
  siteUrl?: string;
};

function heading(title: string, scope: string): string {
  return `## ${title} · \`${scope}\``;
}

function field(key: string, value: string, multiline: boolean): string {
  const annotation = multiline ? "" : " (one line)";
  return `\`${key}\`${annotation}\n${value}`;
}

function context(text: string): string {
  return `> ${text}`;
}

function renderBody(
  body: readonly PortfolioBodyBlockSkeleton[],
  text: PortfolioContentBodyText,
): string[] {
  const out: string[] = [];
  for (const block of body) {
    if (block.kind === "paragraph") {
      out.push(field(block.id, text.paragraphs[block.id] ?? "", true));
      continue;
    }
    if (block.kind === "copy-placeholder") {
      const placeholder = text.placeholders[block.id];
      if (!placeholder) continue;
      out.push(
        context(
          "Copy placeholder: your own note about what still has to be written. It renders as a workbench block on the live site until the paragraph exists.",
        ),
      );
      out.push(field(`placeholder.${block.id}.prompt`, placeholder.prompt, false));
      for (const questionId of block.questionIds ?? []) {
        const question = placeholder.questions?.[questionId];
        if (question === undefined) continue;
        out.push(field(`placeholder.${block.id}.${questionId}`, question, false));
      }
      continue;
    }
    const visual = text.visuals[block.id];
    if (!visual) continue;
    const bits = [
      `Visual (${block.format ?? "image"}, ${block.status})`,
      block.treatment ? `treatment: ${block.treatment}` : null,
      block.sourceStatus ? `source: ${block.sourceStatus}` : null,
    ].filter(Boolean);
    out.push(context(`${bits.join(", ")}. Purpose is what the visitor should understand; caption sits under the frame.`));
    out.push(field(`visual.${block.id}.purpose`, visual.purpose, false));
    if (visual.caption !== undefined) {
      out.push(field(`visual.${block.id}.caption`, visual.caption, false));
    }
    if (visual.alt !== undefined) {
      out.push(field(`visual.${block.id}.alt`, visual.alt, false));
    }
    if (visual.slides?.length) {
      const slideNotes = visual.slides
        .map((slide, index) => `${index + 1}. ${slide.title} — ${slide.caption}`)
        .join(" ");
      out.push(
        context(
          `Gallery slides (title and caption, edited through the agent, not here): ${slideNotes}`,
        ),
      );
    }
  }
  return out;
}

function threadsContaining(recordId: string): string[] {
  return portfolioThreadStructures
    .filter((thread) => thread.members.includes(recordId))
    .map((thread) => thread.id);
}

function renderRecord(
  structure: PortfolioRecordStructure,
  document: PortfolioContentDocument,
  siteUrl: string,
): string[] {
  const record = document.records[structure.id];
  const out: string[] = [];
  out.push(heading(record.label, `record:${structure.id}`));
  const where = [
    `${OUTLINE_LABEL[structure.outlineType]} record`,
    structure.status === "past" ? "past" : null,
    `${siteUrl}/index/${structure.id}`,
  ].filter(Boolean);
  const threads = threadsContaining(structure.id)
    .map((threadId) => document.threads[threadId]?.title ?? threadId);
  out.push(context(where.join(" · ")));
  if (threads.length) {
    out.push(context(`Appears in: ${threads.join("; ")}.`));
  }
  out.push(
    context(
      "Label is the map node and the dossier heading. Kind is the small line under it. Summary is the one-sentence lead.",
    ),
  );
  out.push(field("label", record.label, false));
  out.push(field("kind", record.kind, false));
  out.push(field("summary", record.summary, false));
  out.push(...renderBody(structure.body, record));
  return out;
}

export function renderCopyDeck(
  document: PortfolioContentDocument,
  options: CopyDeckOptions,
): string {
  const siteUrl = options.siteUrl ?? COPY_DECK_SITE_URL;
  const parts: string[] = [];

  parts.push(`# ${COPY_DECK_TITLE}`);
  parts.push(`Exported ${options.exportedOn} from content revision ${document.revision}.`);
  parts.push(
    [
      "How this deck works",
      "- Every piece of text on the site is here once, in reading order. Edit the text under any `key` line.",
      "- Keep the `key` lines and the `## ...` headings so an agent can tell which field a change belongs to. Everything else is yours to rewrite.",
      "- Lines starting with > say where the text appears. They are notes, not copy.",
      "- Fields marked (one line) render as a single line. Paragraphs can run several lines; a line starting with \"- \" renders as a bullet.",
      "- Inline links stay as written: [phrase](record:kickoff), [phrase](thread:philosophy), or [phrase](https://...).",
      "- Want a paragraph added, cut, or moved, or slide text changed? Write the note in place; the agent handles the structure.",
      "- When you are done, hand the deck (or just the sections you touched) to an agent and ask it to apply the copy deck edits.",
    ].join("\n"),
  );

  // About
  const home = portfolioRecordStructures.find((record) => record.id === HOME_RECORD_ID);
  if (home) {
    parts.push("# About");
    parts.push(context("The home dossier. Its summary is the headline visitors see first."));
    parts.push(...renderRecord(home, document, siteUrl));
  }

  // Threads
  parts.push(`# ${document.interface["index.section.threads"] ?? "Threads"}`);
  parts.push(context(document.interface["indexPage.threadsSubtitle"] ?? "Narrated paths through the map."));
  for (const structure of portfolioThreadStructures) {
    const thread = document.threads[structure.id];
    const node = document.records[structure.nodeId];
    const nodeStructure = portfolioRecordStructures.find((record) => record.id === structure.nodeId);
    parts.push(heading(thread.title, `thread:${structure.id}`));
    const members = structure.members
      .map((memberId) => document.records[memberId]?.label ?? memberId)
      .join("; ");
    parts.push(context(`Thread essay. Members in order: ${members}.`));
    parts.push(context("Title is the essay heading. Lede is the standfirst under it."));
    parts.push(field("title", thread.title, false));
    parts.push(field("lede", thread.lede, false));
    parts.push(...renderBody(structure.body, thread));
    if (node && nodeStructure) {
      parts.push(
        context(
          "The thread's map node: node.label is the dot on the map and the index row, node.kind the small line, node.summary the one-sentence lead before the essay opens.",
        ),
      );
      parts.push(field("node.label", node.label, false));
      parts.push(field("node.kind", node.kind, false));
      parts.push(field("node.summary", node.summary, false));
      parts.push(...renderBody(nodeStructure.body, node).map((line) => prefixKeys(line, "node.")));
    }
  }

  // Records by index group
  for (const group of RECORD_GROUPS) {
    parts.push(`# ${document.interface[group.titleKey] ?? group.titleKey}`);
    for (const recordId of group.recordIds) {
      const structure = portfolioRecordStructures.find((record) => record.id === recordId);
      if (!structure) continue;
      parts.push(...renderRecord(structure, document, siteUrl));
    }
  }

  // Contact
  parts.push("# Contact");
  parts.push(heading("Contact", "contact"));
  parts.push(context("The contact rows at the end of the home dossier. Addresses live in code; these are the visible labels."));
  parts.push(field("email", document.contact.email, false));
  parts.push(field("cvLabel", document.contact.cvLabel, false));
  for (const social of portfolioContactStructure.socials) {
    parts.push(field(`social.${social.key}`, document.contact.socialLabels[social.key] ?? "", false));
  }

  // Interface strings
  parts.push("# Interface strings");
  parts.push(heading("Interface strings", "interface"));
  parts.push(
    context(
      "Buttons, headings, status lines, and the privacy page. Rarely worth a rewrite, but here so nothing on the site is out of reach.",
    ),
  );
  let lastGroup: string | null = null;
  for (const key of portfolioInterfaceTextKeys) {
    const group = INTERFACE_GROUPS.find((candidate) => key.startsWith(candidate.prefix));
    const title = group?.title ?? "Other";
    if (title !== lastGroup) {
      parts.push(context(title));
      lastGroup = title;
    }
    parts.push(field(key, document.interface[key] ?? "", isMultiLineContentPath(`interface.${key}`)));
  }

  return `${parts.join("\n\n")}\n`;
}

function prefixKeys(rendered: string, prefix: string): string {
  return rendered.replace(/^`([^`]+)`/, (_match, key: string) => `\`${prefix}${key}\``);
}
