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
  body: readonly string[];
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
  "Give small operators larger-operator leverage, and make complexity legible enough to act on.";

export const portfolioContact = {
  email: "bradley@braininavat.dance",
  cv: { label: "Download CV", href: "/cv/bradley-berkman-cv.pdf" },
  socials: [
    { label: "LinkedIn", href: "https://www.linkedin.com/in/bradleyberkman/" },
    { label: "GitHub", href: "https://github.com/bradleybiav" },
    { label: "Instagram", href: "https://www.instagram.com/bradley_berkman/" },
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
    summary: "I build the systems my own businesses run on: a music-promotion agency, a consulting practice, and the software under both.",
    body: [
      "I'm Bradley Berkman, a founder based in Brooklyn. I run Brain in a Vat, a music-promotion agency for electronic musicians and record labels, and a systems-and-AI consulting practice built on the way that agency operates. Before going independent, I launched and led the music-promotion division at INFAMOUS PR.",
      "Debate and a Philosophy, Politics, and Law degree left me with one standard. An argument has to survive contact with another mind, and I still hold the work to it.",
      "Away from the desk: raving, the philosophy of consciousness, Catan, and the ongoing search for the best burger in New York.",
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
    summary: "A fourth department, built from nothing inside an established electronic-music PR agency and run like a startup within the company.",
    body: [
      "INFAMOUS had spent fifteen years becoming the PR agency dance music calls first. But its retainers were built for albums, tours, and long narratives, and dance music runs on singles and EPs. Work the agency couldn't serve came in every week and got turned away. In 2021 they brought me in, on a trial basis, to capture it.",
      "I developed the service suite: DSP playlist promotion first, always the differentiator, then radio, DJ promotion, YouTube distribution, and social seeding. I iterated it against client feedback, and strategy and buildout were mine end to end. My first hire, my first automations, and my first real operations work all happened here.",
      "INFAMOUS's name and connections made the department viable before I had a reputation of my own. By 2024 the co-sign had done its work. The roster, the relationships, and the systems were mine, and I left to run them myself.",
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
      "Brain in a Vat is what the INFAMOUS department became once the work was fully mine. Going independent removed the last friction. There was nobody to ask before trying new software and no inherited workflow to accommodate, so automation moved fast.",
      "Two years in, that has added up to 253 campaigns across four service lines: DSP promotion, radio, social seeding, and press. The roster includes WhoMadeWho, Adriatique, SIDEPIECE, Warner Records, The Orchard Distribution, and Algorhythms Music Group.",
      "Every campaign runs through the same three systems: kickoff, pitching, and reporting. Each one has its own page here.",
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
    principle: "Foundation first.",
    body: [
      "Clients hire me for three things: systems optimization, custom software, and applied AI. What they buy is simpler. Less manual work, fewer tools that don't talk to each other, and AI that runs reliably because it was built around the operation they already have.",
      "In practice that has meant mapping a brokerage team's deal lifecycle into explicit states and owners, and rebuilding a tour manager's advancing workflow inside the tools they already used. An engagement starts with an audit that maps the operation and prices a prioritized plan. Then I build the working systems, and then I stay on retainer to monitor and tune them.",
      "Dependable AI sits on a structured, machine-readable account of the business, which is why the audit always comes first. The proof is my own agency. It runs operations today that were impossible before that foundation existed.",
    ],
  },
  {
    id: "kickoff",
    label: "Campaign kickoff",
    kind: "Music promotions systems",
    family: "component",
    register: "bridge",
    group: "campaign",
    position: { x: 80, y: 40 },
    summary: "The intake sequence that turns a signed confirmation into records, an invoice, a campaign folder, and a drafted kickoff email in about a minute.",
    principle: "Design the loop rather than do the task.",
    body: [
      "A signed confirmation is the moment a client is ready to pay, and the worst possible moment to disappear into administrative work. Kickoff compresses that work into one keyboard shortcut. It creates the client and deal records, the invoice, and the campaign folder, then drafts a kickoff email carrying a payment link and one asset-request form per campaign. Roughly thirty minutes across four apps became about one, and invoicing stopped being a chase.",
      "The automation assembles; it never commits. Every step is a prefilled dialog I can cancel, and the email stays a draft until I send it. Assets we already hold get attached on the way out, so clients never re-enter what we already have.",
      "The asset workflow replaced the old email threads, where files got lost and re-versioned across a dozen messages. Every asset lives on our side rather than as a link into the client's storage, because client-hosted files change and permissions vanish mid-campaign. Speed is only part of the payoff. The rest is service. Nothing gets lost, nothing goes stale, and the campaign starts while the client is still excited.",
    ],
    projectSlug: "kickoff-intake",
  },
  {
    id: "pitching",
    label: "Campaign pitching",
    kind: "Music promotions systems",
    family: "component",
    register: "bridge",
    group: "campaign",
    position: { x: 88, y: 53 },
    summary: "Research, curator selection, matching, and outreach arranged around a human approval step.",
    principle: "Taste is encodable. The approval step stays human.",
    body: [
      "The system is built on one idea: taste can be recorded, and recorded taste can drive targeting. It started as a spreadsheet where I logged every curator's adds, passes, and feedback, and it grew from there into real infrastructure.",
      "Two databases carry it now, one record per curator with their playlists rolling up underneath. A curator gets at most one pitch a week, no matter how many campaigns are live. Campaigns and playlists share a genre ontology. Each week the system matches them, dedupes against every prior pitch, and produces a draft pitch list with the reasoning already worked out. My review adds the one thing the ontology deliberately leaves out, whether a track reads commercial or underground. That single call sends two same-genre tracks to different playlists.",
      "Pitching people music they don't want is how they stop opening your emails, and staying valuable to curators is the whole business. Two backstops recover what the restraint gives up. Reporting runs feed missing genre tags back into the database whenever a playlist turns out to play something it wasn't mapped for, and every pitch links a playlist of all current campaigns, so a curator can always find the track I didn't send.",
    ],
    projectSlug: "pitching",
  },
  {
    id: "reporting",
    label: "Campaign reporting",
    kind: "Music promotions systems",
    family: "component",
    register: "bridge",
    group: "campaign",
    position: { x: 76, y: 66 },
    summary: "A reporting chain that finds wins, stages evidence, and turns it into client-facing reports.",
    principle: "Judgment does not scale until it is specified.",
    body: [
      "Reporting once ate close to three days of every week. The time went to collecting evidence of work already done and assembling it into spreadsheets, at the direct expense of the work itself.",
      "I invented the process, refined it by hand for years, and automated fragments with macros. The turning point was delegation. Handing it to an assistant with no background in music forced me to write down judgment I had been carrying in my head, and teaching turned into managing, improving the system from outside the weeds. Full automation is the same discipline with a faster executor. It needs a precise spec, written for someone with no context.",
      "That judgment now lives in a versioned rules document the model reads on every run, with commitments like silence is not a pass, never invent, and never downgrade an outcome. Code re-checks every conclusion the model draws. The one decision with consequences beyond the report, whether a curator becomes auto-pitchable, sits outside the model entirely in a small deterministic gate.",
      "Today the pipeline runs daily, dashboards refresh through the day, and client emails arrive as drafts for a personal pass. The work went from roughly twenty-four hours a week to about one, with fewer errors, not more.",
    ],
    projectSlug: "reporting",
  },
  {
    id: "real-estate",
    label: "Real-estate deal tracker",
    kind: "Client systems",
    family: "engagement",
    register: "bridge",
    group: "client",
    position: { x: 68, y: 82 },
    summary: "A brokerage team's deal process made explicit as six stages with named owners, wired into the spreadsheets they already worked in.",
    principle: "The bottleneck is ambiguity, not capability.",
    body: [
      "For one residential brokerage team, a single deal crossed six tools between pitch and close, and the only thing connecting them was the coordinator's attention. Agents tracked deals in notebooks and verbal updates, so the operational record ran a step behind reality. The rules existed and the data existed. A person was carrying information between them by hand.",
      "I made the process explicit as a six-stage deal lifecycle. Every stage has a named condition for advancing, and every hop between tools has a named owner. Once the states were on paper, the machine's share of the work was obvious.",
      "The build honored one constraint: no new tools. Teams keep the software they already pay for and like. So the delivery was a derived-data layer beneath the team's own spreadsheets, built entirely inside Google. It tolerates messy hand-entered data and says exactly which rows it skipped. An operation that lived in one person's head became something the whole team can see.",
    ],
    projectSlug: "real-estate-deal-tracker",
  },
  {
    id: "touring",
    label: "Tour advance system",
    kind: "Client systems",
    family: "engagement",
    register: "bridge",
    group: "client",
    position: { x: 86, y: 73 },
    summary: "One structured record per show, a day-sheet that generates itself, and a chase engine that drafts every nudge but never sends one.",
    principle: "Meet people inside the tools they already use.",
    body: [
      "Advancing a show means pulling venue details, set times, riders, transport, and hotels out of a promoter. Every promoter sends them differently, across scattered email threads, while artists text screenshots of their flights. For a manager running several artists, it is exactly the work that slips.",
      "The tool gives each advance one structured record, one artist and one show. It renders a clean day-sheet as a PDF and a calendar entry, and it chases the promoter for whatever is missing. The chase happens where promoters already live, in email. It drafts its nudge into the live thread, in the manager's voice, addressed to the promoter alone, and it never sends. An automated \"you're late\" that copied the artist would be a credibility landmine.",
      "The keystone is a field registry, one table that names each field's owner, whether it's required, and where it appears. The owner is the manager, the promoter, the artist, or the system itself. Forms, day-sheet, and chase engine are all projections of that table. Starting an advance takes four fields, because setup friction is the biggest adoption risk, and an advance that used to sprawl across a dozen email threads now has a single record with a single owner for every fact on it.",
    ],
    projectSlug: "touring-advancing-tool",
  },
  {
    id: "personal-os",
    label: "Personal operating system",
    kind: "Personal systems",
    family: "personal",
    register: "bridge",
    group: "personal",
    position: { x: 44, y: 55 },
    summary: "The desk, the capture discipline, and the delegation specs I run my own work through.",
    principle: "Capture now, process later.",
    body: [
      "The desk is set up like an instrument. Every action I take more than a few times a day has a physical trigger under a finger, on a Stream Deck key, a remapped keypad, or a gesture, and the tuning is never finished. The rule matters more than the gear.",
      "All of it protects attention. Whatever comes to mind gets captured instantly into an inbox I trust, then processed later, so nothing interrupts the current thread of work. Text goes to Drafts, tasks to OmniFocus, and durable notes to Obsidian. Even the audible part of the day is instrumented; long reading and agent updates reach me through Dubs while I walk.",
      "Agent work runs on the same discipline. I delegate builds against written specs with falsifiable done-conditions, because a worker who guesses produces work that has to be audited. The test for whether a task is ready to hand off is a single rule. Another session, human or agent, could pick it up and move it today.",
    ],
    projectSlug: "personal-tooling",
  },
  {
    id: "dubs",
    label: "Dubs",
    kind: "In Production",
    family: "product",
    register: "cool",
    group: "products",
    position: { x: 21, y: 39 },
    summary: "Listen to any document and talk back without breaking stride. A tool for human thinking in the age of agents.",
    principle: "The moment for the thought is the moment you lose it.",
    body: [
      "The useful reaction to something you're hearing tends to arrive while you're walking, driving, or mid-task, before any workflow is ready for it. By the time you unlock a phone and find the right app, the thought has faded. So people save material in one place, listen to it somewhere else, and brief their agents from memory.",
      "Dubs closes the loop. Documents flow from their original sources into one inbox. You move between reading and listening, capture reactions inline by voice or text without losing your place, and pick up at the same spot on any device. What accumulates is a linked library of documents, annotations, and notes, raw material for your own thinking and exactly the context an agent needs.",
      "Status: alpha TestFlight testing, finding product-market fit. The proof will be repeated use of the listen, capture, and hand-to-agent loop. The core bet is falsifiable by design, since audio-first could turn out to be the wrong balance rather than the wrong direction.",
    ],
    projectSlug: "dubs",
  },
  {
    id: "writ",
    label: "Writ",
    kind: "In Production",
    family: "product",
    register: "cool",
    group: "products",
    position: { x: 29, y: 53 },
    summary: "A menu-bar app that keeps your Mac's audio on the devices you actually want, instead of whatever connected most recently.",
    principle: "Sometimes nothing happening is the correct behavior.",
    body: [
      "macOS has no concept of audio-device priority. It follows the last thing you plugged in, every time. Writ is the list that says otherwise, a standing order the audio system obeys. Input and output get separate lists because the right answers differ. You almost always want your good microphone, and you usually do want the headphones you just put on.",
      "The details are pain-earned. The built-in mic still shows up when a MacBook's lid is closed even though the hardware can't hear, so Writ skips the dead device. AirPlay speakers arrive with anonymous, throwaway identities, so Writ makes the name you give one stick. Some cases are handled by deliberate inaction. A device you picked by hand is respected, AirPlay is never overridden, and when nothing eligible is connected, Writ leaves you where you are rather than moving you somewhere worse.",
      "Status: signed and notarized, in daily use on my own machine, and being prepared for public release.",
    ],
    projectSlug: "three-maturity-bundle",
  },
  {
    id: "yoohoo",
    label: "Yoohoo",
    kind: "In Production",
    family: "product",
    register: "cool",
    group: "products",
    position: { x: 51, y: 72 },
    summary: "Notifications that hold state: one durable record that agents, automations, and households can update, ask questions through, and resolve exactly once.",
    principle: "The model may draft. It may never decide.",
    body: [
      "A push notification fires once and then rots. Yoohoo replaces it with one durable record per situation. State updates in place without new noise, a question can go to several people and be answered exactly once, and the workflow that was waiting resumes with an authoritative result. Tapping a notification the world has moved past does nothing.",
      "The notification is a view; the server owns the record. The first valid answer wins, and a resolved question can never execute twice.",
      "The line on AI is deliberate. A model may draft content and quiet routine updates. It may never suppress a question, and it never decides authorization, recipients, or resolution. Every failure falls back to a deterministic path, so an AI outage can't silently lose information.",
      "Status: specified. An approved product contract, awaiting implementation.",
    ],
    projectSlug: "three-maturity-bundle",
  },
  {
    id: "alarm",
    label: "Good Morning",
    kind: "In Production",
    family: "product",
    register: "cool",
    group: "products",
    position: { x: 61, y: 56 },
    summary: "A concept for conditional alarms: an anchor wake time plus rules that let people and data move it while you sleep.",
    principle: "A good idea becomes legible before it becomes complete.",
    body: [
      "Good Morning began as a delegated alarm. The person who is already awake, and knows the circumstances that would let you sleep in, gets permission to move your alarm while you sleep.",
      "Thinking it through widened the idea. Rules become deltas from your normal time. Snow, minus twenty minutes. First meeting cancelled, plus forty-five. Everything stays inside a window you set, and a person turns out to be just one condition alongside weather, flights, and the calendar.",
      "The design earns trust with specifics. The sleeper is always told why the time moved, holds a pre-set veto for every condition, and decides what silence means.",
      "Status: an idea, worked out in conversation and written down. Nothing is built.",
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
      "The music promotions systems, personal tooling, and Yoohoo compose this reading.",
    ],
  },
  {
    id: "thread-finding-myself-in-software",
    threadId: "finding-myself-in-software",
    label: "From argument to instrument",
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
    lede: "The best work tools do more than remove steps. They become responsive enough to practice on and, eventually, to stop noticing.",
    body: [
      "A script on my machine watches the dictation engine's log so the confirming keystroke lands the instant the transcript finishes pasting. That is an unreasonable amount of engineering to save a quarter of a second, and it is the whole thesis. A tool you have to think about is a tool you are not thinking through.",
      "Fluency changes what a day is. When capture is instant and trusted, a stray idea stops being an interruption. When the frequent actions cost nothing, the right move and the easy move become the same move. Work stops being administration punctuated by thought and starts to reward repetition, the way an instrument does.",
      "Each product holds that standard somewhere different. Dubs is the fullest test, a thought captured mid-stride without breaking it. Writ passes by disappearing, audio that stays where you put it from a tool you never open. Yoohoo and Good Morning push the question past the desk and ask whether attention, and even sleep, can be handled with the same care.",
    ],
    nodeId: "thread-making-work-playable",
    members: ["personal-os", "dubs", "writ", "yoohoo", "alarm"],
  },
  {
    id: "choosing-what-not-to-automate",
    title: "Choosing what not to automate",
    lede: "Automation begins with a boundary. Some decisions gain from more information and faster execution but still lose their value when nobody owns the final call.",
    body: [
      "Every campaign moves through three systems, and each one draws its automation boundary in a different place. None of the placements is an accident.",
      "Kickoff puts the boundary at the moment of commitment. A client who confirms is ready to pay, and administrative delay is how invoices go stale, so one shortcut runs the whole sequence. But every step can be abandoned cleanly, and the email at the end stays a draft until I send it. The machine assembles; a person says go.",
      "Pitching keeps the boundary at judgment. Matching, deduplication, and segmentation across thousands of playlists happen without me. The qualitative read the genre ontology can't express stays mine, at a weekly review gate. And the ontology is capped on purpose. You could add qualitative tags forever, and a trained eye is cheaper than that data architecture will ever be.",
      "Reporting has the most precise boundary of the three because it was delegated to a person before it was delegated to software. Making the process teachable forced the judgment into writing, and the automated version inherits that. The rules are stated outright, code double-checks the model's conclusions, and the one decision with consequences beyond the report never enters the model at all.",
      "One rule spans all three. Email to a human leaves only on my confirmation. Kickoff emails, asset chases, and client reports stage as drafts, and the weekly pitches send after I approve each segment. Every message needs to feel personal because it is. The rule predates the automation and survived it.",
      "The boundary is where the value sits. Curators keep opening my emails because I don't send them things they don't want, and clients stay because nothing gets lost. The systems buy attention, and attention is what the business sells.",
    ],
    nodeId: "thread-choosing-what-not-to-automate",
    members: ["kickoff", "pitching", "reporting", "personal-os", "yoohoo"],
  },
  {
    id: "finding-myself-in-software",
    title: "From argument to instrument",
    lede: "Software was never a career change. Operating work kept producing problems I wanted to model and build around, and at some point the medium became the throughline.",
    body: [
      "The first discipline was argument. Years of debate and a Philosophy, Politics, and Law degree set the standard everything since still answers to. A claim counts only if it survives contact with another mind, and a decision should be legible to the people it affects.",
      "At INFAMOUS, inventing the services meant living their costs. Days of every week went to compiling evidence of finished work, and midnights went to personalizing hundreds of pitch emails by hand. The first instruments were small, text snippets and mail merge, but they proved something larger. The shape of the work was itself something I could change.",
      "The defining move was teaching. Handing my reporting process to an assistant with no domain background forced me to define it better than I ever had for myself, and directing work from outside the weeds became the skill the rest of the work runs on. By the end of my INFAMOUS years, the low-context executor was as often an AI agent as a person.",
      "Independence compounded it. At Brain in a Vat there were no approvals to wait on and no inherited systems to accommodate, and the agent-driven automation matured into a real operating advantage, built to my own judgment and taste. The advantage became a second practice. Consulting is doing for other teams what I had done for my own operation, turning fuzzy workflows into explicit states and owners inside the tools people already use.",
      "The products came out of the same habit. Writ exists because my audio kept landing on the wrong device between calls. Dubs exists because I was briefing agents from memory on walks. Neither started as a product. They started as parts of my own day that were worse than they needed to be, and at some point I stopped treating the fixing as a distraction from the work.",
      "The specs I once wrote for a human assistant now go to agents, the same discipline with a faster executor. Software stopped being the tool that supported the work. It became the medium the work happens in.",
    ],
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

export const portfolioWorldIndexSections = [
  { id: "about", title: "About", type: "nodes", nodeIds: ["bradley"] },
  { id: "threads", title: "Threads", type: "threads" },
  { id: "operations", title: "Operations", type: "nodes", nodeIds: ["infamous", "music-practice", "systems-consulting"] },
  { id: "campaign", title: "Music promotions systems", type: "nodes", nodeIds: ["kickoff", "pitching", "reporting"] },
  { id: "client", title: "Client systems", type: "nodes", nodeIds: ["real-estate", "touring"] },
  { id: "personal", title: "Personal systems", type: "nodes", nodeIds: ["personal-os"] },
  { id: "products", title: "In Production", type: "nodes", nodeIds: ["dubs", "writ", "yoohoo", "alarm"] },
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
