// Canonical schema for content/portfolio-content.json — the single store for
// every user-facing string on the public portfolio. This module owns the
// document types and validation. It has no browser, filesystem, or Git
// dependency. Edits to the document are made by hand (see
// docs/content/copy-deck.md); validation runs before anything renders.

import {
  portfolioContactStructure,
  portfolioRecordStructures,
  portfolioThreadStructures,
  type PortfolioBodyBlockSkeleton,
} from "./portfolio-structure";
import { inlineLinkTargets } from "./portfolio-inline-links";

export const PORTFOLIO_CONTENT_VERSION = 1;

// Documented size limits for a single editable value.
export const SINGLE_LINE_MAX_LENGTH = 2000;
export const MULTI_LINE_MAX_LENGTH = 20000;

export type PortfolioContentBodyText = {
  paragraphs: Record<string, string>;
  placeholders: Record<
    string,
    { prompt: string; questions?: Record<string, string> }
  >;
  visuals: Record<string, PortfolioContentVisualText>;
};

export type PortfolioContentVisualText = {
  purpose: string;
  alt?: string;
  caption?: string;
  slides?: Array<{
    title: string;
    caption: string;
    assets: Array<{ alt: string; label?: string }>;
  }>;
};

export type PortfolioContentRecord = PortfolioContentBodyText & {
  label: string;
  kind: string;
  summary: string;
};

export type PortfolioContentThread = PortfolioContentBodyText & {
  title: string;
  lede: string;
};

export type PortfolioContentDocument = {
  version: number;
  revision: number;
  records: Record<string, PortfolioContentRecord>;
  threads: Record<string, PortfolioContentThread>;
  contact: {
    email: string;
    cvLabel: string;
    socialLabels: Record<string, string>;
  };
  interface: Record<string, string>;
};

// Every interface-catalog key rendered by a component. Unknown keys are
// rejected; missing keys fail startup validation.
export const portfolioInterfaceTextKeys = [
  "layout.skipLink",
  "index.throughline",
  "world.mast",
  "visualStage.eyebrow",
  "reader.indexTitle",
  "reader.backButton",
  "reader.exploreThread",
  "reader.contactTitle",
  "reader.relatedTitle",
  "reader.copyInProgress",
  "reader.privacyLink",
  "index.section.threads",
  "index.section.background",
  "index.section.solutions",
  "index.section.products",
  "indexPage.threadsSubtitle",
  "chat.title",
  "chat.backButton",
  "chat.composerPlaceholder",
  "chat.composerPlaceholderOpening",
  "chat.pendingStatus",
  "chat.unavailable",
  "privacy.backLink",
  "privacy.title",
  "privacy.p1",
  "privacy.p2",
  "privacy.p3",
  "privacy.questionsPrefix",
  "privacy.enableAnalytics",
  "privacy.optOutAnalytics",
] as const;

export type PortfolioInterfaceTextKey =
  (typeof portfolioInterfaceTextKeys)[number];

// Paths that accept embedded line breaks. Everything else is single-line.
const MULTI_LINE_PATH_PATTERN = /^(records|threads)\.[^.]+\.paragraphs\.[^.]+$/;
const MULTI_LINE_INTERFACE_KEYS = new Set([
  "privacy.p1",
  "privacy.p2",
  "privacy.p3",
]);

function isMultiLineContentPath(path: string): boolean {
  if (MULTI_LINE_PATH_PATTERN.test(path)) return true;
  if (path.startsWith("interface.")) {
    return MULTI_LINE_INTERFACE_KEYS.has(path.slice("interface.".length));
  }
  return false;
}

