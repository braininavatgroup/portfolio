import test from "node:test";
import assert from "node:assert/strict";
import { mergeCatalog } from "./catalog.mjs";
const original = {
  id: "66",
  src: "/original.mp4",
  sha256: "old",
  kind: "video",
};
test("a published redaction remains linked to the original and is not imported as a new source", () => {
  const output = {
    id: "new",
    src: "/redacted.mp4",
    sha256: "rendered",
    kind: "video",
  };
  const result = mergeCatalog(
    [original],
    [output],
    [{ sourceHash: "old", src: output.src, sha256: output.sha256 }],
  );
  assert.deepEqual(result, [original]);
});
test("new source bytes get a separate entry while old annotations retain their source ID", () => {
  const replacement = { ...original, id: "replacement", sha256: "fresh" };
  assert.deepEqual(mergeCatalog([original], [replacement], []), [
    original,
    replacement,
  ]);
});
test("a repeat scan preserves existing IDs and does not duplicate assets", () => {
  assert.deepEqual(
    mergeCatalog([original], [{ ...original, id: "generated" }], []),
    [original],
  );
});

test("separate interactive visuals remain distinct without a source file", () => {
  const a = { id: "one", src: "", visualId: "first", kind: "interactive" };
  const b = { id: "two", src: "", visualId: "second", kind: "interactive" };
  assert.deepEqual(mergeCatalog([a], [b], []), [a, b]);
});
