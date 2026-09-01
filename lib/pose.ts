export type PoseState =
  | "idle"
  | "listening"
  | "music"
  | "systems"
  | "building"
  | "thinking";

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
    words: ["build", "built", "app", "code", "development", "ship", "writ", "dubs"],
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

