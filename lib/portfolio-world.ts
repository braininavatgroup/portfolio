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
  group: "about" | "operations" | "campaign" | "personal" | "client" | "products" | "stories";
  position: { x: number; y: number };
  summary: string;
  sectionTitle: string;
  sectionBody: string;
  projectSlug?: string;
  storyId?: string;
};

export type PortfolioStory = {
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
  storyId?: string;
};

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
    sectionTitle: "Background",
    sectionBody: "Debate, public speaking, and Philosophy, Politics, and Law shaped how I structure claims and make decisions legible. An argument has to survive contact with another mind; that standard continues through the work here.",
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
    sectionTitle: "The work",
    sectionBody: "Music-promotion strategy, operations, and the tools needed to make a new division run.",
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
    sectionTitle: "The work",
    sectionBody: "Campaigns move through kickoff, pitching, and reporting as parts of one operation.",
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
    sectionTitle: "The work",
    sectionBody: "Consulting engagements that turn unclear operating processes into systems people can use.",
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
    sectionTitle: "The decision",
    sectionBody: "Treat kickoff as one stateful handoff instead of a pile of administrative steps.",
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
    sectionTitle: "The decision",
    sectionBody: "Model fit, expected value, and credit cost without automating the final taste decision.",
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
    sectionTitle: "The decision",
    sectionBody: "Define the reporting judgment clearly enough that another operator can run it.",
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
    sectionTitle: "The decision",
    sectionBody: "Model the process before adding software or asking the team to change tools.",
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
    sectionTitle: "The decision",
    sectionBody: "Respect the habits around the work while making its states, owners, and exceptions explicit.",
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
    sectionTitle: "The decision",
    sectionBody: "Keep the source of truth close enough to execution that the system can maintain it as the work changes.",
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
    sectionTitle: "The decision",
    sectionBody: "Preserve the shape of the thought instead of forcing it into a rigid interface.",
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
    sectionTitle: "Current state",
    sectionBody: "Shipped.",
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
    sectionTitle: "Current state",
    sectionBody: "Specified.",
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
    sectionTitle: "Current state",
    sectionBody: "Exploratory.",
    projectSlug: "three-maturity-bundle",
  },
  {
    id: "story-making-work-playable",
    storyId: "making-work-playable",
    label: "Making work playable",
    kind: "Story",
    family: "story",
    register: "story",
    group: "stories",
    position: { x: 36, y: 29 },
    summary: "A story about responsive tools that become fluent enough to think and work through.",
    sectionTitle: "Story",
    sectionBody: "The personal operating system, Dubs, Writ, Yoohoo, and Good Morning compose this reading.",
  },
  {
    id: "story-choosing-what-not-to-automate",
    storyId: "choosing-what-not-to-automate",
    label: "Choosing what not to automate",
    kind: "Story",
    family: "story",
    register: "story",
    group: "stories",
    position: { x: 65, y: 34 },
    summary: "A story about making systems more capable while keeping consequential judgment human.",
    sectionTitle: "Story",
    sectionBody: "The campaign systems, personal tooling, Yoohoo, and Good Morning compose this reading.",
  },
  {
    id: "story-finding-myself-in-software",
    storyId: "finding-myself-in-software",
    label: "Finding myself in software",
    kind: "Story",
    family: "story",
    register: "finding",
    group: "stories",
    position: { x: 10, y: 57 },
    summary: "A story about the route from argument and operating work into software as a medium.",
    sectionTitle: "Story",
    sectionBody: "The operating contexts and every software project compose this reading.",
  },
] as const;

export const portfolioStories: readonly PortfolioStory[] = [
  {
    id: "making-work-playable",
    title: "Making work playable",
    lede: "The best work tools do more than remove steps. They become responsive enough to practice, improvise with, and eventually stop noticing.",
    body: "The personal operating system tests what an instrument can feel like in daily work, while Dubs, Writ, Yoohoo, and Good Morning explore it through distinct products.",
    nodeId: "story-making-work-playable",
    members: ["personal-os", "dubs", "writ", "yoohoo", "alarm"],
  },
  {
    id: "choosing-what-not-to-automate",
    title: "Choosing what not to automate",
    lede: "Automation begins with a boundary. Some decisions gain from more information and faster execution but still lose their value when nobody owns the final call.",
    body: "Kickoff, pitching, and reporting draw different boundaries between automatic movement and human review, while personal tooling, Yoohoo, and Good Morning test the same question around attention, permission, and control.",
    nodeId: "story-choosing-what-not-to-automate",
    members: ["kickoff", "pitching", "reporting", "personal-os", "yoohoo", "alarm"],
  },
  {
    id: "finding-myself-in-software",
    title: "Finding myself in software",
    lede: "Software did not arrive as an unrelated career change. Operating work kept producing problems I wanted to model, clarify, and build around. Across internal systems, consulting tools, and independent products, the medium became the throughline.",
    body: "This is a field rather than a ladder: systems built inside INFAMOUS PR, Brain in a Vat Music Promotions, and Brain in a Vat Systems & AI Consulting; tools for other teams; a personal operating environment; and independent products all sit at the same level.",
    nodeId: "story-finding-myself-in-software",
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

export const portfolioStoryById = new Map(
  portfolioStories.map((story) => [story.id, story]),
);

const storyRootLinks: readonly PortfolioWorldLink[] = portfolioStories.map(
  ({ id, nodeId }) => ({
    from: "bradley",
    to: nodeId,
    type: "story",
    layer: "story-root",
    storyId: id,
  }),
);

const storyMembershipLinks: readonly PortfolioWorldLink[] = portfolioStories.flatMap(
  ({ id, nodeId, members }) =>
    members.map((member) => ({
      from: nodeId,
      to: member,
      type: "story" as const,
      layer: "story-membership" as const,
      storyId: id,
    })),
);

export function getVisibleWorldLinks({
  selectedId,
}: {
  activeStoryId: string | null;
  selectedId: string | null;
}): PortfolioWorldLink[] {
  const links = [...portfolioWorldLinks];
  const selected = selectedId ? portfolioWorldNodeById.get(selectedId) : undefined;

  if (selectedId === "bradley") {
    links.push(...storyRootLinks);
  } else if (selected?.family === "story" && selected.storyId) {
    links.push(...storyRootLinks.filter(({ storyId }) => storyId === selected.storyId));
  }

  // The two concise editorial constellations remain part of the authored
  // field. Focus changes their emphasis, not their existence. Finding is
  // intentionally read through the factual field rather than thirteen
  // redundant spokes.
  links.push(
    ...storyMembershipLinks.filter(
      ({ storyId }) => storyId !== "finding-myself-in-software",
    ),
  );
  if (selectedId && selected?.family !== "story") {
    const finding = storyMembershipLinks.find(
      ({ from, to, storyId }) =>
        storyId === "finding-myself-in-software" &&
        (from === selectedId || to === selectedId),
    );
    if (finding) links.push(finding);
  }
  return links;
}

export function getWorldFocusIds({
  activeStoryId,
  selectedId,
}: {
  activeStoryId: string | null;
  selectedId: string | null;
}): Set<string> | null {
  if (!selectedId) return null;
  if (selectedId === "bradley") {
    return new Set(["bradley", ...portfolioStories.map(({ nodeId }) => nodeId)]);
  }
  if (activeStoryId) {
    const story = portfolioStoryById.get(activeStoryId);
    return story
      ? new Set(["bradley", story.nodeId, ...story.members])
      : new Set([selectedId]);
  }
  const focused = new Set([selectedId]);
  for (const { from, to } of [...portfolioWorldLinks, ...storyMembershipLinks]) {
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
