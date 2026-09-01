// Authored site content adapter. The structural skeleton (IDs, families,
// positions, block order, visual metadata, link topology) lives in
// lib/portfolio-structure.ts; every user-facing string lives in
// content/portfolio-content.json. This module validates the content document
// at startup, merges it with the structure, and exports the same world,
// thread, and contact values callers have always used. A "node" is a dot on
// the map; opening one reads one of two content types:
//   - Record: the complete short piece for one thing, readable in the map reader.
//   - Thread: a narrated path through the map — the only long-form type.
// Draft copy and visual placeholders intentionally render on main while the
// portfolio is being composed.

import portfolioContentJson from "../content/portfolio-content.json";
import {
  assertValidPortfolioContentDocument,
  type PortfolioContentDocument,
  type PortfolioInterfaceTextKey,
} from "./portfolio-content-schema";
import {
  portfolioContactStructure,
  portfolioRecordStructures,
  portfolioThreadStructures,
  type PortfolioBodyBlockSkeleton,
  type PortfolioVisualFormat,
  type PortfolioVisualSourceStatus,
  type PortfolioVisualTreatment,
  type PortfolioWorldFamily,
  type PortfolioWorldGroup,
  type PortfolioWorldRegister,
} from "./portfolio-structure";

export type {
  PortfolioVisualFormat,
  PortfolioVisualSourceStatus,
  PortfolioVisualTreatment,
  PortfolioWorldFamily,
  PortfolioWorldRegister,
} from "./portfolio-structure";

export type PortfolioCopyPlaceholderBlock = {
  type: "copy-placeholder";
  id: string;
  prompt: string;
  questions?: readonly string[];
};

export type PortfolioVisualAsset = {
  src: string;
  alt: string;
  caption?: string;
};

export type PortfolioVisualBlock = {
  type: "visual";
  id: string;
  status: "planned" | "in-progress" | "ready";
  purpose: string;
  treatment?: PortfolioVisualTreatment;
  sourceStatus?: PortfolioVisualSourceStatus;
  format?: PortfolioVisualFormat;
  src?: string;
  alt?: string;
  caption?: string;
  captionsSrc?: string;
  poster?: string;
  assets?: readonly PortfolioVisualAsset[];
};

export type PortfolioBodyBlock =
  | string
  | PortfolioCopyPlaceholderBlock
  | PortfolioVisualBlock;

export type PortfolioWorldNode = {
  id: string;
  label: string;
  kind: string;
  family: PortfolioWorldFamily;
  register: PortfolioWorldRegister;
  group: PortfolioWorldGroup;
  position: { x: number; y: number };
  summary: string;
  summaryStatus?: "placeholder";
  principle?: string;
  body: readonly PortfolioBodyBlock[];
  projectSlug?: string;
  threadId?: string;
};

export type PortfolioThread = {
  id: string;
  nodeId: string;
  title: string;
  lede: string;
  body: readonly PortfolioBodyBlock[];
  members: readonly string[];
};

export type PortfolioWorldLink = {
  from: string;
  to: string;
  type: "direct" | "lineage" | "story";
  layer: "factual" | "story-root" | "story-membership";
  threadId?: string;
};

// Validation runs before anything can render from this module. An invalid
// content document fails application startup rather than serving wrong copy.
assertValidPortfolioContentDocument(portfolioContentJson);
const contentDocument: PortfolioContentDocument = portfolioContentJson;

export const portfolioContentRevision = contentDocument.revision;

export const portfolioInterfaceText: Record<PortfolioInterfaceTextKey, string> =
  contentDocument.interface as Record<PortfolioInterfaceTextKey, string>;

const inferredVisualFormat = (
  treatment?: PortfolioVisualTreatment,
): PortfolioVisualFormat => {
  if (treatment === "demo") return "video";
  if (treatment === "sequence" || treatment === "comparison") return "gallery";
  return "image";
};

export const portfolioVisualFormat = (
  block: PortfolioVisualBlock,
): PortfolioVisualFormat =>
  block.format ?? inferredVisualFormat(block.treatment);

export const isPortfolioVisualReady = (
  block: PortfolioVisualBlock,
): boolean => {
  if (block.status !== "ready") return false;

  const format = portfolioVisualFormat(block);
  if (format === "video") return Boolean(block.src && block.captionsSrc);
  if (format === "gallery") return Boolean(block.assets?.length || block.src);
  return Boolean(block.src || block.assets?.[0]?.src);
};

