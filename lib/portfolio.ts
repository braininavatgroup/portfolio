export type DomainId = "music" | "consulting" | "development";
export type ChainLayer =
  | "judgment"
  | "spec"
  | "system"
  | "artifact"
  | "operation";
export type EvidenceStatus = "available" | "partial" | "needed";
export type ArtifactTokenKind =
  | "intake"
  | "selection"
  | "report"
  | "tracker"
  | "road-case"
  | "audio"
  | "maturity"
  | "toolkit"
  | "spec";

export type ChainEntry = {
  layer: ChainLayer;
  title: string;
  detail: string;
};

export type EvidenceItem = {
  label: string;
  status: EvidenceStatus;
  note: string;
};

export type ArtifactRecord = {
  slug: string;
  title: string;
  domain: DomainId;
  token: ArtifactTokenKind;
  summary: string;
  principle: string;
  decision: string;
  reason: string;
  chain: ChainEntry[];
  evidenceStatus: EvidenceStatus;
  evidence: EvidenceItem[];
};

export const domains = [
  {
    id: "music" as const,
    label: "Music promotion",
    description: "Taste, selection, client systems, and delegated reporting.",
    angle: 0.28,
  },
  {
    id: "consulting" as const,
    label: "Consulting",
    description: "Ambiguous workflows translated into systems people can use.",
    angle: 2.45,
  },
  {
    id: "development" as const,
    label: "Development",
    description: "Specs, shipped tools, and the operating system behind the work.",
    angle: 4.55,
  },
] as const;

const chain = (
  judgment: [string, string],
  spec: [string, string],
  system: [string, string],
  artifact: [string, string],
  operation: [string, string],
): ChainEntry[] => [
  { layer: "judgment", title: judgment[0], detail: judgment[1] },
  { layer: "spec", title: spec[0], detail: spec[1] },
  { layer: "system", title: system[0], detail: system[1] },
  { layer: "artifact", title: artifact[0], detail: artifact[1] },
  { layer: "operation", title: operation[0], detail: operation[1] },
];

