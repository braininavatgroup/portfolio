// Authored site content lives here (and in lib/portfolio-private-grounding.ts
// for chat-only facts). A "node" is a dot on the map; opening one reads one of
// two content types:
//   - Record: the complete short piece for one thing, readable in the reader
//     panel and on its canonical /index/<id> page.
//   - Thread: a narrated path through the map — the only long-form type.
// Everything under lib/portfolio.ts and lib/spatial-graph.ts is presentation
// scaffolding for the body-phase scene, not authored content.

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

export type PortfolioWorldNode = {
  id: string;
  label: string;
  kind: string;
  family: PortfolioWorldFamily;
  register: PortfolioWorldRegister;
  group: "about" | "operations" | "campaign" | "personal" | "client" | "products" | "threads";
  position: { x: number; y: number };
  summary: string;
  principle?: string;
  body: readonly string[];
  projectSlug?: string;
  threadId?: string;
};

export type PortfolioThread = {
  id: string;
  nodeId: string;
  title: string;
  lede: string;
  body: string;
  members: readonly string[];
};

export type PortfolioWorldLink = {
  from: string;
  to: string;
  type: "direct" | "lineage" | "story";
  layer: "factual" | "story-root" | "story-membership";
  threadId?: string;
};

export const portfolioThroughline =
  "Give small operators larger-operator leverage, help deserving work find its audience, and make complexity legible enough to act on.";

export const portfolioContact = {
  email: "bradley@braininavat.dance",
  cv: { label: "Download CV", href: "/cv/bradley-berkman-cv.pdf" },
  socials: [
    // Placeholder URLs; fill during the content writing session.
    { label: "LinkedIn", href: "https://www.linkedin.com/" },
    { label: "GitHub", href: "https://github.com/" },
    { label: "Instagram", href: "https://www.instagram.com/" },
  ],
} as const;

