// Structural skeleton for the portfolio world. Everything here is layout,
// identity, and relationship data: record and thread IDs, families, registers,
// map positions, body-block ordering, visual metadata, and link topology.
// Every user-facing string lives in content/portfolio-content.json and is
// merged in by lib/portfolio-world.ts. IDs, positions, and block order
// are not editable through the writing mode.

export type PortfolioWorldFamily =
  | "identity"
  | "story"
  | "operation"
  | "component"
  | "engagement"
  | "product";

export type PortfolioWorldRegister =
  | "identity"
  | "story"
  | "arc"
  | "warm"
  | "bridge"
  | "cool";

export type PortfolioRecordStatus = "active" | "past";
export type PortfolioOutlineType = "who" | "where" | "what" | "why";

export const PORTFOLIO_ARC_THREAD_ID = "from-argument-to-instrument";
export const PORTFOLIO_ARC_NODE_ID = "thread-from-argument-to-instrument";

export type PortfolioVisualTreatment =
  | "artifact"
  | "annotation"
  | "sequence"
  | "comparison"
  | "demo";

export type PortfolioVisualFormat = "image" | "video" | "gallery";

export type PortfolioVisualSourceStatus =
  | "exists"
  | "capture"
  | "redact"
  | "recreate"
  | "unknown";

export type PortfolioParagraphSkeleton = { kind: "paragraph"; id: string };

export type PortfolioCopyPlaceholderSkeleton = {
  kind: "copy-placeholder";
  id: string;
  questionIds?: readonly string[];
};

export type PortfolioVisualSkeleton = {
  kind: "visual";
  id: string;
  status: "planned" | "in-progress" | "ready";
  treatment?: PortfolioVisualTreatment;
  sourceStatus?: PortfolioVisualSourceStatus;
  format?: PortfolioVisualFormat;
  src?: string;
  captionsSrc?: string;
  poster?: string;
};

export type PortfolioBodyBlockSkeleton =
  | PortfolioParagraphSkeleton
  | PortfolioCopyPlaceholderSkeleton
  | PortfolioVisualSkeleton;

export type PortfolioRecordStructure = {
  id: string;
  family: PortfolioWorldFamily;
  register: PortfolioWorldRegister;
  outlineType: PortfolioOutlineType;
  position: { x: number; y: number; z: number };
  status?: PortfolioRecordStatus;
  summaryStatus?: "placeholder";
  body: readonly PortfolioBodyBlockSkeleton[];
};

export type PortfolioThreadStructure = {
  id: string;
  nodeId: string;
  body: readonly PortfolioBodyBlockSkeleton[];
  members: readonly string[];
};

const para = (id: string): PortfolioParagraphSkeleton => ({
  kind: "paragraph",
  id,
});

const draft = (
  id: string,
  questionIds?: readonly string[],
): PortfolioCopyPlaceholderSkeleton => ({
  kind: "copy-placeholder",
  id,
  ...(questionIds ? { questionIds } : {}),
});

const inferredVisualFormat = (
  treatment?: PortfolioVisualTreatment,
): PortfolioVisualFormat => {
  if (treatment === "demo") return "video";
  if (treatment === "sequence" || treatment === "comparison") return "gallery";
  return "image";
};

const plannedVisual = (
  id: string,
  treatment?: PortfolioVisualTreatment,
  sourceStatus: PortfolioVisualSourceStatus = "unknown",
  format: PortfolioVisualFormat = inferredVisualFormat(treatment),
): PortfolioVisualSkeleton => ({
  kind: "visual",
  id,
  status: "planned",
  ...(treatment ? { treatment } : {}),
  sourceStatus,
  format,
});