export const artifacts: ArtifactRecord[] = [
  {
    slug: "kickoff-intake",
    title: "Campaign kickoff and intake",
    domain: "music",
    token: "intake",
    summary:
      "A campaign intake loop spanning the client form, workflow automation, desktop control, and payment sequencing.",
    principle: "Design the loop rather than do the task.",
    decision:
      "Treat kickoff as one stateful handoff instead of a pile of administrative steps.",
    reason:
      "The quality of everything downstream depends on capturing the right information and sequencing commitments once.",
    chain: chain(
      ["Find the costly judgment", "Separate the decisions a person must make from the transfers software can perform."],
      ["Requirements and field map", "Define the intake fields, state changes, payment sequence, and deployment checklist."],
      ["Kickoff loop", "Connect form submission, n8n workflow steps, Keyboard Maestro actions, and two-stage Stripe sequencing."],
      ["Kickoff automation", "The visible form and its linked operational workflow."],
      ["Repeatable handoff", "The workflow is designed for another operator. Independent run records are not yet published."],
    ),
    evidenceStatus: "partial",
    evidence: [
      { label: "Requirements and field map", status: "partial", note: "Requirements and field mapping are partially documented." },
      { label: "Workflow capture", status: "needed", note: "Form and workflow screenshots are not yet published." },
      { label: "Independent operation", status: "needed", note: "A handoff record or run log is not yet published." },
    ],
  },
  {
    slug: "pitching",
    title: "Pitching system",
    domain: "music",
    token: "selection",
    summary:
      "Research, curator selection, matching, and outreach arranged around a human approval step.",
    principle: "Taste is encodable. The approval step stays human.",
    decision:
      "Model selection pressure and credit cost without automating the final taste decision.",
    reason:
      "A useful system should increase the quality of attention without pretending uncertainty has disappeared.",
    chain: chain(
      ["Preserve taste", "Identify what can be scored while keeping the irreversible approval with a person."],
      ["Curator taxonomy and matching model", "Describe curator taste, audience, genre fit, client goals, approval rates, expected value, and credit budget."],
      ["Selection workflow", "Move from research through shortlist, approval, and email pitching."],
      ["Pitch list and research tools", "Pitch list, research tool, SubmitHub curator selector, and email workflow."],
      ["Human-approved operation", "Model documentation, sample decisions, and measured results are not yet published."],
    ),
    evidenceStatus: "needed",
    evidence: [
      { label: "Selection model", status: "needed", note: "The taxonomy, weighting rules, and a sample decision are not yet published." },
      { label: "Outcome evidence", status: "needed", note: "Measured approval and budget results are not yet published." },
    ],
  },
  {
    slug: "reporting",
    title: "Campaign reporting",
    domain: "music",
    token: "report",
    summary:
      "A reporting chain that finds wins, stages evidence, and turns it into client-facing reports.",
    principle: "Judgment does not scale until it is specified.",
    decision:
      "Write the reporting judgment down clearly enough that another operator can run it.",
    reason:
      "Delegation is the strongest test that the system contains the reasoning rather than hiding it in its author.",
    chain: chain(
      ["Define a reportable win", "Specify which signals matter and what context a client needs."],
      ["Reporting process", "Document inputs, win rules, staging states, review points, and report composition."],
      ["Detection and staging", "Find candidate wins, stage them for review, and assemble report inputs."],
      ["Client reports", "The final report and the report-generator skill."],
      ["Run by someone else", "Handoff documentation and independent run evidence are not yet published."],
    ),
    evidenceStatus: "partial",
    evidence: [
      { label: "Report examples", status: "partial", note: "Representative report examples are being prepared." },
      { label: "Handoff proof", status: "needed", note: "Documentation and an independent run record are not yet published." },
    ],
  },
  {
    slug: "real-estate-deal-tracker",
    title: "Real-estate deal tracker",
    domain: "consulting",
    token: "tracker",
    summary:
      "A fuzzy team workflow translated into a schema inside the tools the team already used.",
    principle: "The bottleneck is ambiguity, not capability.",
    decision:
      "Model the process before adding new software or asking the team to change tools.",
    reason:
      "The leverage came from making states and ownership explicit, not from expanding the technology stack.",
    chain: chain(
      ["Locate the ambiguity", "Find the handoffs and terms that different team members interpret differently."],
      ["Process model and schema", "Name the entities, states, ownership, and transitions."],
      ["Tracker inside existing tools", "Implement the model where the team already works."],
      ["Deal tracker", "The working tracker and its visible workflow."],
      ["Changed team operation", "A real before-and-after comparison is still required."],
    ),
    evidenceStatus: "needed",
    evidence: [
      { label: "Before", status: "needed", note: "The baseline workflow is not yet published." },
      { label: "After", status: "needed", note: "The implemented tracker and changed result are not yet published." },
    ],
  },
  {
    slug: "touring-advancing-tool",
    title: "Touring advancing tool",
    domain: "consulting",
    token: "road-case",
    summary:
      "A touring workflow modeled and rebuilt inside familiar tools rather than imposed as a replacement platform.",
    principle: "Meet people inside the tools they already use.",
    decision:
      "Reuse the process-modeling move from consulting while respecting this domain's existing habits.",
    reason:
      "Adoption depends on fitting the work as it happens, not demonstrating a technically cleaner isolated product.",
    chain: chain(
      ["Respect the working context", "Observe where advancing decisions happen and what people already trust."],
      ["Advancing process model", "Define inputs, dependencies, states, owners, and exceptions."],
      ["Embedded workflow", "Implement the process in the team's existing tools."],
      ["Advancing tool", "The working interface and operational output."],
      ["Adopted operation", "Before-and-after evidence is still required to prove the comparison."],
    ),
    evidenceStatus: "needed",
    evidence: [
      { label: "Before", status: "needed", note: "The baseline advancing workflow is not yet published." },
      { label: "After", status: "needed", note: "The tool and evidence of changed operation are not yet published." },
    ],
  },
  {
    slug: "dubs",
    title: "Dubs",
    domain: "development",
    token: "audio",
    summary:
      "A shipped app presented as a complete line from judgment through spec, build, and use.",
    principle: "Thinking tools should preserve the shape of the thought.",
    decision:
      "Build the interaction around the thinking process rather than around generic content storage.",
    reason:
      "The product's value depends on how it changes the act of working through an idea.",
    chain: chain(
      ["Protect the thought process", "Identify what normal capture tools flatten or interrupt."],
      ["Product spec and build process", "Connect the intended thinking behavior to interaction and implementation choices."],
      ["Shipped application", "Move the specification through build, review, and release."],
      ["Dubs", "The app, its spec, and its working interaction."],
      ["Real use", "Release, interface, and usage material are being assembled."],
    ),
    evidenceStatus: "partial",
    evidence: [
      { label: "Dubs evidence", status: "needed", note: "The build, spec, interface, and representative output are not yet published." },
    ],
  },
  {
    slug: "three-maturity-bundle",
    title: "Three stages of becoming real",
    domain: "development",
    token: "maturity",
    summary:
      "Rit shipped, a notifications app specified, and a conditional alarm clock sketched as one comparison across maturity.",
    principle: "A good idea becomes legible before it becomes complete.",
    decision:
      "Show three honest maturity states together instead of presenting every concept as equally finished.",
    reason:
      "The contrast exposes what specification, implementation, and release each add to an idea.",
    chain: chain(
      ["Name the maturity honestly", "Separate what shipped from what is specified and what remains exploratory."],
      ["Notification and alarm concepts", "Specify a notifications app and sketch permissioned, parameterized alarm automation."],
      ["Rit build and app concepts", "Connect each idea to the system appropriate for its current stage."],
      ["Rit, notifications, conditional alarm", "One shipped menu-bar audio manager, one specified app, and one sketch."],
      ["Evidence by maturity", "The Rit build and materials for all three stages are not yet published."],
    ),
    evidenceStatus: "needed",
    evidence: [
      { label: "Rit release or build", status: "needed", note: "Runnable or release evidence is not yet published." },
      { label: "Notifications spec", status: "needed", note: "The specification and interface work are not yet published." },
      { label: "Alarm sketch", status: "needed", note: "The sketch is not yet published. This project has not shipped." },
    ],
  },
  {
    slug: "personal-tooling",
    title: "Personal tooling",
    domain: "development",
    token: "toolkit",
    summary:
      "Macros, controls, task systems, a review loop, and an agent-maintained workflow wiki treated as one operating system.",
    principle: "The artifact and the learning record can be the same object.",
    decision:
      "Keep the workflow source of truth close enough to execution that agents can maintain it as work changes.",
    reason:
      "Documentation earns its place when the system reads it, updates it, and makes the next run better.",
    chain: chain(
      ["Find recurring friction", "Notice repeated choices and handoffs in personal work."],
      ["Workflow source of truth", "Describe macros, Stream Deck maps, OmniFocus, review rules, and wiki ownership."],
      ["Hub-and-spoke operating system", "Connect tools through a maintained workflow record rather than isolated shortcuts."],
      ["Personal tools and workflow wiki", "The actual macros, maps, task system, review loop, and documentation."],
      ["Agent-maintained operation", "The shared workflow record and its maintenance history are not yet published."],
    ),
    evidenceStatus: "needed",
    evidence: [
      { label: "System map", status: "needed", note: "The system map and shared workflow record are not yet published." },
      { label: "Maintenance record", status: "needed", note: "An agent-authored change with review evidence is not yet published." },
    ],
  },
  {
    slug: "spec-discipline",
    title: "Spec discipline",
    domain: "development",
    token: "spec",
    summary:
      "A real specification, the agent work it produced, and the reusable method used to revise both.",
    principle: "Judgment becomes reusable when the contract is concrete enough to test.",
    decision:
      "Put product intent, constraints, and proof in a durable specification before delegating the build.",
    reason:
      "The most useful agent record shows the input, output, review, and correction rather than only a finished artifact.",
    chain: chain(
      ["Fix the product judgment", "State the choice that must survive implementation."],
      ["Real specification and template", "Make scope, behavior, constraints, and verification explicit."],
      ["Agent build and review loop", "Execute the spec, inspect the result, and feed corrections back into the record."],
      ["Spec-to-agent record", "The specification, agent output, revisions, and resulting artifact."],
      ["Reusable practice", "An end-to-end record is not yet published."],
    ),
    evidenceStatus: "needed",
    evidence: [
      { label: "End-to-end record", status: "needed", note: "A real spec, output, revisions, and final artifact are not yet published together." },
      { label: "Portfolio-grounded agent demo", status: "needed", note: "Inspectable input and output are not yet published." },
    ],
  },
];