export const portfolioWorldNodes: readonly PortfolioWorldNode[] = [
  {
    id: "bradley",
    label: "Bradley Berkman",
    kind: "About",
    family: "identity",
    register: "identity",
    group: "about",
    position: { x: 50, y: 12 },
    summary: "I build systems, products, and operating practices across music promotion, consulting, and software.",
    body: [
      "Debate, public speaking, and Philosophy, Politics, and Law shaped how I structure claims and make decisions legible. An argument has to survive contact with another mind; that standard continues through the work here.",
    ],
  },
  {
    id: "infamous",
    label: "INFAMOUS PR",
    kind: "Music promotion",
    family: "operation",
    register: "warm",
    group: "operations",
    position: { x: 15, y: 77 },
    summary: "I was hired to launch an experimental music-promotion division inside a mature company, then built systems around the processes that did not yet exist.",
    body: [
      "Music-promotion strategy, operations, and the tools needed to make a new division run.",
    ],
  },
  {
    id: "music-practice",
    label: "Brain in a Vat Music Promotions",
    kind: "Music promotion",
    family: "operation",
    register: "warm",
    group: "operations",
    position: { x: 31, y: 85 },
    summary: "An independent music-promotion practice where campaign strategy, client work, and the systems around them developed together.",
    body: [
      "Campaigns move through kickoff, pitching, and reporting as parts of one operation.",
    ],
  },
  {
    id: "systems-consulting",
    label: "Brain in a Vat Systems & AI Consulting",
    kind: "Systems & AI consulting",
    family: "operation",
    register: "warm",
    group: "operations",
    position: { x: 50, y: 87 },
    summary: "A consulting practice focused on operational software, internal systems, and applied AI.",
    body: [
      "Consulting engagements that turn unclear operating processes into systems people can use.",
    ],
  },
  {
    id: "kickoff",
    label: "Campaign kickoff",
    kind: "Campaign system",
    family: "component",
    register: "bridge",
    group: "campaign",
    position: { x: 80, y: 40 },
    summary: "A campaign intake loop spanning client information, workflow automation, payment sequencing, and the first operational handoff.",
    principle: "Design the loop rather than do the task.",
    body: [
      "Treat kickoff as one stateful handoff instead of a pile of administrative steps.",
      "The quality of everything downstream depends on capturing the right information and sequencing commitments once.",
    ],
    projectSlug: "kickoff-intake",
  },
  {
    id: "pitching",
    label: "Campaign pitching",
    kind: "Campaign system",
    family: "component",
    register: "bridge",
    group: "campaign",
    position: { x: 88, y: 53 },
    summary: "Research, curator selection, matching, and outreach arranged around a human approval step.",
    principle: "Taste is encodable. The approval step stays human.",
    body: [
      "Model fit, expected value, and credit cost without automating the final taste decision.",
      "A useful system should increase the quality of attention without pretending uncertainty has disappeared.",
    ],
    projectSlug: "pitching",
  },
  {
    id: "reporting",
    label: "Campaign reporting",
    kind: "Campaign system",
    family: "component",
    register: "bridge",
    group: "campaign",
    position: { x: 76, y: 66 },
    summary: "A reporting chain that finds wins, stages evidence, and turns it into client-facing reports.",
    principle: "Judgment does not scale until it is specified.",
    body: [
      "Define the reporting judgment clearly enough that another operator can run it.",
      "Delegation is the strongest test that the system contains the reasoning rather than hiding it in its author.",
    ],
    projectSlug: "reporting",
  },
  {
    id: "real-estate",
    label: "Real-estate deal tracker",
    kind: "Client work",
    family: "engagement",
    register: "bridge",
    group: "client",
    position: { x: 68, y: 82 },
    summary: "A fuzzy team workflow translated into a schema inside the tools the team already used.",
    principle: "The bottleneck is ambiguity, not capability.",
    body: [
      "Model the process before adding software or asking the team to change tools.",
      "The leverage came from making states and ownership explicit, not from expanding the technology stack.",
    ],
    projectSlug: "real-estate-deal-tracker",
  },
  {
    id: "touring",
    label: "Tour advance system",
    kind: "Client work",
    family: "engagement",
    register: "bridge",
    group: "client",
    position: { x: 86, y: 73 },
    summary: "A touring workflow modeled and rebuilt inside familiar tools instead of imposed as a replacement platform.",
    principle: "Meet people inside the tools they already use.",
    body: [
      "Respect the habits around the work while making its states, owners, and exceptions explicit.",
      "Adoption depends on fitting the work as it happens, not demonstrating a technically cleaner isolated product.",
    ],
    projectSlug: "touring-advancing-tool",
  },
  {
    id: "personal-os",
    label: "Personal operating system",
    kind: "Personal system",
    family: "personal",
    register: "bridge",
    group: "personal",
    position: { x: 44, y: 55 },
    summary: "Macros, controls, task systems, review loops, and an agent-maintained workflow record treated as one working environment.",
    principle: "The artifact and the learning record can be the same object.",
    body: [
      "Keep the source of truth close enough to execution that the system can maintain it as the work changes.",
      "Documentation earns its place when the system reads it, updates it, and makes the next run better.",
      "Spec discipline is part of this system: product intent, constraints, and proof go into a durable specification before a build is delegated, and the most useful agent record shows the input, output, review, and correction rather than only a finished artifact.",
    ],
    projectSlug: "personal-tooling",
  },
  {
    id: "dubs",
    label: "Dubs",
    kind: "Product",
    family: "product",
    register: "cool",
    group: "products",
    position: { x: 21, y: 39 },
    summary: "A thinking tool built around the movement of an idea instead of generic content storage.",
    principle: "Thinking tools should preserve the shape of the thought.",
    body: [
      "Preserve the shape of the thought instead of forcing it into a rigid interface.",
      "The product's value depends on how it changes the act of working through an idea.",
    ],
    projectSlug: "dubs",
  },
  {
    id: "writ",
    label: "Writ",
    kind: "Product",
    family: "product",
    register: "cool",
    group: "products",
    position: { x: 29, y: 53 },
    summary: "A shipped menu-bar audio manager and a compact test of how a focused tool can disappear into the work.",
    principle: "A good idea becomes legible before it becomes complete.",
    body: [
      "Shipped.",
    ],
    projectSlug: "three-maturity-bundle",
  },
  {
    id: "yoohoo",
    label: "Yoohoo",
    kind: "Product",
    family: "product",
    register: "cool",
    group: "products",
    position: { x: 51, y: 72 },
    summary: "A product exploring how notifications can become more selective and useful.",
    principle: "A good idea becomes legible before it becomes complete.",
    body: [
      "Specified.",
    ],
    projectSlug: "three-maturity-bundle",
  },
  {
    id: "alarm",
    label: "Good Morning",
    kind: "Product concept",
    family: "product",
    register: "cool",
    group: "products",
    position: { x: 61, y: 56 },
    summary: "A concept for permissioned, parameterized alarm automation.",
    principle: "A good idea becomes legible before it becomes complete.",
    body: [
      "Exploratory.",
    ],
    projectSlug: "three-maturity-bundle",
  },
  {
    id: "thread-making-work-playable",
    threadId: "making-work-playable",
    label: "Making work playable",
    kind: "Thread",
    family: "story",
    register: "story",
    group: "threads",
    position: { x: 36, y: 29 },
    summary: "A thread about responsive tools that become fluent enough to think and work through.",
    body: [
      "The personal operating system, Dubs, Writ, Yoohoo, and Good Morning compose this reading.",
    ],
  },
  {
    id: "thread-choosing-what-not-to-automate",
    threadId: "choosing-what-not-to-automate",
    label: "Choosing what not to automate",
    kind: "Thread",
    family: "story",
    register: "story",
    group: "threads",
    position: { x: 65, y: 34 },
    summary: "A thread about making systems more capable while keeping consequential judgment human.",
    body: [
      "The campaign systems, personal tooling, and Yoohoo compose this reading.",
    ],
  },
  {
    id: "thread-finding-myself-in-software",
    threadId: "finding-myself-in-software",
    label: "Finding myself in software",
    kind: "Thread",
    family: "story",
    register: "finding",
    group: "threads",
    position: { x: 10, y: 57 },
    summary: "A thread about the route from argument and operating work into software as a medium.",
    body: [
      "The operating contexts and every software project compose this reading.",
    ],
  },
] as const;

