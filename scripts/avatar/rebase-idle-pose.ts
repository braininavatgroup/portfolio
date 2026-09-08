import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Quaternion } from "three";
import { makePoseDraft, parsePoseDraft, type PoseDraft } from "../../lib/avatar/pose-editor";
import { buildBradleyAvatar, idlePosePath } from "./build-bradley-avatar";

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** New editor offsets sit on top of the accepted pose, in the same local parent axes. */
export function rebaseIdlePose(previous: PoseDraft, currentModel: Buffer, downloadedText: string) {
  const edit = parsePoseDraft(downloadedText, sha256(currentModel));
  const combined = structuredClone(previous.offsets);
  for (const [name, rotation] of Object.entries(edit.offsets)) {
    combined[name] = new Quaternion(...rotation)
      .multiply(new Quaternion(...(previous.offsets[name] ?? [0, 0, 0, 1])))
      .normalize().toArray();
  }
  return makePoseDraft(previous.sourceSha256, combined);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = process.argv[2];
  const output = process.argv[3];
  if (!input || !output) throw new Error("Usage: tsx scripts/avatar/rebase-idle-pose.ts DOWNLOAD.json OUTPUT.json");
  const previousText = readFileSync(idlePosePath, "utf8");
  const previousHeader = JSON.parse(previousText) as { sourceSha256: string };
  const previous = parsePoseDraft(previousText, previousHeader.sourceSha256);
  const current = readFileSync("public/avatars/bradley-quiet-portrait.glb");
  const combined = rebaseIdlePose(previous, current, readFileSync(input, "utf8"));
  const directory = mkdtempSync(join(tmpdir(), "bradley-pose-rebase-"));
  try {
    // Prove this accepted draft produced the model the visitor edited. A stale
    // accepted file must not silently discard or double-apply previous edits.
    const proof = join(directory, "current.glb");
    buildBradleyAvatar(proof);
    if (sha256(readFileSync(proof)) !== sha256(current)) {
      throw new Error("The shipped avatar does not match the accepted pose. Reconcile it before importing another edit.");
    }
    writeFileSync(output, JSON.stringify(combined, null, 2) + "\n");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