export type ContentValidationIssue = { path: string; message: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function checkString(
  issues: ContentValidationIssue[],
  path: string,
  value: unknown,
) {
  if (typeof value !== "string") {
    issues.push({ path, message: "must be a string" });
    return;
  }
  const limit = isMultiLineContentPath(path)
    ? MULTI_LINE_MAX_LENGTH
    : SINGLE_LINE_MAX_LENGTH;
  if (value.length > limit) {
    issues.push({ path, message: `exceeds the ${limit} character limit` });
  }
  if (!isMultiLineContentPath(path) && /[\r\n]/.test(value)) {
    issues.push({ path, message: "single-line value must not contain line breaks" });
  }
  // eslint-disable-next-line no-control-regex -- rejecting raw control characters is the point
  if (/[\u0000-\u0008\u000B-\u001F\u007F]/.test(value)) {
    issues.push({ path, message: "must not contain control characters" });
  }
}

const recordIds = new Set(portfolioRecordStructures.map(({ id }) => id));
const threadIds = new Set(portfolioThreadStructures.map(({ id }) => id));

// An inline `[label](record:id)` must point at a record or thread that
// exists in the structure; a dangling one would render as dead plain text.
function checkInlineLinks(
  issues: ContentValidationIssue[],
  path: string,
  text: string,
) {
  for (const target of inlineLinkTargets(text)) {
    if (target.kind === "external") continue;
    const known = target.kind === "record" ? recordIds : threadIds;
    if (!known.has(target.id)) {
      issues.push({ path, message: `links to unknown ${target.kind} "${target.id}"` });
    }
  }
}

function checkBodyText(
  issues: ContentValidationIssue[],
  basePath: string,
  body: readonly PortfolioBodyBlockSkeleton[],
  value: Record<string, unknown>,
) {
  const paragraphIds = body.flatMap((block) =>
    block.kind === "paragraph" ? [block.id] : [],
  );
  const placeholderBlocks = body.flatMap((block) =>
    block.kind === "copy-placeholder" ? [block] : [],
  );
  const visualBlocks = body.flatMap((block) =>
    block.kind === "visual" ? [block] : [],
  );
  const visualIds = visualBlocks.map(({ id }) => id);

  const paragraphs = value.paragraphs;
  if (!isPlainObject(paragraphs)) {
    issues.push({ path: `${basePath}.paragraphs`, message: "must be an object" });
  } else {
    for (const id of paragraphIds) {
      if (!(id in paragraphs)) {
        issues.push({ path: `${basePath}.paragraphs.${id}`, message: "is missing" });
      }
    }
    for (const [id, text] of Object.entries(paragraphs)) {
      if (!paragraphIds.includes(id)) {
        issues.push({ path: `${basePath}.paragraphs.${id}`, message: "unknown paragraph ID" });
        continue;
      }
      checkString(issues, `${basePath}.paragraphs.${id}`, text);
      if (typeof text === "string") {
        checkInlineLinks(issues, `${basePath}.paragraphs.${id}`, text);
      }
    }
  }

  const placeholders = value.placeholders;
  if (!isPlainObject(placeholders)) {
    issues.push({ path: `${basePath}.placeholders`, message: "must be an object" });
  } else {
    for (const block of placeholderBlocks) {
      if (!(block.id in placeholders)) {
        issues.push({ path: `${basePath}.placeholders.${block.id}`, message: "is missing" });
      }
    }
    for (const [id, entry] of Object.entries(placeholders)) {
      const block = placeholderBlocks.find((candidate) => candidate.id === id);
      const entryPath = `${basePath}.placeholders.${id}`;
      if (!block) {
        issues.push({ path: entryPath, message: "unknown copy-placeholder ID" });
        continue;
      }
      if (!isPlainObject(entry)) {
        issues.push({ path: entryPath, message: "must be an object" });
        continue;
      }
      checkString(issues, `${entryPath}.prompt`, entry.prompt);
      const questionIds = block.questionIds ?? [];
      if (entry.questions !== undefined || questionIds.length > 0) {
        if (!isPlainObject(entry.questions)) {
          issues.push({ path: `${entryPath}.questions`, message: "must be an object" });
        } else {
          for (const questionId of questionIds) {
            if (!(questionId in entry.questions)) {
              issues.push({ path: `${entryPath}.questions.${questionId}`, message: "is missing" });
            }
          }
          for (const [questionId, question] of Object.entries(entry.questions)) {
            if (!questionIds.includes(questionId)) {
              issues.push({ path: `${entryPath}.questions.${questionId}`, message: "unknown question ID" });
              continue;
            }
            checkString(issues, `${entryPath}.questions.${questionId}`, question);
          }
        }
      }
    }
  }

  const visuals = value.visuals;
  if (!isPlainObject(visuals)) {
    issues.push({ path: `${basePath}.visuals`, message: "must be an object" });
  } else {
    for (const id of visualIds) {
      if (!(id in visuals)) {
        issues.push({ path: `${basePath}.visuals.${id}`, message: "is missing" });
      }
    }
    for (const [id, entry] of Object.entries(visuals)) {
      const block = visualBlocks.find((candidate) => candidate.id === id);
      const entryPath = `${basePath}.visuals.${id}`;
      if (!block) {
        issues.push({ path: entryPath, message: "unknown visual ID" });
        continue;
      }
      if (!isPlainObject(entry)) {
        issues.push({ path: entryPath, message: "must be an object" });
        continue;
      }
      checkString(issues, `${entryPath}.purpose`, entry.purpose);
      for (const field of ["alt", "caption"] as const) {
        if (entry[field] !== undefined) {
          checkString(issues, `${entryPath}.${field}`, entry[field]);
        }
      }
      if (block.slides || entry.slides !== undefined) {
        if (!Array.isArray(entry.slides)) {
          issues.push({ path: `${entryPath}.slides`, message: "must be an array" });
        } else if (!block.slides || entry.slides.length !== block.slides.length) {
          issues.push({ path: `${entryPath}.slides`, message: `must contain ${block.slides?.length ?? 0} slides` });
        } else {
          entry.slides.forEach((slide, slideIndex) => {
            const slidePath = `${entryPath}.slides.${slideIndex}`;
            const skeletonSlide = block.slides![slideIndex];
            if (!isPlainObject(slide)) {
              issues.push({ path: slidePath, message: "must be an object" });
              return;
            }
            checkString(issues, `${slidePath}.title`, slide.title);
            checkString(issues, `${slidePath}.caption`, slide.caption);
            if (!Array.isArray(slide.assets)) {
              issues.push({ path: `${slidePath}.assets`, message: "must be an array" });
            } else if (slide.assets.length !== skeletonSlide.assets.length) {
              issues.push({ path: `${slidePath}.assets`, message: `must contain ${skeletonSlide.assets.length} assets` });
            } else {
              slide.assets.forEach((asset, assetIndex) => {
                const assetPath = `${slidePath}.assets.${assetIndex}`;
                if (!isPlainObject(asset)) {
                  issues.push({ path: assetPath, message: "must be an object" });
                  return;
                }
                checkString(issues, `${assetPath}.alt`, asset.alt);
                if (asset.label !== undefined) {
                  checkString(issues, `${assetPath}.label`, asset.label);
                }
                for (const key of Object.keys(asset)) {
                  if (!["alt", "label"].includes(key)) {
                    issues.push({ path: `${assetPath}.${key}`, message: "unknown visual asset field" });
                  }
                }
              });
            }
            for (const key of Object.keys(slide)) {
              if (!["title", "caption", "assets"].includes(key)) {
                issues.push({ path: `${slidePath}.${key}`, message: "unknown visual slide field" });
              }
            }
          });
        }
      }
      for (const key of Object.keys(entry)) {
        if (!["purpose", "alt", "caption", "slides"].includes(key)) {
          issues.push({ path: `${entryPath}.${key}`, message: "unknown visual field" });
        }
      }
    }
  }
}

export function validatePortfolioContentDocument(
  input: unknown,
): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return [{ path: "", message: "content document must be an object" }];
  }
  if (input.version !== PORTFOLIO_CONTENT_VERSION) {
    issues.push({ path: "version", message: `must be ${PORTFOLIO_CONTENT_VERSION}` });
  }
  if (
    typeof input.revision !== "number" ||
    !Number.isInteger(input.revision) ||
    input.revision < 0
  ) {
    issues.push({ path: "revision", message: "must be a non-negative integer" });
  }

  const records = input.records;
  if (!isPlainObject(records)) {
    issues.push({ path: "records", message: "must be an object" });
  } else {
    for (const structure of portfolioRecordStructures) {
      const record = records[structure.id];
      const basePath = `records.${structure.id}`;
      if (!isPlainObject(record)) {
        issues.push({ path: basePath, message: "is missing" });
        continue;
      }
      checkString(issues, `${basePath}.label`, record.label);
      checkString(issues, `${basePath}.kind`, record.kind);
      checkString(issues, `${basePath}.summary`, record.summary);
      checkBodyText(issues, basePath, structure.body, record);
    }
    for (const id of Object.keys(records)) {
      if (!portfolioRecordStructures.some((structure) => structure.id === id)) {
        issues.push({ path: `records.${id}`, message: "unknown record ID" });
      }
    }
  }

  const threads = input.threads;
  if (!isPlainObject(threads)) {
    issues.push({ path: "threads", message: "must be an object" });
  } else {
    for (const structure of portfolioThreadStructures) {
      const thread = threads[structure.id];
      const basePath = `threads.${structure.id}`;
      if (!isPlainObject(thread)) {
        issues.push({ path: basePath, message: "is missing" });
        continue;
      }
      checkString(issues, `${basePath}.title`, thread.title);
      checkString(issues, `${basePath}.lede`, thread.lede);
      checkBodyText(issues, basePath, structure.body, thread);
    }
    for (const id of Object.keys(threads)) {
      if (!portfolioThreadStructures.some((structure) => structure.id === id)) {
        issues.push({ path: `threads.${id}`, message: "unknown thread ID" });
      }
    }
  }

  const contact = input.contact;
  if (!isPlainObject(contact)) {
    issues.push({ path: "contact", message: "must be an object" });
  } else {
    checkString(issues, "contact.email", contact.email);
    checkString(issues, "contact.cvLabel", contact.cvLabel);
    if (!isPlainObject(contact.socialLabels)) {
      issues.push({ path: "contact.socialLabels", message: "must be an object" });
    } else {
      for (const { key } of portfolioContactStructure.socials) {
        if (!(key in contact.socialLabels)) {
          issues.push({ path: `contact.socialLabels.${key}`, message: "is missing" });
        }
      }
      for (const [key, label] of Object.entries(contact.socialLabels)) {
        if (!portfolioContactStructure.socials.some((social) => social.key === key)) {
          issues.push({ path: `contact.socialLabels.${key}`, message: "unknown social key" });
          continue;
        }
        checkString(issues, `contact.socialLabels.${key}`, label);
      }
    }
  }

  const interfaceText = input.interface;
  if (!isPlainObject(interfaceText)) {
    issues.push({ path: "interface", message: "must be an object" });
  } else {
    for (const key of portfolioInterfaceTextKeys) {
      if (!(key in interfaceText)) {
        issues.push({ path: `interface.${key}`, message: "is missing" });
      }
    }
    for (const [key, value] of Object.entries(interfaceText)) {
      if (!(portfolioInterfaceTextKeys as readonly string[]).includes(key)) {
        issues.push({ path: `interface.${key}`, message: "unknown interface key" });
        continue;
      }
      checkString(issues, `interface.${key}`, value);
    }
  }

  return issues;
}

export function assertValidPortfolioContentDocument(
  input: unknown,
): asserts input is PortfolioContentDocument {
  const issues = validatePortfolioContentDocument(input);
  if (issues.length > 0) {
    const detail = issues
      .slice(0, 8)
      .map(({ path, message }) => `${path || "(document)"}: ${message}`)
      .join("; ");
    throw new Error(`Invalid portfolio content document — ${detail}`);
  }
}
