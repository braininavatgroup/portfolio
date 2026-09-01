// Canonical schema for content/portfolio-content.json — the single store for
// every editable user-facing string on the public portfolio. This module owns
// document validation, the stable content-path grammar, and edit application.
// It has no browser, filesystem, or Git dependency so both the running app and
// the local writing endpoint validate with the same code.
//
// Stable content paths:
//   records.<recordId>.label|kind|summary|principle
//   records.<recordId>.paragraphs.<paragraphId>
//   records.<recordId>.placeholders.<blockId>.prompt
//   records.<recordId>.placeholders.<blockId>.questions.<questionId>
//   records.<recordId>.visuals.<blockId>.purpose|alt|caption
//   threads.<threadId>.title|lede
//   threads.<threadId>.paragraphs.<paragraphId>
//   threads.<threadId>.visuals.<blockId>.purpose|alt|caption
//   contact.email|cvLabel
//   contact.socialLabels.<socialKey>
//   interface.<catalogKey>

import {
  portfolioContactStructure,
  portfolioRecordStructures,
  portfolioThreadStructures,
  type PortfolioBodyBlockSkeleton,
} from "./portfolio-structure";

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
  visuals: Record<string, { purpose: string; alt?: string; caption?: string }>;
};

export type PortfolioContentRecord = PortfolioContentBodyText & {
  label: string;
  kind: string;
  summary: string;
  principle?: string;
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
  "header.wordmark",
  "header.mapLink",
  "hero.throughline",
  "world.mast",
  "world.hint",
  "visualStage.eyebrow",
  "reader.indexTitle",
  "reader.backButton",
  "reader.threadLabel",
  "reader.exploreThread",
  "reader.contactTitle",
  "reader.threadsTitle",
  "reader.relatedTitle",
  "reader.copyInProgress",
  "reader.privacyLink",
  "index.section.about",
  "index.section.threads",
  "index.section.operations",
  "index.section.campaign",
  "index.section.client",
  "index.section.personal",
  "index.section.products",
  "indexPage.threadsSubtitle",
  "chat.title",
  "chat.backButton",
  "chat.composerPlaceholder",
  "chat.pendingStatus",
  "chat.unavailable",
  "chat.verificationPreparing",
  "chat.verificationUnavailable",
  "chat.verificationRequired",
  "privacy.backLink",
  "privacy.title",
  "privacy.p1",
  "privacy.p2",
  "privacy.p3",
  "privacy.questionsPrefix",
  "privacy.enableAnalytics",
  "privacy.optOutAnalytics",
  "toybox.eyebrow",
  "toybox.title",
  "toybox.returning",
  "toybox.tossHint",
  "toybox.chooseHint",
  "toybox.closeButton",
  "toybox.chooserPrompt",
  "toybox.brainFoodTitle",
  "toybox.brainFoodDescription",
  "toybox.tossTitle",
  "toybox.tossDescription",
  "toybox.tossEyebrow",
  "toybox.brainFoodEyebrow",
  "toybox.tossResult",
  "toybox.resultReturning",
] as const;

export type PortfolioInterfaceTextKey =
  (typeof portfolioInterfaceTextKeys)[number];

// Paths that accept embedded line breaks. Everything else is single-line and
// line breaks are stripped on write.
const MULTI_LINE_PATH_PATTERN = /^(records|threads)\.[^.]+\.paragraphs\.[^.]+$/;
const MULTI_LINE_INTERFACE_KEYS = new Set([
  "privacy.p1",
  "privacy.p2",
  "privacy.p3",
]);