export const artifactSlugs = artifacts.map((artifact) => artifact.slug);

export const getArtifact = (slug: string) =>
  artifacts.find((artifact) => artifact.slug === slug);

export const audienceStatement =
  "For AI product teams, music-world collaborators, and consulting clients looking for someone who can turn judgment into a system without sanding away the character of the work.";

export const portfolioThroughline =
  "Give small operators larger-operator leverage, help deserving work find its audience, and make complexity legible enough to act on.";

export const careerTimeline = [
  {
    period: "Origin / 2016",
    title: "Electronic music becomes the native domain",
    detail:
      "Electronic music became the starting point for the work represented here.",
    evidenceStatus: "partial" as const,
  },
  {
    period: "2021–2024",
    title: "Head of Music Promotion at INFAMOUS PR",
    detail:
      "Led music-promotion strategy and operations at INFAMOUS PR. Representative campaigns and outcomes are being prepared for publication.",
    evidenceStatus: "partial" as const,
  },
  {
    period: "After 2024",
    title: "The work branches into consulting, development, and agent systems",
    detail:
      "Expanded the same process-modeling work into consulting, product development, and agent systems.",
    evidenceStatus: "partial" as const,
  },
  {
    period: "Current",
    title: "Strategy and creativity in the room",
    detail:
      "The current focus is strategy, creative direction, and product work with teams that value close collaboration.",
    evidenceStatus: "needed" as const,
  },
];
