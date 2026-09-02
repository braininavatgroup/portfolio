import { describe, expect, it } from "vitest";
import contentJson from "../content/portfolio-content.json";
import {
  applyContentEdit,
  assertValidPortfolioContentDocument,
  isMultiLineContentPath,
  normalizeContentValue,
  resolveContentPath,
  portfolioInterfaceTextKeys,
  SINGLE_LINE_MAX_LENGTH,
  validatePortfolioContentDocument,
  type PortfolioContentDocument,
} from "./portfolio-content-schema";

function document(): PortfolioContentDocument {
  const doc = structuredClone(contentJson) as unknown;
  assertValidPortfolioContentDocument(doc);
  return doc;
}

describe("validatePortfolioContentDocument", () => {
  it("accepts the canonical content document", () => {
    expect(validatePortfolioContentDocument(contentJson)).toEqual([]);
    expect(
      portfolioInterfaceTextKeys.filter((key) => key.startsWith("index.section.")),
    ).toEqual([
      "index.section.about",
      "index.section.threads",
      "index.section.operations",
      "index.section.campaign",
      "index.section.client",
      "index.section.products",
    ]);
  });

  it("rejects unknown record IDs", () => {
    const doc = document();
    (doc.records as Record<string, unknown>).impostor = doc.records.bradley;
    expect(validatePortfolioContentDocument(doc)).toContainEqual(
      expect.objectContaining({ path: "records.impostor" }),
    );
  });

  it("rejects a document missing a required live record", () => {
    const doc = document();
    delete (doc.records as Record<string, unknown>).dubs;
    expect(validatePortfolioContentDocument(doc)).toContainEqual(
      expect.objectContaining({ path: "records.dubs" }),
    );
  });

  it("rejects a document missing a required live thread", () => {
    const doc = document();
    delete (doc.threads as Record<string, unknown>)["making-work-playable"];
    expect(validatePortfolioContentDocument(doc)).toContainEqual(
      expect.objectContaining({ path: "threads.making-work-playable" }),
    );
  });

  it("rejects unknown paragraph IDs", () => {
    const doc = document();
    doc.records.bradley.paragraphs.p99 = "stray";
    expect(validatePortfolioContentDocument(doc)).toContainEqual(
      expect.objectContaining({ path: "records.bradley.paragraphs.p99" }),
    );
  });

  it("rejects non-string values", () => {
    const doc = document();
    (doc.records.bradley as Record<string, unknown>).summary = 42;
    expect(validatePortfolioContentDocument(doc)).toContainEqual(
      expect.objectContaining({ path: "records.bradley.summary" }),
    );
  });

  it("rejects values over the documented size limit", () => {
    const doc = document();
    doc.records.bradley.label = "x".repeat(SINGLE_LINE_MAX_LENGTH + 1);
    expect(validatePortfolioContentDocument(doc)).toContainEqual(
      expect.objectContaining({ path: "records.bradley.label" }),
    );
  });

  it("rejects unknown interface keys and missing interface keys", () => {
    const doc = document();
    doc.interface["not.a.key"] = "hello";
    expect(validatePortfolioContentDocument(doc)).toContainEqual(
      expect.objectContaining({ path: "interface.not.a.key" }),
    );
    const missing = document();
    delete missing.interface["world.hint"];
    expect(validatePortfolioContentDocument(missing)).toContainEqual(
      expect.objectContaining({ path: "interface.world.hint" }),
    );
  });
});

