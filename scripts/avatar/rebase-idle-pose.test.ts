import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Quaternion } from "three";
import { applySavedIdlePose } from "./apply-idle-pose";
import { rebaseIdlePose } from "./rebase-idle-pose";
import { appendFloatAccessor, parseGlb, readFloatAccessor, writeGlb, type ParsedGlb } from "./glb";

it("rebases a second editor download so rebuilding preserves both rounds of edits", () => {
  const glb: ParsedGlb = { binary: Buffer.alloc(0), json: { nodes: [{name:"Head"}], meshes:[], buffers:[], accessors:[], bufferViews:[] } };
  const input=appendFloatAccessor(glb,new Float32Array([0,1]),"SCALAR",true);
  const output=appendFloatAccessor(glb,new Float32Array([0,0,0,1, 0,0,Math.SQRT1_2,Math.SQRT1_2]),"VEC4");
  glb.json.animations=[{name:"Idle",channels:[{sampler:0,target:{node:0,path:"rotation"}}],samplers:[{input,output}]}];
  const source=writeGlb(glb);
  const first={version:1 as const,clip:"Idle" as const,sourceSha256:createHash("sha256").update(source).digest("hex"),offsets:{Head:[0,Math.SQRT1_2,0,Math.SQRT1_2] as [number,number,number,number]}};
  const shipped=applySavedIdlePose(source,JSON.stringify(first));
  const next={...first,sourceSha256:createHash("sha256").update(shipped).digest("hex"),offsets:{Head:[Math.SQRT1_2,0,0,Math.SQRT1_2]}};
  const rebased=rebaseIdlePose(first,shipped,JSON.stringify(next));
  expect(rebased.sourceSha256).toBe(first.sourceSha256);
  expect(rebased.offsets.Head).toEqual([0.5,0.5,0.5,0.5]);
  const rebuilt=parseGlb(applySavedIdlePose(source,JSON.stringify(rebased)));
  const preview=parseGlb(applySavedIdlePose(shipped,JSON.stringify(next)));
  function keys(g:ParsedGlb){const a=g.json.animations![0]!;return readFloatAccessor(g,a.samplers[a.channels[0]!.sampler]!.output);}
  const a=keys(rebuilt),b=keys(preview);
  for(let i=0;i<a.length;i+=4)expect(new Quaternion().fromArray(a,i).normalize().angleTo(new Quaternion().fromArray(b,i).normalize())).toBeLessThan(1e-6);
});

describe("pose rebase validation", () => {
  it("preserves unedited joints and rejects a download for another shipped model", () => {
    const current=Buffer.from("current avatar");
    const first={version:1 as const,clip:"Idle" as const,sourceSha256:"a".repeat(64),offsets:{LeftHand:[0,0,0,1] as [number,number,number,number]}};
    const next={version:1,clip:"Idle",sourceSha256:createHash("sha256").update(current).digest("hex"),offsets:{Head:[0,0,0,1]}};
    expect(rebaseIdlePose(first,current,JSON.stringify(next)).offsets.LeftHand).toEqual(first.offsets.LeftHand);
    expect(() => rebaseIdlePose(first,Buffer.from("other"),JSON.stringify(next))).toThrow(/different avatar/);
  });
});