export const portfolioRecordStructures: readonly PortfolioRecordStructure[] = [
  {
    id: "bradley",
    outlineType: "who",
    family: "identity",
    register: "identity",
    position: { x: 48.88, y: 19.93, z: 646.71 },
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      para("p4"),
      plannedVisual("about-documentary", "artifact"),
    ],
  },
  {
    id: "infamous",
    outlineType: "where",
    family: "operation",
    register: "warm",
    position: { x: 9.34, y: 71.43, z: 762.31 },
    status: "past",
    body: [
      para("p1"),
      para("p2"),
      draft("infamous-early-days"),
      para("p3"),
      plannedVisual("infamous-service-evolution", "sequence", "recreate"),
      para("p4"),
    ],
  },
  {
    id: "music-practice",
    outlineType: "where",
    family: "operation",
    register: "warm",
    position: { x: 25.41, y: 79.45, z: 822.3 },
    status: "active",
    body: [
      para("p1"),
      plannedVisual("music-practice-clients", "artifact", "capture", "gallery"),
      para("p2"),
      para("p3"),
      para("p4"),
      para("p5"),
      para("p6"),
      para("p7"),
      para("p8"),
      para("p9"),
      para("p10"),
      draft("music-practice-automation", ["q1", "q2"]),
      para("p11"),
    ],
  },
  {
    id: "systems-consulting",
    outlineType: "where",
    family: "operation",
    register: "warm",
    position: { x: 47.11, y: 81.46, z: 882.3 },
    status: "active",
    body: [
      draft("consulting-bridge"),
      para("p1"),
      para("p2"),
      plannedVisual("consulting-engagement-loop", "sequence", "recreate"),
      para("p3"),
      para("p4"),
    ],
  },
  {
    id: "product-studio",
    outlineType: "where",
    family: "operation",
    register: "warm",
    position: { x: 53.6, y: 58.4, z: 812.3 },
    status: "active",
    summaryStatus: "placeholder",
    body: [
      draft("product-studio-record", ["q1", "q2"]),
      plannedVisual("product-studio-relationship", "sequence", "recreate"),
    ],
  },
  {
    id: "kickoff",
    outlineType: "what",
    family: "component",
    register: "bridge",
    position: { x: 81.31, y: 42.68, z: 838.89 },
    body: [
      draft("kickoff-rewrite", ["q1", "q2", "q3", "q4"]),
      plannedVisual("kickoff-sequence", "comparison", "capture"),
    ],
  },
  {
    id: "pitching",
    outlineType: "what",
    family: "component",
    register: "bridge",
    position: { x: 92.13, y: 54.87, z: 939.23 },
    summaryStatus: "placeholder",
    body: [
      draft("pitching-rewrite", ["q1", "q2", "q3", "q4", "q5"]),
      plannedVisual("pitching-targeting-model", "sequence", "recreate"),
    ],
  },
  {
    id: "reporting",
    outlineType: "what",
    family: "component",
    register: "bridge",
    position: { x: 70.78, y: 60.84, z: 902.14 },
    summaryStatus: "placeholder",
    body: [
      draft("reporting-rewrite", ["q1", "q2", "q3", "q4"]),
      plannedVisual("reporting-pipeline", "sequence", "recreate"),
    ],
  },
  {
    id: "real-estate",
    outlineType: "what",
    family: "engagement",
    register: "bridge",
    position: { x: 76.49, y: 82.38, z: 919.84 },
    body: [
      draft("real-estate-rewrite", ["q1", "q2", "q3", "q4"]),
      plannedVisual("real-estate-operation-map", "comparison", "recreate"),
    ],
  },
  {
    id: "touring",
    outlineType: "what",
    family: "engagement",
    register: "bridge",
    position: { x: 93.41, y: 72.24, z: 990.31 },
    summaryStatus: "placeholder",
    body: [
      draft("touring-rewrite", ["q1", "q2", "q3", "q4"]),
      plannedVisual("touring-field-registry", "sequence", "recreate"),
    ],
  },
  {
    id: "dubs",
    outlineType: "what",
    family: "product",
    register: "cool",
    position: { x: 18.73, y: 41.17, z: 859.1 },
    summaryStatus: "placeholder",
    body: [
      draft("dubs-rewrite", ["q1", "q2", "q3", "q4"]),
      plannedVisual("dubs-loop", "demo", "capture"),
    ],
  },
  {
    id: "writ",
    outlineType: "what",
    family: "product",
    register: "cool",
    position: { x: 21.19, y: 55.82, z: 898.83 },
    summaryStatus: "placeholder",
    body: [
      draft("writ-rewrite", ["q1", "q2", "q3", "q4"]),
      plannedVisual("writ-priority-behavior", "annotation", "capture"),
    ],
  },
  {
    id: "yoohoo",
    outlineType: "what",
    family: "product",
    register: "cool",
    position: { x: 52.43, y: 67.85, z: 881.72 },
    body: [
      draft("yoohoo-rewrite", ["q1", "q2", "q3", "q4"]),
      plannedVisual("yoohoo-state", "sequence", "recreate"),
    ],
  },
  {
    id: "thread-making-work-playable",
    outlineType: "why",
    family: "story",
    register: "story",
    position: { x: 35.34, y: 32.79, z: 698.43 },
    body: [para("p1")],
  },
  {
    id: PORTFOLIO_ARC_NODE_ID,
    outlineType: "why",
    family: "story",
    register: "arc",
    position: { x: 11.29, y: 53.66, z: 721.38 },
    body: [para("p1")],
  },
  {
    id: "thread-authorship",
    outlineType: "why",
    family: "story",
    register: "story",
    position: { x: 63.3, y: 34.67, z: 719.72 },
    summaryStatus: "placeholder",
    body: [draft("authorship-record")],
  },
  {
    id: "thread-philosophy",
    outlineType: "why",
    family: "story",
    register: "story",
    position: { x: 34.29, y: 60.66, z: 797.65 },
    summaryStatus: "placeholder",
    body: [draft("philosophy-record")],
  },
] as const;

