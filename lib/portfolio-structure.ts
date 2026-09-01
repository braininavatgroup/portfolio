// Structural skeleton for the portfolio world. Everything here is layout,
// identity, and relationship data: record and thread IDs, families, registers,
// map positions, body-block ordering, visual metadata, and link topology.
// Every user-facing string lives in content/portfolio-content.json and is
// merged in by lib/portfolio-world.ts. IDs, slugs, positions, and block order
// are not editable through the writing mode.

export type PortfolioWorldFamily =
  | "identity"
  | "story"
  | "formative"
  | "operation"
  | "component"
  | "personal"
  | "engagement"
  | "product";

export type PortfolioWorldRegister =
  | "identity"
  | "story"
  | "finding"
  | "warm"
  | "bridge"
  | "cool";

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
  assetSrcs?: readonly string[];
};

export type PortfolioBodyBlockSkeleton =
  | PortfolioParagraphSkeleton
  | PortfolioCopyPlaceholderSkeleton
  | PortfolioVisualSkeleton;

export type PortfolioWorldGroup =
  | "about"
  | "operations"
  | "campaign"
  | "personal"
  | "client"
  | "products"
  | "threads";

export type PortfolioRecordStructure = {
  id: string;
  family: PortfolioWorldFamily;
  register: PortfolioWorldRegister;
  group: PortfolioWorldGroup;
  position: { x: number; y: number };
  summaryStatus?: "placeholder";
  hasPrinciple: boolean;
  body: readonly PortfolioBodyBlockSkeleton[];
  projectSlug?: string;
  threadId?: string;
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
    family: "identity",
    register: "identity",
    group: "about",
    position: { x: 50, y: 12 },
    hasPrinciple: false,
    body: [para("p1"), para("p2"), para("p3"), plannedVisual("about-documentary", "artifact")],
  },
  {
    id: "infamous",
    family: "operation",
    register: "warm",
    group: "operations",
    position: { x: 15, y: 77 },
    hasPrinciple: false,
    body: [
      para("p1"),
      para("p2"),
      plannedVisual("infamous-service-evolution", "sequence", "recreate"),
    ],
  },
  {
    id: "music-practice",
    family: "operation",
    register: "warm",
    group: "operations",
    position: { x: 31, y: 85 },
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
    family: "operation",
    register: "warm",
    group: "operations",
    position: { x: 50, y: 87 },
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
    family: "operation",
    register: "warm",
    group: "operations",
    position: { x: 55, y: 61 },
    summaryStatus: "placeholder",
    hasPrinciple: false,
    body: [
      draft("product-studio-record", ["q1", "q2"]),
      plannedVisual("product-studio-relationship", "sequence", "recreate"),
    ],
  },
  {
    id: "kickoff",
    family: "component",
    register: "bridge",
    group: "campaign",
    position: { x: 80, y: 40 },
    hasPrinciple: true,
    body: [
      para("p1"),
      plannedVisual("kickoff-sequence", "comparison", "capture"),
      para("p2"),
      para("p3"),
    ],
    projectSlug: "kickoff-intake",
  },
  {
    id: "pitching",
    family: "component",
    register: "bridge",
    group: "campaign",
    position: { x: 88, y: 53 },
    hasPrinciple: true,
    body: [
      para("p1"),
      para("p2"),
      plannedVisual("pitching-targeting-model", "sequence", "recreate"),
      para("p3"),
    ],
    projectSlug: "pitching",
  },
  {
    id: "reporting",
    family: "component",
    register: "bridge",
    group: "campaign",
    position: { x: 76, y: 66 },
    hasPrinciple: true,
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      plannedVisual("reporting-pipeline", "sequence", "recreate"),
      para("p4"),
    ],
    projectSlug: "reporting",
  },
  {
    id: "real-estate",
    family: "engagement",
    register: "bridge",
    group: "client",
    position: { x: 68, y: 82 },
    hasPrinciple: true,
    body: [
      para("p1"),
      para("p2"),
      plannedVisual("real-estate-operation-map", "comparison", "recreate"),
      para("p3"),
    ],
    projectSlug: "real-estate-deal-tracker",
  },
  {
    id: "touring",
    family: "engagement",
    register: "bridge",
    group: "client",
    position: { x: 86, y: 73 },
    hasPrinciple: true,
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      plannedVisual("touring-field-registry", "sequence", "recreate"),
    ],
    projectSlug: "touring-advancing-tool",
  },
  {
    id: "personal-os",
    family: "personal",
    register: "bridge",
    group: "personal",
    position: { x: 44, y: 55 },
    hasPrinciple: true,
    body: [
      para("p1"),
      para("p2"),
      plannedVisual("personal-os-map", "sequence", "capture"),
      para("p3"),
    ],
    projectSlug: "personal-tooling",
  },
  {
    id: "dubs",
    family: "product",
    register: "cool",
    group: "products",
    position: { x: 21, y: 39 },
    hasPrinciple: true,
    body: [
      para("p1"),
      plannedVisual("dubs-loop", "demo", "capture"),
      para("p2"),
      para("p3"),
    ],
    projectSlug: "dubs",
  },
  {
    id: "writ",
    family: "product",
    register: "cool",
    group: "products",
    position: { x: 29, y: 53 },
    hasPrinciple: true,
    body: [
      para("p1"),
      plannedVisual("writ-priority-behavior", "annotation", "capture"),
      para("p2"),
      para("p3"),
    ],
    projectSlug: "three-maturity-bundle",
  },
  {
    id: "yoohoo",
    family: "product",
    register: "cool",
    group: "products",
    position: { x: 51, y: 72 },
    hasPrinciple: true,
    body: [
      para("p1"),
      plannedVisual("yoohoo-state", "sequence", "recreate"),
      para("p2"),
      para("p3"),
      para("p4"),
    ],
    projectSlug: "three-maturity-bundle",
  },
  {
    id: "thread-making-work-playable",
    threadId: "making-work-playable",
    family: "story",
    register: "story",
    group: "threads",
    position: { x: 36, y: 29 },
    hasPrinciple: false,
    body: [para("p1")],
  },
  {
    id: "thread-choosing-what-not-to-automate",
    threadId: "choosing-what-not-to-automate",
    family: "story",
    register: "story",
    group: "threads",
    position: { x: 65, y: 34 },
    hasPrinciple: false,
    body: [para("p1")],
  },
  {
    id: "thread-finding-myself-in-software",
    threadId: "finding-myself-in-software",
    family: "story",
    register: "finding",
    group: "threads",
    position: { x: 10, y: 57 },
    hasPrinciple: false,
    body: [para("p1")],
  },
] as const;

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
    members: ["personal-os", "dubs", "writ", "yoohoo"],
  },
  {
    id: "choosing-what-not-to-automate",
    nodeId: "thread-choosing-what-not-to-automate",
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      plannedVisual("thread-automation-boundaries", "comparison"),
      para("p4"),
      para("p5"),
      para("p6"),
    ],
    members: ["kickoff", "pitching", "reporting", "personal-os", "yoohoo"],
  },
  {
    id: "finding-myself-in-software",
    nodeId: "thread-finding-myself-in-software",
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      para("p4"),
      plannedVisual("thread-argument-to-instrument", "sequence"),
      para("p5"),
      para("p6"),
    ],
    members: [
      "infamous",
      "music-practice",
      "systems-consulting",
      "kickoff",
      "pitching",
      "reporting",
      "personal-os",
      "real-estate",
      "touring",
      "dubs",
      "writ",
      "yoohoo",
    ],
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