describe("resolveContentPath", () => {
  it("resolves record, thread, contact, and interface paths", () => {
    const doc = document();
    expect(resolveContentPath("records.bradley.summary")?.read(doc)).toBe(
      doc.records.bradley.summary,
    );
    expect(resolveContentPath("records.bradley.paragraphs.p1")?.read(doc)).toBe(
      doc.records.bradley.paragraphs.p1,
    );
    expect(
      resolveContentPath(
        "records.product-studio.placeholders.product-studio-record.questions.q1",
      )?.read(doc),
    ).toBe(doc.records["product-studio"].placeholders["product-studio-record"].questions?.q1);
    expect(
      resolveContentPath("threads.making-work-playable.title")?.read(doc),
    ).toBe(doc.threads["making-work-playable"].title);
    expect(resolveContentPath("contact.socialLabels.github")?.read(doc)).toBe(
      "GitHub",
    );
    expect(resolveContentPath("interface.world.hint")?.read(doc)).toBe(
      doc.interface["world.hint"],
    );
  });

  it("rejects structural and unknown paths", () => {
    expect(resolveContentPath("records.bradley.position")).toBeNull();
    expect(resolveContentPath("records.bradley.family")).toBeNull();
    expect(resolveContentPath("records.bradley.outlineType")).toBeNull();
    expect(resolveContentPath("records.nope.summary")).toBeNull();
    expect(resolveContentPath("records.bradley.paragraphs.p9")).toBeNull();
    expect(resolveContentPath("records.bradley.principle")).toBeNull();
    expect(resolveContentPath("threads.making-work-playable.members")).toBeNull();
    expect(resolveContentPath("interface.unknown.key")).toBeNull();
    expect(resolveContentPath("revision")).toBeNull();
    expect(resolveContentPath("")).toBeNull();
  });
});

describe("applyContentEdit", () => {
  it("applies a valid edit and bumps the revision", () => {
    const doc = document();
    const result = applyContentEdit(doc, {
      path: "records.bradley.summary",
      value: "A fresh summary.",
      revision: doc.revision,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.records.bradley.summary).toBe("A fresh summary.");
    expect(result.document.revision).toBe(doc.revision + 1);
    // Original document untouched.
    expect(doc.records.bradley.summary).not.toBe("A fresh summary.");
  });

  it("treats an identical value as a no-op that keeps the revision", () => {
    const doc = document();
    const result = applyContentEdit(doc, {
      path: "records.bradley.summary",
      value: doc.records.bradley.summary,
      revision: doc.revision,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.unchanged).toBe(true);
    expect(result.document.revision).toBe(doc.revision);
  });

  it("rejects an edit based on an old revision without applying it", () => {
    const doc = document();
    const result = applyContentEdit(doc, {
      path: "records.bradley.summary",
      value: "stale write",
      revision: doc.revision - 1,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "stale-revision",
      currentRevision: doc.revision,
    });
  });

  it("rejects structural paths and non-string values", () => {
    const doc = document();
    expect(
      applyContentEdit(doc, {
        path: "records.bradley.position",
        value: "x",
        revision: doc.revision,
      }),
    ).toMatchObject({ ok: false, code: "invalid-path" });
    expect(
      applyContentEdit(doc, {
        path: "records.bradley.summary",
        value: 12 as unknown as string,
        revision: doc.revision,
      }),
    ).toMatchObject({ ok: false, code: "invalid-value" });
  });

  it("strips line breaks from single-line fields and keeps them in paragraphs", () => {
    const doc = document();
    const label = applyContentEdit(doc, {
      path: "records.bradley.label",
      value: "Bradley\nBerkman",
      revision: doc.revision,
    });
    expect(label.ok && label.document.records.bradley.label).toBe(
      "Bradley Berkman",
    );
    const paragraph = applyContentEdit(doc, {
      path: "records.bradley.paragraphs.p1",
      value: "line one\nline two",
      revision: doc.revision,
    });
    expect(paragraph.ok && paragraph.document.records.bradley.paragraphs.p1).toBe(
      "line one\nline two",
    );
  });
});

describe("normalization helpers", () => {
  it("classifies multi-line paths", () => {
    expect(isMultiLineContentPath("records.bradley.paragraphs.p1")).toBe(true);
    expect(isMultiLineContentPath("threads.making-work-playable.paragraphs.p2")).toBe(true);
    expect(isMultiLineContentPath("interface.privacy.p1")).toBe(true);
    expect(isMultiLineContentPath("records.bradley.label")).toBe(false);
    expect(isMultiLineContentPath("interface.world.hint")).toBe(false);
  });

  it("normalizes carriage returns", () => {
    expect(normalizeContentValue("records.bradley.paragraphs.p1", "a\r\nb")).toBe("a\nb");
    expect(normalizeContentValue("records.bradley.label", "a\r\nb")).toBe("a b");
  });
});
