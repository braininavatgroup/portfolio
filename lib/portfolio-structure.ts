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
  hasPrinciple: boolean;
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
    hasPrinciple: false,
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
    hasPrinciple: false,
    body: [
      para("p1"),
      para("p2"),
      plannedVisual("infamous-service-evolution", "sequence", "recreate"),
    ],
  },
  {
    id: "music-practice",
    outlineType: "where",
    family: "operation",
    register: "warm",
    position: { x: 25.41, y: 79.45, z: 822.3 },
    status: "active",
    summaryStatus: "placeholder",
    hasPrinciple: false,
    body: [
      draft("music-practice-introduction"),
      draft("music-practice-service-evolution"),
      plannedVisual("music-practice-evolution", "sequence"),
      para("p1"),
    ],
  },
  {
    id: "systems-consulting",
    outlineType: "where",
    family: "operation",
    register: "warm",
    position: { x: 47.11, y: 81.46, z: 882.3 },
    status: "active",
    hasPrinciple: true,
    body: [
      draft("consulting-opening"),
      para("p1"),
      plannedVisual("consulting-engagement-loop", "sequence", "recreate"),
      para("p2"),
      para("p3"),
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
    hasPrinciple: false,
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
    hasPrinciple: true,
    body: [
      para("p1"),
      plannedVisual("kickoff-sequence", "comparison", "capture"),
      para("p2"),
      para("p3"),
    ],
  },
  {
    id: "pitching",
    outlineType: "what",
    family: "component",
    register: "bridge",
    position: { x: 92.13, y: 54.87, z: 939.23 },
    hasPrinciple: true,
    body: [
      para("p1"),
      para("p2"),
      plannedVisual("pitching-targeting-model", "sequence", "recreate"),
      para("p3"),
    ],
  },
  {
    id: "reporting",
    outlineType: "what",
    family: "component",
    register: "bridge",
    position: { x: 70.78, y: 60.84, z: 902.14 },
    hasPrinciple: true,
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      plannedVisual("reporting-pipeline", "sequence", "recreate"),
      para("p4"),
    ],
  },
  {
    id: "real-estate",
    outlineType: "what",
    family: "engagement",
    register: "bridge",
    position: { x: 76.49, y: 82.38, z: 919.84 },
    hasPrinciple: true,
    body: [
      para("p1"),
      para("p2"),
      plannedVisual("real-estate-operation-map", "comparison", "recreate"),
      para("p3"),
    ],
  },
  {
    id: "touring",
    outlineType: "what",
    family: "engagement",
    register: "bridge",
    position: { x: 93.41, y: 72.24, z: 990.31 },
    hasPrinciple: true,
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      plannedVisual("touring-field-registry", "sequence", "recreate"),
    ],
  },
  {
    id: "dubs",
    outlineType: "what",
    family: "product",
    register: "cool",
    position: { x: 18.73, y: 41.17, z: 859.1 },
    hasPrinciple: true,
    body: [
      para("p1"),
      plannedVisual("dubs-loop", "demo", "capture"),
      para("p2"),
      para("p3"),
    ],
  },
  {
    id: "writ",
    outlineType: "what",
    family: "product",
    register: "cool",
    position: { x: 21.19, y: 55.82, z: 898.83 },
    hasPrinciple: true,
    body: [
      para("p1"),
      plannedVisual("writ-priority-behavior", "annotation", "capture"),
      para("p2"),
      para("p3"),
    ],
  },
  {
    id: "yoohoo",
    outlineType: "what",
    family: "product",
    register: "cool",
    position: { x: 52.43, y: 67.85, z: 881.72 },
    hasPrinciple: true,
    body: [
      para("p1"),
      plannedVisual("yoohoo-state", "sequence", "recreate"),
      para("p2"),
      para("p3"),
      para("p4"),
    ],
  },
  {
    id: "thread-making-work-playable",
    outlineType: "why",
    family: "story",
    register: "story",
    position: { x: 35.34, y: 32.79, z: 698.43 },
    hasPrinciple: false,
    body: [para("p1")],
  },
  {
    id: PORTFOLIO_ARC_NODE_ID,
    outlineType: "why",
    family: "story",
    register: "arc",
    position: { x: 11.29, y: 53.66, z: 721.38 },
    hasPrinciple: false,
    body: [para("p1")],
  },
  {
    id: "thread-authorship",
    outlineType: "why",
    family: "story",
    register: "story",
    position: { x: 63.3, y: 34.67, z: 719.72 },
    summaryStatus: "placeholder",
    hasPrinciple: false,
    body: [draft("authorship-record")],
  },
  {
    id: "thread-philosophy",
    outlineType: "why",
    family: "story",
    register: "story",
    position: { x: 34.29, y: 60.66, z: 797.65 },
    summaryStatus: "placeholder",
    hasPrinciple: false,
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
      para("p1"),
      para("p2"),
      plannedVisual("thread-playable-instruments", "sequence"),
      para("p3"),
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
      para("p1"),
      para("p2"),
      para("p3"),
      para("p4"),
      plannedVisual("thread-from-argument-to-instrument", "sequence"),
      para("p5"),
      para("p6"),
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
    body: [draft("philosophy-thread")],
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
