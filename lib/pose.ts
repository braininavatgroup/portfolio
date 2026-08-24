import type { PoseState } from "../components/scene/BodyScene";

export type PoseReply = {
  text: string;
  href: string;
  linkLabel: string;
};

const keywordGroups: Array<{ pose: PoseState; words: string[] }> = [
  {
    pose: "music",
    words: ["music", "campaign", "curator", "pitch", "report", "artist", "submithub"],
  },
  {
    pose: "systems",
    words: ["system", "workflow", "process", "operation", "automation", "schema", "handoff"],
  },
  {
    pose: "building",
    words: ["build", "built", "app", "code", "development", "ship", "rit", "dubs"],
  },
  {
    pose: "thinking",
    words: ["judgment", "think", "philosophy", "decide", "decision", "why", "spec", "human"],
  },
];

export function classifyPose(input: string): PoseState {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return "idle";
  for (const group of keywordGroups) {
    if (group.words.some((word) => normalized.includes(word))) return group.pose;
  }
  return "listening";
}

const replies: Record<Exclude<PoseState, "idle">, PoseReply> = {
  music: {
    text: "The pitching chain is the clearest place to see taste modeled without removing the human approval step.",
    href: "/index/pitching",
    linkLabel: "Open the pitching chain",
  },
  systems: {
    text: "The real-estate deal tracker shows an ambiguous process translated into a schema inside familiar tools.",
    href: "/index/real-estate-deal-tracker",
    linkLabel: "Open the deal-tracker chain",
  },
  building: {
    text: "The three-maturity bundle separates what shipped, what was specified, and what remains a sketch.",
    href: "/index/three-maturity-bundle",
    linkLabel: "Open the development bundle",
  },
  thinking: {
    text: "The spec-discipline chain shows where product judgment becomes a contract another agent can execute and review.",
    href: "/index/spec-discipline",
    linkLabel: "Open the spec record",
  },
  listening: {
    text: "The work directory is the fastest overview of the music, consulting, and development projects.",
    href: "/index",
    linkLabel: "Browse all work",
  },
};

export function poseReply(input: string, pose = classifyPose(input)): PoseReply {
  if (pose === "idle") return replies.listening;
  return replies[pose];
}
