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
  type PortfolioContentBodyText,
  type PortfolioContentDocument,
  type PortfolioInterfaceTextKey,
} from "./portfolio-content-schema";
import {
  portfolioContactStructure,
  portfolioFactualLinkStructures,
  portfolioRecordStructures,
  portfolioThreadStructures,
  type PortfolioBodyBlockSkeleton,
  type PortfolioOutlineType,
  type PortfolioVisualAssetChrome,
  type PortfolioVisualAssetLinks,
  type PortfolioVisualFormat,
  type PortfolioVisualLayout,
  type PortfolioVisualPreview,
  type PortfolioVisualSourceStatus,
  type PortfolioVisualTreatment,
  type PortfolioRecordStatus,
  type PortfolioWorldFamily,
  type PortfolioWorldRegister,
} from "./portfolio-structure";
import { stripInlineLinks } from "./portfolio-inline-links";

export type {
  PortfolioOutlineType,
  PortfolioVisualFormat,
  PortfolioVisualAssetChrome,
  PortfolioVisualAssetLinks,
  PortfolioVisualLayout,
  PortfolioVisualPreview,
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

export type PortfolioVisualBlock = {
  type: "visual";
  id: string;
  status: "planned" | "in-progress" | "ready";
  purpose: string;
  treatment?: PortfolioVisualTreatment;
  sourceStatus?: PortfolioVisualSourceStatus;
  format?: PortfolioVisualFormat;
  src?: string;
  muxPlaybackId?: string;
  frameSrc?: string;
  alt?: string;
  caption?: string;
  captionsSrc?: string;
  poster?: string;
  preview?: PortfolioVisualPreview;
  href?: string;
  layout?: PortfolioVisualLayout;
  slides?: readonly PortfolioVisualSlide[];
};

export type PortfolioVisualAsset = {
  src: string;
  alt: string;
  /** Intrinsic image dimensions reserve its ratio before lazy loading. */
  width?: number;
  height?: number;
  label?: string;
  /** Live chrome rendered around the image, such as a macOS menu bar. */
  chrome?: PortfolioVisualAssetChrome;
  /** Off-site addresses a hover card links to. */
  links?: PortfolioVisualAssetLinks;
};

export type PortfolioVisualSlide = {
  title: string;
  caption: string;
  assets: readonly PortfolioVisualAsset[];
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
  outlineType: PortfolioOutlineType;
  position: { x: number; y: number; z: number };
  status?: PortfolioRecordStatus;
  summary: string;
  summaryStatus?: "placeholder";
  body: readonly PortfolioBodyBlock[];
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

export type PortfolioWhatNode = PortfolioWorldNode & { outlineType: "what" };

export function isPortfolioWhatNode(
  node: PortfolioWorldNode,
): node is PortfolioWhatNode {
  return node.outlineType === "what";
}

export type PortfolioWorldLink = {
  from: string;
  to: string;
  type: "direct" | "lineage" | "story" | "spotlight";
  /**
   * `story-root` lines root a Story on Bradley; `spotlight-root` roots any
   * other selected record on him, so every composition hangs from the same
   * trunk. Both draw as the tree.
   */
  layer: "factual" | "story-root" | "story-membership" | "spotlight-root";
  threadId?: string;
};

// Validation runs before anything can render from this module. An invalid
// content document fails application startup rather than serving wrong copy.
assertValidPortfolioContentDocument(portfolioContentJson);
const contentDocument: PortfolioContentDocument = portfolioContentJson;
/** The validated content document, for surfaces that export it whole. */
export const portfolioContentDocument: PortfolioContentDocument = contentDocument;

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
  if (format === "interactive") return Boolean(block.preview && block.href);
  if (format === "video") {
    return Boolean((block.muxPlaybackId || block.src) && block.captionsSrc);
  }
  if (format === "gallery" && block.slides?.length) {
    return block.slides.every((slide) => slide.assets.length > 0);
  }
  return Boolean(block.src);
};

function mergeBody(
  skeleton: readonly PortfolioBodyBlockSkeleton[],
  texts: PortfolioContentBodyText,
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
    const slides = block.slides?.map((slide, slideIndex) => {
      const slideText = entry.slides?.[slideIndex];
      return {
        title: slideText?.title ?? "",
        caption: slideText?.caption ?? "",
        assets: slide.assets.map((asset, assetIndex) => {
          const assetText = slideText?.assets[assetIndex];
          return {
            src: asset.src,
            alt: assetText?.alt ?? "",
            ...(asset.width && asset.height ? { width: asset.width, height: asset.height } : {}),
            ...(assetText?.label ? { label: assetText.label } : {}),
            ...(asset.chrome ? { chrome: asset.chrome } : {}),
            ...(asset.links ? { links: asset.links } : {}),
          };
        }),
      };
    });
    return {
      type: "visual",
      id: block.id,
      status: block.status,
      purpose: entry.purpose,
      ...(block.treatment ? { treatment: block.treatment } : {}),
      ...(block.sourceStatus ? { sourceStatus: block.sourceStatus } : {}),
      ...(block.format ? { format: block.format } : {}),
      ...(block.src ? { src: block.src } : {}),
      ...(block.muxPlaybackId ? { muxPlaybackId: block.muxPlaybackId } : {}),
      ...(block.frameSrc ? { frameSrc: block.frameSrc } : {}),
      ...(entry.alt ? { alt: entry.alt } : {}),
      ...(entry.caption ? { caption: entry.caption } : {}),
      ...(block.captionsSrc ? { captionsSrc: block.captionsSrc } : {}),
      ...(block.poster ? { poster: block.poster } : {}),
      ...(block.preview ? { preview: block.preview } : {}),
      ...(block.href ? { href: block.href } : {}),
      ...(block.layout ? { layout: block.layout } : {}),
      ...(slides ? { slides } : {}),
    };
  });
}

