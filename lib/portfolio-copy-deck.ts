// The copy deck: a folder of clean Markdown notes, one per page of the
// portfolio, that Bradley drops into his Obsidian vault and edits there. No
// keys, IDs, or site jargon appear in the notes; each reads like the page it
// came from. Bradley hands the edited folder to an agent, who writes a fresh
// export beside it, diffs the two, and applies the changes to
// content/portfolio-content.json by hand. docs/content/copy-deck.md maps the
// note layout back to content paths. Nothing parses the notes.

import {
  portfolioInterfaceTextKeys,
  type PortfolioContentBodyText,
  type PortfolioContentDocument,
} from "./portfolio-content-schema";
import {
  portfolioContactStructure,
  portfolioRecordStructures,
  portfolioThreadStructures,
  type PortfolioBodyBlockSkeleton,
} from "./portfolio-structure";

export const COPY_DECK_FOLDER = "Portfolio copy";
export const COPY_DECK_SITE_TEXT_NOTE = "Site text.md";

export type CopyDeckPage = {
  /** Path inside the folder, e.g. "Threads/Making Work Playable.md". */
  path: string;
  content: string;
};

/** Index groups in reading order; folder names come from the interface catalog. */
const RECORD_GROUPS: readonly { titleKey: string; recordIds: readonly string[] }[] = [
  { titleKey: "index.section.background", recordIds: ["music-practice", "systems-consulting", "product-studio", "infamous"] },
  { titleKey: "index.section.solutions", recordIds: ["kickoff", "pitching", "reporting", "real-estate", "touring"] },
  { titleKey: "index.section.products", recordIds: ["dubs", "writ"] },
];

const HOME_RECORD_ID = "bradley";

/**
 * Plain descriptions for the interface strings, grouped by where they show.
 * The description is the only label the site-text note shows.
 */
export const COPY_DECK_INTERFACE_LABELS: Record<string, { group: string; label: string }> = {
  "world.mast": { group: "Map", label: "Name over the map" },
  "index.throughline": { group: "Map", label: "Line under the index title" },
  "visualStage.eyebrow": { group: "Map", label: "Small label above an opened visual" },
  "index.section.threads": { group: "Index headings", label: "Threads group" },
  "index.section.background": { group: "Index headings", label: "Background group" },
  "index.section.solutions": { group: "Index headings", label: "Solutions group" },
  "index.section.products": { group: "Index headings", label: "Products group" },
  "indexPage.threadsSubtitle": { group: "Index headings", label: "Line under the Threads group" },
  "reader.indexTitle": { group: "Record pages", label: "Index title" },
  "reader.backButton": { group: "Record pages", label: "Back button" },
  "reader.exploreThread": { group: "Record pages", label: "Heading over a thread's member list" },
  "reader.relatedTitle": { group: "Record pages", label: "Heading over the related threads" },
  "reader.contactTitle": { group: "Record pages", label: "Heading over the contact rows" },
  "reader.copyInProgress": { group: "Record pages", label: "Tag on a note to self" },
  "reader.privacyLink": { group: "Record pages", label: "Privacy link at the end" },
  "chat.title": { group: "Guide chat", label: "Title" },
  "chat.backButton": { group: "Guide chat", label: "Back button" },
  "chat.composerPlaceholder": { group: "Guide chat", label: "Empty message box, mid-conversation" },
  "chat.composerPlaceholderOpening": { group: "Guide chat", label: "Empty message box, before the first question" },
  "chat.pendingStatus": { group: "Guide chat", label: "While an answer is coming" },
  "chat.unavailable": { group: "Guide chat", label: "When the answer service is down" },
  "privacy.backLink": { group: "Privacy page", label: "Back link" },
  "privacy.title": { group: "Privacy page", label: "Title" },
  "privacy.p1": { group: "Privacy page", label: "First paragraph" },
  "privacy.p2": { group: "Privacy page", label: "Second paragraph" },
  "privacy.p3": { group: "Privacy page", label: "Third paragraph" },
  "privacy.questionsPrefix": { group: "Privacy page", label: "Before the email link" },
  "privacy.enableAnalytics": { group: "Privacy page", label: "Button to turn analytics back on" },
  "privacy.optOutAnalytics": { group: "Privacy page", label: "Button to turn analytics off" },
  "layout.skipLink": { group: "Keyboard users", label: "Skip link" },
};

/** A note file name from a page title: no path separators or colons. */
export function copyDeckNoteName(title: string): string {
  return `${title.replace(/[/\\:]/g, "-").replace(/\s+/g, " ").trim()}.md`;
}