function mergeBody(
  skeleton: readonly PortfolioBodyBlockSkeleton[],
  texts: {
    paragraphs: Record<string, string>;
    placeholders: Record<
      string,
      { prompt: string; questions?: Record<string, string> }
    >;
    visuals: Record<string, { purpose: string; alt?: string; caption?: string }>;
  },
): readonly PortfolioBodyBlock[] {
  return skeleton.map((block): PortfolioBodyBlock => {
    if (block.kind === "paragraph") {
      return texts.paragraphs[block.id];
    }
    if (block.kind === "copy-placeholder") {
      const entry = texts.placeholders[block.id];
      const questions = block.questionIds?.map(
        (questionId) => entry.questions?.[questionId] ?? "",
      );
      return {
        type: "copy-placeholder",
        id: block.id,
        prompt: entry.prompt,
        ...(questions ? { questions } : {}),
      };
    }
    const entry = texts.visuals[block.id];
    return {
      type: "visual",
      id: block.id,
      status: block.status,
      purpose: entry.purpose,
      ...(block.treatment ? { treatment: block.treatment } : {}),
      ...(block.sourceStatus ? { sourceStatus: block.sourceStatus } : {}),
      ...(block.format ? { format: block.format } : {}),
      ...(block.src ? { src: block.src } : {}),
      ...(entry.alt ? { alt: entry.alt } : {}),
      ...(entry.caption ? { caption: entry.caption } : {}),
      ...(block.captionsSrc ? { captionsSrc: block.captionsSrc } : {}),
      ...(block.poster ? { poster: block.poster } : {}),
    };
  });
}

export function portfolioBodyText(
  body: readonly PortfolioBodyBlock[],
): string[] {
  return body.flatMap((block) => {
    if (typeof block === "string") return [block];
    if (block.type === "copy-placeholder") {
      return [
        `[DRAFT COPY PLACEHOLDER — not a Bradley fact] ${block.prompt}`,
        ...(block.questions ?? []).map((question) => `Draft question: ${question}`),
      ];
    }
    if (block.status !== "ready") {
      return [
        `[PLANNED VISUAL — not published evidence] ${block.purpose}`,
      ];
    }
    return [
      `Visual: ${block.caption ?? block.alt ?? block.purpose}`,
    ];
  });
}

export const portfolioThroughline =
  portfolioInterfaceText["hero.throughline"];

export const portfolioContact = {
  email: contentDocument.contact.email,
  cv: {
    label: contentDocument.contact.cvLabel,
    href: portfolioContactStructure.cvHref,
  },
  socials: portfolioContactStructure.socials.map(({ key, href }) => ({
    label: contentDocument.contact.socialLabels[key],
    href,
    key,
  })),
} as const;

export const portfolioWorldNodes: readonly PortfolioWorldNode[] =
  portfolioRecordStructures.map((structure) => {
    const texts = contentDocument.records[structure.id];
    return {
      id: structure.id,
      label: texts.label,
      kind: texts.kind,
      family: structure.family,
      register: structure.register,
      group: structure.group,
      position: structure.position,
      summary: texts.summary,
      ...(structure.summaryStatus
        ? { summaryStatus: structure.summaryStatus }
        : {}),
      ...(structure.hasPrinciple && texts.principle !== undefined
        ? { principle: texts.principle }
        : {}),
      body: mergeBody(structure.body, texts),
      ...(structure.projectSlug ? { projectSlug: structure.projectSlug } : {}),
      ...(structure.threadId ? { threadId: structure.threadId } : {}),
    };
  });

export const portfolioThreads: readonly PortfolioThread[] =
  portfolioThreadStructures.map((structure) => {
    const texts = contentDocument.threads[structure.id];
    return {
      id: structure.id,
      nodeId: structure.nodeId,
      title: texts.title,
      lede: texts.lede,
      body: mergeBody(structure.body, texts),
      members: structure.members,
    };
  });

export const portfolioWorldLinks: readonly PortfolioWorldLink[] = [
  ["infamous", "music-practice", "lineage"],
  ["infamous", "kickoff", "lineage"],
  ["infamous", "pitching", "lineage"],
  ["infamous", "reporting", "lineage"],
  ["infamous", "personal-os", "lineage"],
  ["music-practice", "kickoff", "direct"],
  ["music-practice", "pitching", "direct"],
  ["music-practice", "reporting", "direct"],
  ["kickoff", "pitching", "direct"],
  ["pitching", "reporting", "direct"],
  ["music-practice", "personal-os", "direct"],
  ["personal-os", "dubs", "lineage"],
  ["personal-os", "writ", "lineage"],
  ["personal-os", "yoohoo", "lineage"],
  ["systems-consulting", "real-estate", "direct"],
  ["systems-consulting", "touring", "direct"],
  ["product-studio", "dubs", "direct"],
  ["product-studio", "writ", "direct"],
  ["product-studio", "yoohoo", "direct"],
].map(([from, to, type]) => ({ from, to, type, layer: "factual" } as PortfolioWorldLink));

