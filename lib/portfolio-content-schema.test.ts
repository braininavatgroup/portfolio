import { describe, expect, it } from "vitest";
import contentJson from "../content/portfolio-content.json";
import {
  assertValidPortfolioContentDocument,
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
      "index.section.threads",
      "index.section.background",
      "index.section.solutions",
      "index.section.products",
    ]);
  });

  it("rejects an inline link to a record or thread that does not exist", () => {
    const doc = document();
    doc.records.bradley.paragraphs.p1 =
      "See [this](record:nope) and [that](thread:missing) and [ok](record:dubs).";
    expect(validatePortfolioContentDocument(doc)).toEqual([
      expect.objectContaining({
        path: "records.bradley.paragraphs.p1",
        message: 'links to unknown record "nope"',
      }),
      expect.objectContaining({
        path: "records.bradley.paragraphs.p1",
        message: 'links to unknown thread "missing"',
      }),
    ]);
  });

  it("accepts an external https link without checking it against the structure", () => {
    const doc = document();
    doc.records.bradley.paragraphs.p1 =
      "More at [braininavat.dance](https://braininavat.dance/) and [ok](record:dubs).";
    expect(validatePortfolioContentDocument(doc)).toEqual([]);
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
    delete missing.interface["world.mast"];
    expect(validatePortfolioContentDocument(missing)).toContainEqual(
      expect.objectContaining({ path: "interface.world.mast" }),
    );
  });
});