function renderBody(
  body: readonly PortfolioBodyBlockSkeleton[],
  text: PortfolioContentBodyText,
): string[] {
  const out: string[] = [];
  for (const block of body) {
    if (block.kind === "paragraph") {
      out.push(text.paragraphs[block.id] ?? "");
      continue;
    }
    if (block.kind === "copy-placeholder") {
      const placeholder = text.placeholders[block.id];
      if (!placeholder) continue;
      const lines = [`> [!note] ${placeholder.prompt}`];
      for (const questionId of block.questionIds ?? []) {
        const question = placeholder.questions?.[questionId];
        if (question !== undefined) lines.push(`> - ${question}`);
      }
      out.push(lines.join("\n"));
      continue;
    }
    const visual = text.visuals[block.id];
    if (!visual) continue;
    const lines = [`> [!${block.status === "ready" ? "info" : "todo"}] ${visual.purpose}`];
    if (visual.caption !== undefined) lines.push(`> ${visual.caption}`);
    if (visual.alt !== undefined) lines.push(`> Alt text: ${visual.alt}`);
    visual.slides?.forEach((slide, index) => {
      lines.push(`> ${index + 1}. ${slide.title}: ${slide.caption}`);
    });
    out.push(lines.join("\n"));
  }
  return out;
}

function note(parts: string[]): string {
  return `${parts.join("\n\n")}\n`;
}

function recordPage(document: PortfolioContentDocument, recordId: string, folder: string): CopyDeckPage | null {
  const structure = portfolioRecordStructures.find((record) => record.id === recordId);
  const record = document.records[recordId];
  if (!structure || !record) return null;
  return {
    path: `${folder ? `${folder}/` : ""}${copyDeckNoteName(record.label)}`,
    content: note([
      `# ${record.label}`,
      `**${record.summary}**`,
      ...renderBody(structure.body, record),
    ]),
  };
}

function siteTextPage(document: PortfolioContentDocument): CopyDeckPage {
  const parts: string[] = ["# Site text"];

  parts.push("## Contact");
  parts.push(
    [
      `Email: ${document.contact.email}`,
      `CV link: ${document.contact.cvLabel}`,
      ...portfolioContactStructure.socials.map(
        (social) => `${social.key}: ${document.contact.socialLabels[social.key] ?? ""}`,
      ),
    ].join("\n"),
  );

  let lastGroup: string | null = null;
  let lines: string[] = [];
  const flush = () => {
    if (lines.length) parts.push(lines.join("\n"));
    lines = [];
  };
  for (const key of portfolioInterfaceTextKeys) {
    const entry = COPY_DECK_INTERFACE_LABELS[key] ?? { group: "Other", label: key };
    if (entry.group !== lastGroup) {
      flush();
      parts.push(`## ${entry.group}`);
      lastGroup = entry.group;
    }
    const value = document.interface[key] ?? "";
    if (value.includes("\n")) {
      flush();
      parts.push(`${entry.label}:\n${value}`);
    } else {
      lines.push(`${entry.label}: ${value}`);
    }
  }
  flush();

  parts.push("## Guide chat only");
  parts.push("Text no visitor sees on screen. The Guide chat and screen readers use it to describe each page.");
  parts.push(
    portfolioRecordStructures
      .filter((structure) => !structure.id.startsWith("thread-"))
      .map((structure) => `${document.records[structure.id].label}: ${document.records[structure.id].kind}`)
      .join("\n"),
  );
  for (const structure of portfolioThreadStructures) {
    const node = document.records[structure.nodeId];
    const nodeStructure = portfolioRecordStructures.find((record) => record.id === structure.nodeId);
    if (!node || !nodeStructure) continue;
    parts.push(`### ${node.label}`);
    parts.push(node.summary);
    parts.push(...renderBody(nodeStructure.body, node));
  }

  return { path: COPY_DECK_SITE_TEXT_NOTE, content: note(parts) };
}

/** One note per page of the site, plus the site-text note, in reading order. */
export function renderCopyDeckPages(document: PortfolioContentDocument): CopyDeckPage[] {
  const pages: CopyDeckPage[] = [];

  const home = recordPage(document, HOME_RECORD_ID, "");
  if (home) pages.push(home);

  for (const group of RECORD_GROUPS) {
    const folder = document.interface[group.titleKey] ?? group.titleKey;
    for (const recordId of group.recordIds) {
      const page = recordPage(document, recordId, folder);
      if (page) pages.push(page);
    }
  }

  const threadsFolder = document.interface["index.section.threads"] ?? "Threads";
  for (const structure of portfolioThreadStructures) {
    const thread = document.threads[structure.id];
    pages.push({
      path: `${threadsFolder}/${copyDeckNoteName(thread.title)}`,
      content: note([
        `# ${thread.title}`,
        `**${thread.lede}**`,
        ...renderBody(structure.body, thread),
      ]),
    });
  }

  pages.push(siteTextPage(document));
  return pages;
}