export const portfolioThreads: readonly PortfolioThread[] = [
  {
    id: "making-work-playable",
    title: "Making work playable",
    lede: "The best work tools do more than remove steps. They become responsive enough to practice, improvise with, and eventually stop noticing.",
    body: "The personal operating system tests what an instrument can feel like in daily work, while Dubs, Writ, Yoohoo, and Good Morning explore it through distinct products.",
    nodeId: "thread-making-work-playable",
    members: ["personal-os", "dubs", "writ", "yoohoo", "alarm"],
  },
  {
    id: "choosing-what-not-to-automate",
    title: "Choosing what not to automate",
    lede: "Automation begins with a boundary. Some decisions gain from more information and faster execution but still lose their value when nobody owns the final call.",
    body: "Kickoff, pitching, and reporting draw different boundaries between automatic movement and human review, while personal tooling and Yoohoo test the same question around attention, permission, and control.",
    nodeId: "thread-choosing-what-not-to-automate",
    members: ["kickoff", "pitching", "reporting", "personal-os", "yoohoo"],
  },
  {
    id: "finding-myself-in-software",
    title: "Finding myself in software",
    lede: "Software did not arrive as an unrelated career change. Operating work kept producing problems I wanted to model, clarify, and build around. Across internal systems, consulting tools, and independent products, the medium became the throughline.",
    body: "This is a field rather than a ladder: systems built inside INFAMOUS PR, Brain in a Vat Music Promotions, and Brain in a Vat Systems & AI Consulting; tools for other teams; a personal operating environment; and independent products all sit at the same level.",
    nodeId: "thread-finding-myself-in-software",
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
      "alarm",
    ],
  },
] as const;

export const portfolioWorldLinks: readonly PortfolioWorldLink[] = [
  ["infamous", "music-practice", "lineage"],
  ["infamous", "kickoff", "lineage"],
  ["infamous", "pitching", "lineage"],
  ["infamous", "reporting", "lineage"],
  ["infamous", "personal-os", "lineage"],
  ["music-practice", "kickoff", "direct"],
  ["music-practice", "pitching", "direct"],
  ["music-practice", "reporting", "direct"],
  ["kickoff", "pitching", "direct"],
  ["pitching", "reporting", "direct"],
  ["music-practice", "personal-os", "direct"],
  ["personal-os", "dubs", "lineage"],
  ["personal-os", "writ", "lineage"],
  ["personal-os", "yoohoo", "lineage"],
  ["personal-os", "alarm", "lineage"],
  ["systems-consulting", "real-estate", "direct"],
  ["systems-consulting", "touring", "direct"],
].map(([from, to, type]) => ({ from, to, type, layer: "factual" } as PortfolioWorldLink));

