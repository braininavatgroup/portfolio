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

export type PortfolioVisualFormat = "image" | "video" | "gallery" | "interactive";

export type PortfolioVisualPreview = "quarterly-dashboard";

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
  muxPlaybackId?: string;
  frameSrc?: string;
  captionsSrc?: string;
  poster?: string;
  preview?: PortfolioVisualPreview;
  href?: string;
  slides?: readonly PortfolioVisualSlideSkeleton[];
};

export type PortfolioVisualSlideSkeleton = {
  assets: readonly { src: string }[];
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

const readyGallery = (
  id: string,
  slides: readonly PortfolioVisualSlideSkeleton[],
): PortfolioVisualSkeleton => ({
  kind: "visual",
  id,
  status: "ready",
  treatment: "sequence",
  sourceStatus: "exists",
  format: "gallery",
  slides,
});

const readyInteractive = (
  id: string,
  preview: PortfolioVisualPreview,
  href: string,
): PortfolioVisualSkeleton => ({
  kind: "visual",
  id,
  status: "ready",
  treatment: "demo",
  sourceStatus: "exists",
  format: "interactive",
  preview,
  href,
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
    ],
  },
  {
    id: "infamous",
    outlineType: "where",
    family: "operation",
    register: "warm",
    position: { x: -3.77, y: 53.24, z: 860 },
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
    position: { x: -2.73, y: 63.03, z: 890 },
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
    position: { x: 40.83, y: 88.28, z: 920 },
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
    position: { x: 84.51, y: 79.99, z: 920 },
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
    position: { x: 2.66, y: 72.39, z: 920 },
    body: [
      draft("kickoff-rewrite", ["q1", "q2", "q3", "q4"]),
      {
        kind: "visual",
        id: "kickoff-sequence",
        status: "ready",
        treatment: "demo",
        sourceStatus: "exists",
        format: "video",
        src: "/visuals/campaign/campaign-kickoff-raw.mp4",
        muxPlaybackId: "D9YxmvvYr9qgleYmmupHYWsha9UHFCVIwarac64TemE",
        frameSrc: "/visuals/campaign/macbook-air-m5-13-midnight.png",
        captionsSrc: "/visuals/campaign/campaign-kickoff-captions.vtt",
        poster: "/visuals/campaign/campaign-kickoff-poster.png",
      },
    ],
  },
  {
    id: "pitching",
    outlineType: "what",
    family: "component",
    register: "bridge",
    position: { x: 14.1, y: 78.85, z: 860 },
    summaryStatus: "placeholder",
    body: [
      draft("pitching-rewrite", ["q1", "q2", "q3", "q4", "q5"]),
      {
        kind: "visual",
        id: "pitching-targeting-model",
        status: "ready",
        treatment: "demo",
        sourceStatus: "exists",
        format: "video",
        src: "/visuals/campaign/pitch-pipeline-raw.mp4",
        muxPlaybackId: "esIwLmxOp8y8pzsWy9WbJt00XY2cDVk1onTN6ooYosLI",
        frameSrc: "/visuals/campaign/macbook-air-m5-13-midnight.png",
        captionsSrc: "/visuals/campaign/pitch-pipeline-captions.vtt",
        poster: "/visuals/campaign/pitch-pipeline-poster.png",
      },
    ],
  },
  {
    id: "reporting",
    outlineType: "what",
    family: "component",
    register: "bridge",
    position: { x: 26.28, y: 84.77, z: 890 },
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      para("p4"),
      plannedVisual("reporting-pipeline", "sequence", "recreate"),
      para("p5"),
      para("p6"),
      para("p7"),
    ],
  },
  {
    id: "real-estate",
    outlineType: "what",
    family: "engagement",
    register: "bridge",
    position: { x: 56.21, y: 86.84, z: 860 },
    body: [
      draft("real-estate-rewrite", ["q1", "q2", "q3", "q4"]),
      readyInteractive(
        "real-estate-quarterly-dashboard",
        "quarterly-dashboard",
        "/demos/quarterly-dashboard",
      ),
    ],
  },
  {
    id: "touring",
    outlineType: "what",
    family: "engagement",
    register: "bridge",
    position: { x: 71.04, y: 84.77, z: 890 },
    body: [
      para("p1"),
      para("p2"),
      readyGallery("touring-field-registry", [
        {
          assets: [
            { src: "/visuals/touring/manager-advance.png" },
            { src: "/visuals/touring/promoter-form.png" },
            { src: "/visuals/touring/artist-dashboard.png" },
          ],
        },
        {
          assets: [
            { src: "/visuals/touring/day-sheet.png" },
          ],
        },
        {
          assets: [
            { src: "/visuals/touring/promoter-draft.png" },
          ],
        },
        {
          assets: [
            { src: "/visuals/touring/calendar-plan.png" },
          ],
        },
      ]),
      para("p3"),
      para("p4"),
    ],
  },
  {
    id: "dubs",
    outlineType: "what",
    family: "product",
    register: "cool",
    position: { x: 93.03, y: 71.52, z: 860 },
    summaryStatus: "placeholder",
    body: [
      draft("dubs-rewrite", ["q1", "q2", "q3", "q4"]),
      readyGallery("dubs-loop", [
        {
          assets: [
            { src: "/visuals/dubs/lock-screen.png" },
            { src: "/visuals/dubs/read-and-listen.png" },
            { src: "/visuals/dubs/inline-note.png" },
            { src: "/visuals/dubs/markup-in-context.png" },
          ],
        },
        {
          assets: [
            { src: "/visuals/dubs/library.png" },
            { src: "/visuals/dubs/tags.png" },
            { src: "/visuals/dubs/perspective.png" },
          ],
        },
        {
          assets: [
            { src: "/visuals/dubs/mcp.png" },
          ],
        },
      ]),
    ],
  },
  {
    id: "writ",
    outlineType: "what",
    family: "product",
    register: "cool",
    position: { x: 100.06, y: 63.03, z: 890 },
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
    position: { x: 103.06, y: 53.44, z: 920 },
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
    position: { x: 20.62, y: 43.99, z: 700 },
    body: [para("p1")],
  },
  {
    id: PORTFOLIO_ARC_NODE_ID,
    outlineType: "why",
    family: "story",
    register: "arc",
    position: { x: 38.83, y: 52.08, z: 700 },
    body: [para("p1")],
  },
  {
    id: "thread-authorship",
    outlineType: "why",
    family: "story",
    register: "story",
    position: { x: 58.82, y: 52.08, z: 700 },
    summaryStatus: "placeholder",
    body: [draft("authorship-record")],
  },
  {
    id: "thread-philosophy",
    outlineType: "why",
    family: "story",
    register: "story",
    position: { x: 77.04, y: 43.99, z: 700 },
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
