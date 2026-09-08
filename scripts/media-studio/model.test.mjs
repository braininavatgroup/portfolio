import test from "node:test";
import assert from "node:assert/strict";
import {
  validateProject,
  boxAt,
  upsertKeyframe,
  normalizedBox,
} from "./public/model.mjs";
const assets = [
  { id: "video", kind: "video", duration: 10 },
  { id: "still", kind: "image" },
];
const track = {
  id: "t",
  label: "Address",
  style: "blur",
  strength: 6,
  color: "#242424",
  scope: "follow",
  keyframes: [
    { time: 2, box: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 } },
    { time: 6, box: { x: 0.5, y: 0.2, w: 0.3, h: 0.1 } },
  ],
};
const project = () => ({
  version: 1,
  assets: {
    video: {
      status: "marked",
      notes: "",
      checkpoints: [0, 2, 6],
      tracks: [structuredClone(track)],
    },
  },
});
test("valid anchored selections survive validation", () =>
  assert.equal(
    validateProject(project(), assets).assets.video.tracks[0].label,
    "Address",
  ));
test("never previews an untracked position between follow-content anchors", () => {
  assert.equal(boxAt(track, 4), null);
  assert.deepEqual(boxAt(track, 2), track.keyframes[0].box);
});
test("fixed-area scope holds only in its chosen time range", () => {
  const fixed = { ...track, scope: "fixed", start: 2, end: 6 };
  assert.equal(boxAt(fixed, 1), null);
  assert.equal(boxAt(fixed, 7), null);
  assert.equal(boxAt(fixed, 4).x, 0.1);
});
test("updating a checkpoint replaces its anchor and preserves others", () => {
  const t = structuredClone(track);
  upsertKeyframe(t, 2, { x: 0, y: 0, w: 0.2, h: 0.2 });
  assert.equal(t.keyframes.length, 2);
  assert.equal(t.keyframes[0].box.x, 0);
});
test("rejects out-of-bounds, unknown media, and invalid treatments", () => {
  for (const mutate of [
    (p) => (p.assets.video.tracks[0].keyframes[0].box.x = 2),
    (p) => (p.assets.unknown = {}),
    (p) => (p.assets.video.tracks[0].style = "script"),
    (p) => (p.assets.video.tracks[0].keyframes[0].time = 11),
    (p) => (p.assets.video.tracks[0].strength = NaN),
  ]) {
    const p = project();
    mutate(p);
    assert.throws(() => validateProject(p, assets));
  }
});
test("rectangle drawing works in either direction and clips to source", () =>
  assert.deepEqual(normalizedBox({ x: 0.8, y: 0.7 }, { x: -0.1, y: 0.2 }), {
    x: 0,
    y: 0.2,
    w: 0.8,
    h: 0.49999999999999994,
  }));
test("source fingerprints reject coordinates authored against replaced media", () => {
  const p = project();
  p.assets.video.sourceHash = "old";
  assert.throws(
    () => validateProject(p, [{ ...assets[0], sha256: "new" }, assets[1]]),
    /source image or video changed/,
  );
});
test("reviewed checkpoints cannot refer beyond the recording", () => {
  const p = project();
  p.assets.video.reviewedCheckpoints = [11];
  assert.throws(() => validateProject(p, assets));
});