export const portfolioWorldNodeById = new Map(
  portfolioWorldNodes.map((node) => [node.id, node]),
);

export const portfolioThreadById = new Map(
  portfolioThreads.map((thread) => [thread.id, thread]),
);

const threadRootLinks: readonly PortfolioWorldLink[] = portfolioThreads.map(
  ({ id, nodeId }) => ({
    from: "bradley",
    to: nodeId,
    type: "story",
    layer: "story-root",
    threadId: id,
  }),
);

const threadMembershipLinks: readonly PortfolioWorldLink[] = portfolioThreads.flatMap(
  ({ id, nodeId, members }) =>
    members.map((member) => ({
      from: nodeId,
      to: member,
      type: "story" as const,
      layer: "story-membership" as const,
      threadId: id,
    })),
);

export function getVisibleWorldLinks({
  selectedId,
}: {
  activeThreadId: string | null;
  selectedId: string | null;
}): PortfolioWorldLink[] {
  const links = [...portfolioWorldLinks];
  const selected = selectedId ? portfolioWorldNodeById.get(selectedId) : undefined;

  if (selectedId === "bradley") {
    links.push(...threadRootLinks);
  } else if (selected?.family === "story" && selected.threadId) {
    links.push(...threadRootLinks.filter(({ threadId }) => threadId === selected.threadId));
  }

  // The two concise editorial constellations remain part of the authored
  // field. Focus changes their emphasis, not their existence. Finding is
  // intentionally read through the factual field rather than thirteen
  // redundant spokes.
  links.push(
    ...threadMembershipLinks.filter(
      ({ threadId }) => threadId !== "finding-myself-in-software",
    ),
  );
  if (selectedId && selected?.family !== "story") {
    const finding = threadMembershipLinks.find(
      ({ from, to, threadId }) =>
        threadId === "finding-myself-in-software" &&
        (from === selectedId || to === selectedId),
    );
    if (finding) links.push(finding);
  }
  return links;
}

export function getWorldFocusIds({
  activeThreadId,
  selectedId,
}: {
  activeThreadId: string | null;
  selectedId: string | null;
}): Set<string> | null {
  if (!selectedId) return null;
  if (selectedId === "bradley") {
    return new Set(["bradley", ...portfolioThreads.map(({ nodeId }) => nodeId)]);
  }
  if (activeThreadId) {
    const thread = portfolioThreadById.get(activeThreadId);
    return thread
      ? new Set(["bradley", thread.nodeId, ...thread.members])
      : new Set([selectedId]);
  }
  const focused = new Set([selectedId]);
  for (const { from, to } of [...portfolioWorldLinks, ...threadMembershipLinks]) {
    if (from === selectedId) focused.add(to);
    if (to === selectedId) focused.add(from);
  }
  return focused;
}

export const portfolioWorldIndexGroups = [
  { id: "about", title: "About", nodeIds: ["bradley"] },
  { id: "operations", title: "Operations", nodeIds: ["infamous", "music-practice", "systems-consulting"] },
  { id: "campaign", title: "Campaign systems", nodeIds: ["kickoff", "pitching", "reporting"] },
  { id: "personal", title: "Personal system", nodeIds: ["personal-os"] },
  { id: "client", title: "Client work", nodeIds: ["real-estate", "touring"] },
  { id: "products", title: "Products", nodeIds: ["dubs", "writ", "yoohoo", "alarm"] },
] as const;

// Legacy case-study slugs → canonical node pages. Keeps old /index/<slug>
// links working after the case-study layer was retired.
export const legacyProjectSlugRedirects: Readonly<Record<string, string>> = {
  "kickoff-intake": "kickoff",
  "real-estate-deal-tracker": "real-estate",
  "touring-advancing-tool": "touring",
  "personal-tooling": "personal-os",
  "spec-discipline": "personal-os",
  "three-maturity-bundle": "writ",
};