export function isMultiLineContentPath(path: string): boolean {
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
  const visualIds = body.flatMap((block) =>
    block.kind === "visual" ? [block.id] : [],
  );

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
      const entryPath = `${basePath}.visuals.${id}`;
      if (!visualIds.includes(id)) {
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
      for (const key of Object.keys(entry)) {
        if (!["purpose", "alt", "caption"].includes(key)) {
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
      if (structure.hasPrinciple) {
        checkString(issues, `${basePath}.principle`, record.principle);
      } else if (record.principle !== undefined) {
        issues.push({ path: `${basePath}.principle`, message: "record has no principle field" });
      }
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

// ---------------------------------------------------------------------------
// Content-path resolution and edit application.

type ResolvedContentPath = {
  read: (doc: PortfolioContentDocument) => string | undefined;
  write: (doc: PortfolioContentDocument, value: string) => void;
};

function resolveBodyTextPath(
  body: readonly PortfolioBodyBlockSkeleton[],
  segments: readonly string[],
  container: (doc: PortfolioContentDocument) => PortfolioContentBodyText,
): ResolvedContentPath | null {
  const [section, id, field, subId] = segments;
  if (section === "paragraphs" && id && field === undefined) {
    if (!body.some((block) => block.kind === "paragraph" && block.id === id)) {
      return null;
    }
    return {
      read: (doc) => container(doc).paragraphs[id],
      write: (doc, value) => {
        container(doc).paragraphs[id] = value;
      },
    };
  }
  if (section === "placeholders" && id) {
    const block = body.find(
      (candidate) => candidate.kind === "copy-placeholder" && candidate.id === id,
    );
    if (!block || block.kind !== "copy-placeholder") return null;
    if (field === "prompt" && subId === undefined) {
      return {
        read: (doc) => container(doc).placeholders[id]?.prompt,
        write: (doc, value) => {
          container(doc).placeholders[id].prompt = value;
        },
      };
    }
    if (field === "questions" && subId && block.questionIds?.includes(subId)) {
      return {
        read: (doc) => container(doc).placeholders[id]?.questions?.[subId],
        write: (doc, value) => {
          const entry = container(doc).placeholders[id];
          entry.questions = { ...entry.questions, [subId]: value };
        },
      };
    }
    return null;
  }
  if (section === "visuals" && id && field && subId === undefined) {
    if (!body.some((block) => block.kind === "visual" && block.id === id)) {
      return null;
    }
    if (!["purpose", "alt", "caption"].includes(field)) return null;
    return {
      read: (doc) => container(doc).visuals[id]?.[field as "purpose" | "alt" | "caption"],
      write: (doc, value) => {
        container(doc).visuals[id][field as "purpose" | "alt" | "caption"] = value;
      },
    };
  }
  return null;
}

export function resolveContentPath(path: string): ResolvedContentPath | null {
  if (path.startsWith("interface.")) {
    const key = path.slice("interface.".length);
    if (!(portfolioInterfaceTextKeys as readonly string[]).includes(key)) {
      return null;
    }
    return {
      read: (doc) => doc.interface[key],
      write: (doc, value) => {
        doc.interface[key] = value;
      },
    };
  }

  const segments = path.split(".");
  const [root, id, ...rest] = segments;

  if (root === "records" && id) {
    const structure = portfolioRecordStructures.find(
      (candidate) => candidate.id === id,
    );
    if (!structure) return null;
    const [field] = rest;
    if (rest.length === 1 && ["label", "kind", "summary"].includes(field)) {
      return {
        read: (doc) => doc.records[id]?.[field as "label" | "kind" | "summary"],
        write: (doc, value) => {
          doc.records[id][field as "label" | "kind" | "summary"] = value;
        },
      };
    }
    if (rest.length === 1 && field === "principle" && structure.hasPrinciple) {
      return {
        read: (doc) => doc.records[id]?.principle,
        write: (doc, value) => {
          doc.records[id].principle = value;
        },
      };
    }
    return resolveBodyTextPath(structure.body, rest, (doc) => doc.records[id]);
  }

  if (root === "threads" && id) {
    const structure = portfolioThreadStructures.find(
      (candidate) => candidate.id === id,
    );
    if (!structure) return null;
    const [field] = rest;
    if (rest.length === 1 && ["title", "lede"].includes(field)) {
      return {
        read: (doc) => doc.threads[id]?.[field as "title" | "lede"],
        write: (doc, value) => {
          doc.threads[id][field as "title" | "lede"] = value;
        },
      };
    }
    return resolveBodyTextPath(structure.body, rest, (doc) => doc.threads[id]);
  }

  if (root === "contact") {
    if (segments.length === 2 && ["email", "cvLabel"].includes(id)) {
      return {
        read: (doc) => doc.contact[id as "email" | "cvLabel"],
        write: (doc, value) => {
          doc.contact[id as "email" | "cvLabel"] = value;
        },
      };
    }
    if (
      segments.length === 3 &&
      id === "socialLabels" &&
      portfolioContactStructure.socials.some((social) => social.key === rest[0])
    ) {
      const key = rest[0];
      return {
        read: (doc) => doc.contact.socialLabels[key],
        write: (doc, value) => {
          doc.contact.socialLabels[key] = value;
        },
      };
    }
  }

  return null;
}

export function normalizeContentValue(path: string, value: string): string {
  let normalized = value.replace(/\r\n?/g, "\n");
  if (!isMultiLineContentPath(path)) {
    normalized = normalized.replace(/\n+/g, " ");
  }
  return normalized;
}

export type ContentEditResult =
  | { ok: true; document: PortfolioContentDocument }
  | {
      ok: false;
      code: "invalid-path" | "invalid-value" | "stale-revision";
      message: string;
      currentRevision?: number;
    };

export function applyContentEdit(
  document: PortfolioContentDocument,
  edit: { path: unknown; value: unknown; revision: unknown },
): ContentEditResult {
  if (typeof edit.path !== "string" || edit.path.length === 0) {
    return { ok: false, code: "invalid-path", message: "content path must be a string" };
  }
  const resolved = resolveContentPath(edit.path);
  if (!resolved) {
    return {
      ok: false,
      code: "invalid-path",
      message: `unknown or structural content path: ${edit.path}`,
    };
  }
  if (typeof edit.value !== "string") {
    return { ok: false, code: "invalid-value", message: "value must be a plain string" };
  }
  if (typeof edit.revision !== "number" || edit.revision !== document.revision) {
    return {
      ok: false,
      code: "stale-revision",
      message: "edit is based on an old content revision",
      currentRevision: document.revision,
    };
  }
  const value = normalizeContentValue(edit.path, edit.value);
  const limit = isMultiLineContentPath(edit.path)
    ? MULTI_LINE_MAX_LENGTH
    : SINGLE_LINE_MAX_LENGTH;
  if (value.length > limit) {
    return {
      ok: false,
      code: "invalid-value",
      message: `value exceeds the ${limit} character limit`,
    };
  }
  // eslint-disable-next-line no-control-regex -- rejecting raw control characters is the point
  if (/[\u0000-\u0008\u000B-\u001F\u007F]/.test(value)) {
    return {
      ok: false,
      code: "invalid-value",
      message: "value must not contain control characters",
    };
  }

  const next = structuredClone(document);
  resolved.write(next, value);
  next.revision = document.revision + 1;
  const issues = validatePortfolioContentDocument(next);
  if (issues.length > 0) {
    return {
      ok: false,
      code: "invalid-value",
      message: `edit produces an invalid document: ${issues[0].path}: ${issues[0].message}`,
    };
  }
  return { ok: true, document: next };
}