export type PortfolioFactualLinkStructure = {
  from: string;
  to: string;
  type: "direct" | "lineage";
};

export const portfolioFactualLinkStructures = [
  { from: "infamous", to: "music-practice", type: "lineage" },
  { from: "music-practice", to: "kickoff", type: "direct" },
  { from: "music-practice", to: "pitching", type: "direct" },
  { from: "music-practice", to: "reporting", type: "direct" },
  { from: "systems-consulting", to: "real-estate", type: "direct" },
  { from: "systems-consulting", to: "touring", type: "direct" },
  { from: "product-studio", to: "dubs", type: "direct" },
  { from: "product-studio", to: "writ", type: "direct" },
  { from: "product-studio", to: "yoohoo", type: "direct" },
  { from: "kickoff", to: "pitching", type: "direct" },
  { from: "pitching", to: "reporting", type: "direct" },
] as const satisfies readonly PortfolioFactualLinkStructure[];

export const portfolioThreadStructures: readonly PortfolioThreadStructure[] = [
  {
    id: "making-work-playable",
    nodeId: "thread-making-work-playable",
    body: [
      draft("playable-rewrite", ["q1", "q2", "q3"]),
      plannedVisual("thread-playable-instruments", "sequence"),
    ],
    members: [
      "kickoff",
      "pitching",
      "reporting",
      "real-estate",
      "touring",
      "dubs",
      "writ",
      "yoohoo",
    ],
  },
  {
    id: PORTFOLIO_ARC_THREAD_ID,
    nodeId: PORTFOLIO_ARC_NODE_ID,
    body: [
      draft("argument-rewrite", ["q1", "q2", "q3", "q4", "q5", "q6"]),
      plannedVisual("thread-from-argument-to-instrument", "sequence"),
    ],
    members: [
      "thread-philosophy",
      "thread-making-work-playable",
      "thread-authorship",
    ],
  },
  {
    id: "authorship",
    nodeId: "thread-authorship",
    body: [draft("authorship-thread")],
    members: [
      "music-practice",
      "systems-consulting",
      "product-studio",
      "kickoff",
      "pitching",
      "reporting",
      "real-estate",
      "touring",
      "dubs",
      "writ",
      "yoohoo",
    ],
  },
  {
    id: "philosophy",
    nodeId: "thread-philosophy",
    body: [draft("philosophy-thread", ["q1", "q2", "q3"])],
    members: ["pitching", "reporting", "real-estate", "touring", "writ"],
  },
] as const;

export const portfolioContactStructure = {
  cvHref: "/cv/bradley-berkman-cv.pdf",
  socials: [
    { key: "linkedin", href: "https://www.linkedin.com/in/bradleyberkman/" },
    { key: "github", href: "https://github.com/bradleybiav" },
    { key: "instagram", href: "https://www.instagram.com/bradley_berkman/" },
  ],
} as const;
