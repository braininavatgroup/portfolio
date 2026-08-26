import { describe, expect, it } from "vitest";
import { classifyPose, poseReply } from "./pose";

describe("deterministic portfolio pose events", () => {
  it.each([
    ["How did the curator matching work?", "music"],
    ["Show me the reporting workflow", "music"],
    ["How do you model an ambiguous process?", "systems"],
    ["Which app did you ship?", "building"],
    ["Where does judgment stay human?", "thinking"],
    ["Tell me about Bradley's background", "listening"],
    ["   ", "idle"],
  ])("classifies %s as %s", (input, expected) => {
    expect(classifyPose(input)).toBe(expected);
  });

  it("recognizes Writ without preserving the superseded Rit name", () => {
    expect(classifyPose("What is Writ?")).toBe("building");
    expect(classifyPose("What is Rit?")).toBe("listening");
  });

  it("returns a local navigation suggestion without impersonating Bradley", () => {
    const reply = poseReply("How does pitching work?", "music");
    expect(reply.text).toMatch(/pitching/i);
    expect(reply.href).toBe("/index/pitching");
    expect(reply.text).not.toMatch(/I am Bradley|I'm Bradley/i);
  });
});