export function portfolioBodyText(
  body: readonly PortfolioBodyBlock[],
): string[] {
  return body.flatMap((block) => {
    if (typeof block === "string") return [stripInlineLinks(block)];
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
  portfolioInterfaceText["index.throughline"];

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

const portfolioThreadIdByNodeId = new Map(
  portfolioThreadStructures.map(({ id, nodeId }) => [nodeId, id]),
);

export const portfolioWorldNodes: readonly PortfolioWorldNode[] =
  portfolioRecordStructures.map((structure) => {
    const texts = contentDocument.records[structure.id];
    const threadId = portfolioThreadIdByNodeId.get(structure.id);
    return {
      id: structure.id,
      label: texts.label,
      kind: texts.kind,
      family: structure.family,
      register: structure.register,
      outlineType: structure.outlineType,
      position: structure.position,
      ...(structure.status ? { status: structure.status } : {}),
      summary: texts.summary,
      ...(structure.summaryStatus
        ? { summaryStatus: structure.summaryStatus }
        : {}),
      body: mergeBody(structure.body, texts),
      ...(threadId ? { threadId } : {}),
    };
  });

export const portfolioWhatNodes: readonly PortfolioWhatNode[] =
  portfolioWorldNodes.filter(isPortfolioWhatNode);

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

export const portfolioWorldLinks: readonly PortfolioWorldLink[] =
  portfolioFactualLinkStructures.map((link) => ({
    ...link,
    layer: "factual",
  }));

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

/**
 * The map at rest is Bradley's composition. No selection and Bradley selected
 * read the same way: Themes rooted on Bradley, factual and membership links visible,
 * and the full field visible. Selecting
 * Bradley therefore changes nothing on the map; the dossier already shows
 * About as home.
 */
export function isRestingWorldSelection(
  selectedId: string | null,
): selectedId is null | "bradley" {
  return !selectedId || selectedId === "bradley";
}

export function getVisibleWorldLinks({
  selectedId,
}: {
  selectedId: string | null;
}): PortfolioWorldLink[] {
  const selected = selectedId ? portfolioWorldNodeById.get(selectedId) : undefined;
  const links = [...portfolioWorldLinks];

  if (isRestingWorldSelection(selectedId)) {
    links.push(...threadRootLinks);
  } else if (selected?.outlineType === "why" && selected.threadId) {
    links.push(...threadRootLinks.filter(({ threadId }) => threadId === selected.threadId));
  } else if (selected) {
    links.push({ from: "bradley", to: selected.id, type: "spotlight", layer: "spotlight-root" });
  }

  links.push(...threadMembershipLinks);
  return links;
}

export function isWorldLinkActive(
  link: PortfolioWorldLink,
  selectedId: string | null,
): boolean {
  if (isRestingWorldSelection(selectedId)) {
    return true;
  }

  const selected = portfolioWorldNodeById.get(selectedId);
  if (!selected) return false;
  if (selected.outlineType !== "why") {
    return link.from === selectedId || link.to === selectedId;
  }

  const ownsRoot =
    link.layer === "story-root" &&
    (link.from === selectedId || link.to === selectedId);
  const ownsMembership =
    link.layer === "story-membership" &&
    link.threadId === selected.threadId;
  return ownsRoot || ownsMembership;
}

export function getWorldFocusIds({
  activeThreadId,
  selectedId,
}: {
  activeThreadId: string | null;
  selectedId: string | null;
}): Set<string> {
  if (isRestingWorldSelection(selectedId)) {
    return new Set(["bradley", ...portfolioThreads.map(({ nodeId }) => nodeId)]);
  }
  if (activeThreadId) {
    const thread = portfolioThreadById.get(activeThreadId);
    return thread
      ? new Set(["bradley", thread.nodeId, ...thread.members])
      : new Set([selectedId]);
  }
  // A record's composition hangs from Bradley like a Story's does.
  const focused = new Set(["bradley", selectedId]);
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
  indexSection("background", "index.section.background", ["music-practice", "systems-consulting", "product-studio", "infamous"]),
  indexSection("solutions", "index.section.solutions", ["kickoff", "pitching", "reporting", "real-estate", "touring"]),
  indexSection("products", "index.section.products", ["dubs", "writ"]),
  indexSection("threads", "index.section.threads"),
];