export const portfolioWorldNodeById = new Map(
  portfolioWorldNodes.map((node) => [node.id, node]),
);

export const portfolioThreadById = new Map(
  portfolioThreads.map((thread) => [thread.id, thread]),
);

const threadRootLinks: readonly PortfolioWorldLink[] = portfolioThreads.map(
  ({ id, nodeId }) => ({
    from: "bradley",
    to: nodeId,
    type: "story",
    layer: "story-root",
    threadId: id,
  }),
);

const threadMembershipLinks: readonly PortfolioWorldLink[] = portfolioThreads.flatMap(
  ({ id, nodeId, members }) =>
    members.map((member) => ({
      from: nodeId,
      to: member,
      type: "story" as const,
      layer: "story-membership" as const,
      threadId: id,
    })),
);

export function getVisibleWorldLinks({
  selectedId,
}: {
  activeThreadId: string | null;
  selectedId: string | null;
}): PortfolioWorldLink[] {
  const links = [...portfolioWorldLinks];
  const selected = selectedId ? portfolioWorldNodeById.get(selectedId) : undefined;

  if (selectedId === "bradley") {
    links.push(...threadRootLinks);
  } else if (selected?.family === "story" && selected.threadId) {
    links.push(...threadRootLinks.filter(({ threadId }) => threadId === selected.threadId));
  }

  // The two concise editorial constellations remain part of the authored
  // field. Focus changes their emphasis, not their existence. Finding is
  // intentionally read through the factual field rather than redundant
  // spokes.
  links.push(
    ...threadMembershipLinks.filter(
      ({ threadId }) => threadId !== "finding-myself-in-software",
    ),
  );
  if (selectedId && selected?.family !== "story") {
    const finding = threadMembershipLinks.find(
      ({ from, to, threadId }) =>
        threadId === "finding-myself-in-software" &&
        (from === selectedId || to === selectedId),
    );
    if (finding) links.push(finding);
  }
  return links;
}

export function getWorldFocusIds({
  activeThreadId,
  selectedId,
}: {
  activeThreadId: string | null;
  selectedId: string | null;
}): Set<string> | null {
  if (!selectedId) return null;
  if (selectedId === "bradley") {
    return new Set(["bradley", ...portfolioThreads.map(({ nodeId }) => nodeId)]);
  }
  if (activeThreadId) {
    const thread = portfolioThreadById.get(activeThreadId);
    return thread
      ? new Set(["bradley", thread.nodeId, ...thread.members])
      : new Set([selectedId]);
  }
  const focused = new Set([selectedId]);
  for (const { from, to } of [...portfolioWorldLinks, ...threadMembershipLinks]) {
    if (from === selectedId) focused.add(to);
    if (to === selectedId) focused.add(from);
  }
  return focused;
}

export type PortfolioWorldIndexSection =
  | {
      id: string;
      title: string;
      titleKey: PortfolioInterfaceTextKey;
      type: "nodes";
      nodeIds: readonly string[];
    }
  | {
      id: string;
      title: string;
      titleKey: PortfolioInterfaceTextKey;
      type: "threads";
    };

const indexSection = (
  id: string,
  titleKey: PortfolioInterfaceTextKey,
  nodeIds?: readonly string[],
): PortfolioWorldIndexSection =>
  nodeIds
    ? { id, title: portfolioInterfaceText[titleKey], titleKey, type: "nodes", nodeIds }
    : { id, title: portfolioInterfaceText[titleKey], titleKey, type: "threads" };

export const portfolioWorldIndexSections: readonly PortfolioWorldIndexSection[] = [
  indexSection("about", "index.section.about", ["bradley"]),
  indexSection("threads", "index.section.threads"),
  indexSection("operations", "index.section.operations", ["music-practice", "systems-consulting", "product-studio", "infamous"]),
  indexSection("campaign", "index.section.campaign", ["kickoff", "pitching", "reporting"]),
  indexSection("client", "index.section.client", ["real-estate", "touring"]),
  indexSection("personal", "index.section.personal", ["personal-os"]),
  indexSection("products", "index.section.products", ["dubs", "writ", "yoohoo"]),
];

// Legacy case-study slugs → canonical node pages. Keeps old /index/<slug>
// links working after the case-study layer was retired.
export const legacyProjectSlugRedirects: Readonly<Record<string, string>> = {
  "kickoff-intake": "kickoff",
  "real-estate-deal-tracker": "real-estate",
  "touring-advancing-tool": "touring",
  "personal-tooling": "personal-os",
  "spec-discipline": "personal-os",
  "three-maturity-bundle": "writ",
};
