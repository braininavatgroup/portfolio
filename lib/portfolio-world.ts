// Authored site content lives here (and in lib/portfolio-private-grounding.ts
// for chat-only facts). A "node" is a dot on the map; opening one reads one of
// two content types:
//   - Record: the complete short piece for one thing, readable in the map reader.
//   - Thread: a narrated path through the map — the only long-form type.
// Draft copy and visual placeholders intentionally render on main while the
// portfolio is being composed. Everything under lib/portfolio.ts and
// lib/spatial-graph.ts is presentation scaffolding, not authored site content.

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

export type PortfolioCopyPlaceholderBlock = {
  type: "copy-placeholder";
  id: string;
  prompt: string;
  questions?: readonly string[];
};

export type PortfolioVisualTreatment =
  | "artifact"
  | "annotation"
  | "sequence"
  | "comparison"
  | "demo";

export type PortfolioVisualSourceStatus =
  | "exists"
  | "capture"
  | "redact"
  | "recreate"
  | "unknown";

export type PortfolioVisualBlock = {
  type: "visual";
  id: string;
  status: "planned" | "in-progress" | "ready";
  purpose: string;
  treatment?: PortfolioVisualTreatment;
  sourceStatus?: PortfolioVisualSourceStatus;
  src?: string;
  alt?: string;
  caption?: string;
};

export type PortfolioBodyBlock =
  | string
  | PortfolioCopyPlaceholderBlock
  | PortfolioVisualBlock;

export type PortfolioWorldNode = {
  id: string;
  label: string;
  kind: string;
  family: PortfolioWorldFamily;
  register: PortfolioWorldRegister;
  group: "about" | "operations" | "campaign" | "personal" | "client" | "products" | "threads";
  position: { x: number; y: number };
  summary: string;
  summaryStatus?: "placeholder";
  principle?: string;
  body: readonly PortfolioBodyBlock[];
  projectSlug?: string;
  threadId?: string;
};

export type PortfolioThread = {
  id: string;
  nodeId: string;
  title: string;
  lede: string;
  body: readonly PortfolioBodyBlock[];
  members: readonly string[];
};

export type PortfolioWorldLink = {
  from: string;
  to: string;
  type: "direct" | "lineage" | "story";
  layer: "factual" | "story-root" | "story-membership";
  threadId?: string;
};

const draftCopy = (
  id: string,
  prompt: string,
  questions?: readonly string[],
): PortfolioCopyPlaceholderBlock => ({
  type: "copy-placeholder",
  id,
  prompt,
  ...(questions ? { questions } : {}),
});

const plannedVisual = (
  id: string,
  purpose: string,
  treatment?: PortfolioVisualTreatment,
  sourceStatus: PortfolioVisualSourceStatus = "unknown",
): PortfolioVisualBlock => ({
  type: "visual",
  id,
  status: "planned",
  purpose,
  ...(treatment ? { treatment } : {}),
  sourceStatus,
});

export function portfolioBodyText(
  body: readonly PortfolioBodyBlock[],
): string[] {
  return body.flatMap((block) => {
    if (typeof block === "string") return [block];
    if (block.type === "copy-placeholder") {
      return [
        `[DRAFT COPY PLACEHOLDER — not a Bradley fact] ${block.prompt}`,
        ...(block.questions ?? []).map((question) => `Draft question: ${question}`),
      ];
    }
    if (block.status !== "ready") {
      return [
        `[PLANNED VISUAL — not published evidence] ${block.purpose}`,
      ];
    }
    return [
      `Visual: ${block.caption ?? block.alt ?? block.purpose}`,
    ];
  });
}

export const portfolioThroughline =
  "Make complexity legible enough to act on.";

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
    summary: "Hey, I'm Bradley. I make complexity legible enough to act on. Thanks for checking out my portfolio!",
    body: [
      "I run Brain in a Vat Group, which includes a music promotions agency, a systems and AI consulting practice, and a product studio where I've been developing software.",
      "Before founding BiV, I launched and led the music-promotions division at INFAMOUS PR. Prior to that, I studied Philosophy, Politics, and Law, with a Music Industry minor, at the University of Southern California.",
      "Beyond my work, I enjoy: raving, arguing about the philosophy of consciousness, trading sheep for brick over a Catan board, and the ongoing search for New York City's finest hamburger.",
      plannedVisual(
        "about-documentary",
        "Find the right documentary image or artifact for Bradley and the three Brain in a Vat practices without turning About into a résumé graphic.",
        "artifact",
      ),
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
    summary: "Where the practice began: a music-promotions department built from scratch at one of electronic music's leading PR agencies.",
    body: [
      "By 2021, INFAMOUS PR had spent fifteen years at the top of electronic-music publicity. Its craft is the long campaign — albums, tours, narratives — while the incentives of streaming economy were shifting dance music's release cycle towards singles and EPs. That gap is where they hired me: a fourth department, built for exactly that kind of release.",
      "The department grew into a suite of services shaped release by release with client feedback — DSP playlist promotion first, always the differentiator, then radio, DJ promotion, YouTube distribution, and social seeding. It is also where I learned the lesson the rest of this site keeps applying: the shape of the work is itself something you can change.",
      plannedVisual(
        "infamous-service-evolution",
        "Show how the fourth department and its service offering developed release by release.",
        "sequence",
        "recreate",
      ),
    ],
  },
  {
    id: "music-practice",
    label: "Brain in a Vat Music Promotions Agency",
    kind: "Music promotion",
    family: "operation",
    register: "warm",
    group: "operations",
    position: { x: 31, y: 85 },
    summary: "[Summary in progress]",
    summaryStatus: "placeholder",
    body: [
      draftCopy(
        "music-practice-introduction",
        "Introduce Brain in a Vat Music Promotions Agency and establish what distinguishes the practice.",
      ),
      draftCopy(
        "music-practice-service-evolution",
        "Explain the services and their evolution through iteration, ending with the three campaign systems: kickoff, pitching, and reporting.",
      ),
      plannedVisual(
        "music-practice-evolution",
        "Show how the service offering developed through repeated campaign work and client feedback.",
        "sequence",
      ),
      "Two years in, we've delivered 250 campaigns spanning four service lines — DSP promotion, radio, social seeding, and press. The full roster and rates live at braininavat.dance.",
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
    summary: "Audit the operation, implement the high leverage opportunities, maintain and improve the systems.",
    principle: "Foundation first.",
    body: [
      draftCopy(
        "consulting-opening",
        "Complete the opening formulation: “Consulting is XXXX offered to other teams,” while retaining the systems optimization, custom software, and applied AI framing.",
      ),
      "What clients buy is simpler — less manual work, fewer tools that don't talk to each other, and AI that runs reliably because it was built around the knowledge and tools that already exist.",
      plannedVisual(
        "consulting-engagement-loop",
        "Explain the audit, implementation, and ongoing maintenance loop as one legible engagement model.",
        "sequence",
        "recreate",
      ),
      "Every engagement starts with an audit, because dependable systems sit on a legible account of the business. The audit maps the operation and produces a priced, prioritized plan; then I build the working systems, and a retainer keeps them monitored and tuned.",
      "Two engagements are documented here as case studies: a real-estate deal tracker and a tour advance system. The practice lives at braininavat.systems.",
    ],
  },
  {
    id: "product-studio",
    label: "Brain in a Vat Product Studio",
    kind: "Product studio",
    family: "operation",
    register: "warm",
    group: "operations",
    position: { x: 55, y: 61 },
    summary: "[Summary in progress]",
    summaryStatus: "placeholder",
    body: [
      draftCopy(
        "product-studio-record",
        "Draft the Product Studio record and explain how Dubs, Writ, and Yoohoo emerge from the operating practices.",
        [
          "What makes this a studio rather than simply a collection of personal tools?",
          "What is the honest current operating model and maturity?",
        ],
      ),
      plannedVisual(
        "product-studio-relationship",
        "Show the relationship between the operating practices, recurring problems, and Dubs, Writ, and Yoohoo.",
        "sequence",
        "recreate",
      ),
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
    summary: "The keyboard shortcut that turns a client’s “let’s do it” into the correct Airtable records, [Drive and Fillout details in progress], a live invoice, a folder, and a drafted kickoff email in under a minute.",
    principle: "Design the loop rather than do the task.",
    body: [
      "Every campaign starts at the same dangerous moment. A signed confirmation means a client is ready to pay, and it is the worst possible time to disappear into administrative work. Kickoff compresses that work into one keyboard shortcut: client and deal records, the invoice, the campaign folder, and a drafted kickoff email carrying a payment link and one asset-request form per campaign. Roughly thirty minutes across four apps became about one, and invoicing stopped being a chase.",
      plannedVisual(
        "kickoff-sequence",
        "Show the roughly thirty-minute, four-app administrative process collapsing into one guided sequence that still leaves commitment human.",
        "comparison",
        "capture",
      ),
      "The design argument is restraint. The automation assembles; it never commits. Every step is a prefilled dialog I can cancel, and the email stays a draft until I send it. Assets we already hold get attached on the way out, so clients never re-enter what we already have.",
      "The same restraint runs the asset workflow, which replaced email threads where files got lost and re-versioned across a dozen messages. Every asset lives on our side rather than as a link into the client's storage, because client-hosted files change and permissions vanish mid-campaign. Speed is only half the payoff. The other half is service: nothing gets lost, nothing goes stale, and the campaign starts while the client is still excited.",
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
    summary: "Weekly curator targeting driven by recorded taste, with the one read the data can't make kept human.",
    principle: "Taste is encodable. The approval step stays human.",
    body: [
      "Pitching is where the practice's judgment lives, and the system is built on one idea: taste can be recorded, and recorded taste can drive targeting. It started small and painful. A spreadsheet logged every curator's adds, passes, and feedback, and midnights went to copying hundreds of personalized pitch emails by hand until mail merge made real segments possible. From there it grew into real infrastructure.",
      "Two databases carry it now, one record per curator with their playlists rolling up underneath. A curator gets at most one pitch a week, no matter how many campaigns are live. Campaigns and playlists share a genre ontology. Each week the system matches them, dedupes against every prior pitch, and produces a draft pitch list with the reasoning already worked out. My review adds the one thing the ontology deliberately leaves out, whether a track reads commercial or underground. That single call sends two same-genre tracks to different playlists.",
      plannedVisual(
        "pitching-targeting-model",
        "Make the curator records, playlist rollups, shared genre ontology, deduplication, and final human review gate inspectable as one system.",
        "sequence",
        "recreate",
      ),
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
    summary: "A daily pipeline that finds wins, verifies the evidence, and drafts every client report.",
    principle: "Judgment does not scale until it is specified.",
    body: [
      "Reporting is where the practice proves itself, and it nearly drowned the practice instead. It once ate close to three days of every week, all of it spent collecting evidence of work already done and assembling it into spreadsheets, at the direct expense of the work itself.",
      "I invented the process, refined it by hand for years, and automated fragments with macros. The turning point was delegation. Handing it to an assistant with no background in music forced me to write down judgment I had been carrying in my head, and teaching turned into managing, improving the system from outside the weeds. Full automation is the same discipline with a faster executor. It needs a precise spec, written for someone with no context.",
      "That judgment now lives in a versioned rules document the model reads on every run, with commitments like silence is not a pass, never invent, and never downgrade an outcome. Code re-checks every conclusion the model draws. The one decision with consequences beyond the report, whether a curator becomes auto-pitchable, sits outside the model entirely in a small deterministic gate.",
      plannedVisual(
        "reporting-pipeline",
        "Trace the daily pipeline from source evidence through model judgment, deterministic verification, the auto-pitchable gate, dashboards, and drafted client reports.",
        "sequence",
        "recreate",
      ),
      "Today the pipeline runs daily, dashboards refresh through the day, and client emails arrive as drafts for a personal pass. What was roughly sixteen hours of reporting per campaign, spread across eight report updates in the month after a release, now takes about an hour of my week in total, with fewer errors, not more.",
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
    summary: "A brokerage team's deal operation mapped end to end, with explicit stages and named owners, and an MVP dashboard sketched inside the Google tools they already use.",
    principle: "The bottleneck is ambiguity, not capability.",
    body: [
      "For one residential brokerage team, a single deal crossed six tools between pitch and close, and the only thing connecting them was the coordinator's attention. Agents tracked deals in notebooks and verbal updates, so the operational record ran a step behind reality. The rules existed and the data existed. A person was carrying information between them by hand.",
      "The first deliverable was an operations map. The deal lifecycle became explicit stages, each with a named condition for advancing and a named owner for every hop between tools. The map also surfaced the engagement's hard constraint. The team's mandated brokerage platform has no API, so anything automated has to work around it, inside Google, where the team already lives.",
      plannedVisual(
        "real-estate-operation-map",
        "Compare the six-tool, attention-carried deal process with the explicit stages, advancement conditions, owners, and Google-based MVP.",
        "comparison",
        "recreate",
      ),
      "The build honored one more constraint: no new tools. Teams keep the software they already pay for and like. From the map I sketched an MVP of the clearest low-hanging fruit, a quarterly dashboard derived from the team's own spreadsheets, built entirely inside Google. Once the states were on paper, the machine's share of the work was obvious.",
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
      "The tool gives each advance one structured record, one artist and one show. It renders a clean day-sheet as a PDF and a calendar entry, and it chases the promoter for whatever is missing. The chase happens where promoters already live, in email. It drafts its nudge into the live thread, in the manager's voice, addressed to the promoter alone, and it never sends. An automated “you're late” that copied the artist would be a credibility landmine.",
      "The keystone is a field registry, one table that names each field's owner, whether it's required, and where it appears. The owner is the manager, the promoter, the artist, or the system itself. Forms, day-sheet, and chase engine are all projections of that table. Starting an advance takes four fields, because setup friction is the biggest adoption risk, and an advance that used to sprawl across a dozen email threads now has a single record with a single owner for every fact on it.",
      plannedVisual(
        "touring-field-registry",
        "Show the field registry projecting one authoritative advance into forms, the day-sheet, calendar entry, and draft-only chase engine.",
        "sequence",
        "recreate",
      ),
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
      "The businesses run on discipline that starts at the desk, and the desk is set up like an instrument. Every action I take more than a few times a day has a physical trigger under a finger, on a Stream Deck key, a remapped keypad, or a gesture, and the tuning is never finished. The rule matters more than the gear.",
      "All of it protects attention. Whatever comes to mind gets captured instantly into an inbox I trust, then processed later, so nothing interrupts the current thread of work. Text goes to Drafts, tasks to OmniFocus, and durable notes to Obsidian. Even the audible part of the day is instrumented; long reading and agent updates reach me through Dubs while I walk.",
      plannedVisual(
        "personal-os-map",
        "Map the physical controls, capture destinations, review discipline, and spec-driven agent delegation as one personal operating system.",
        "sequence",
        "capture",
      ),
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
      plannedVisual(
        "dubs-loop",
        "Demonstrate the listen, inline voice or text capture, linked-library, and hand-to-agent loop without requiring the reader to infer the interaction.",
        "demo",
        "capture",
      ),
      "Dubs closes the loop. Documents flow from their original sources into one inbox. You move between reading and listening, capture reactions inline by voice or text without losing your place, and pick up at the same spot on any device. What accumulates is a linked library of documents, annotations, and notes, raw material for your own thinking and exactly the context an agent needs.",
      "Status: alpha, with a small TestFlight group, finding product-market fit. The proof will be repeated use of the listen, capture, and hand-to-agent loop. The core bet is falsifiable by design, since audio-first could turn out to be the wrong balance rather than the wrong direction.",
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
      plannedVisual(
        "writ-priority-behavior",
        "Show the separate input and output priority lists and the cases where Writ deliberately leaves the current device untouched.",
        "annotation",
        "capture",
      ),
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
      plannedVisual(
        "yoohoo-state",
        "Show one durable server-owned record moving from open question through first valid answer to an exactly-once resolved state.",
        "sequence",
        "recreate",
      ),
      "The notification is a view; the server owns the record. The first valid answer wins, and a resolved question can never execute twice.",
      "The line on AI is deliberate. A model may draft content and quiet routine updates. It may never suppress a question, and it never decides authorization, recipients, or resolution. Every failure falls back to a deterministic path, so an AI outage can't silently lose information.",
      "Status: specified. An approved product contract, awaiting implementation.",
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
      "The personal operating system, Dubs, Writ, and Yoohoo compose this reading.",
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
      plannedVisual(
        "thread-playable-instruments",
        "Reuse the strongest Personal OS, Dubs, Writ, and Yoohoo visuals as one sequence of tools becoming fluent enough to disappear.",
        "sequence",
      ),
      "Each product holds that standard somewhere different. Dubs is the fullest test, a thought captured mid-stride without breaking it. Writ passes by disappearing, audio that stays where you put it from a tool you never open. Yoohoo pushes the question past the desk and asks whether notifications can hold state without creating more noise.",
    ],
    nodeId: "thread-making-work-playable",
    members: ["personal-os", "dubs", "writ", "yoohoo"],
  },
  {
    id: "choosing-what-not-to-automate",
    title: "Choosing what not to automate",
    lede: "Automation begins with a boundary. Some decisions gain from more information and faster execution but still lose their value when nobody owns the final call.",
    body: [
      "Every campaign moves through three systems, and each one draws its automation boundary in a different place. None of the placements is an accident.",
      "Kickoff puts the boundary at the moment of commitment. A client who confirms is ready to pay, and administrative delay is how invoices go stale, so one shortcut runs the whole sequence. But every step can be abandoned cleanly, and the email at the end stays a draft until I send it. The machine assembles; a person says go.",
      "Pitching keeps the boundary at judgment. Matching, deduplication, and segmentation across thousands of playlists happen without me. The qualitative read the genre ontology can't express stays mine, at a weekly review gate. And the ontology is capped on purpose. You could add qualitative tags forever, and a trained eye is cheaper than that data architecture will ever be.",
      plannedVisual(
        "thread-automation-boundaries",
        "Reuse the campaign-system visuals to compare where commitment, judgment, and deterministic verification remain human.",
        "comparison",
      ),
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
      "The defining move was teaching. Handing my reporting process to an assistant with no domain background forced me to define it better than I ever had for myself, and directing work from outside the weeds became the skill the rest of the work runs on.",
      "Independence compounded it. At Brain in a Vat there were no approvals to wait on and no inherited systems to accommodate. The low-context executor became as often an AI agent as a person, and the agent-driven automation matured into a real operating advantage, built to my own judgment and taste. The advantage became a second practice. Consulting is doing for other teams what I had done for my own operation, turning fuzzy workflows into explicit states and owners inside the tools people already use.",
      plannedVisual(
        "thread-argument-to-instrument",
        "Recompose the strongest operating-system and product visuals as a chronological path from argument to software as the medium of the work.",
        "sequence",
      ),
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
  ["systems-consulting", "real-estate", "direct"],
  ["systems-consulting", "touring", "direct"],
  ["product-studio", "dubs", "direct"],
  ["product-studio", "writ", "direct"],
  ["product-studio", "yoohoo", "direct"],
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
  // intentionally read through the factual field rather than redundant
  // spokes.
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
  { id: "operations", title: "Operations", type: "nodes", nodeIds: ["music-practice", "systems-consulting", "product-studio", "infamous"] },
  { id: "campaign", title: "Music promotions systems", type: "nodes", nodeIds: ["kickoff", "pitching", "reporting"] },
  { id: "client", title: "Client systems", type: "nodes", nodeIds: ["real-estate", "touring"] },
  { id: "personal", title: "Personal systems", type: "nodes", nodeIds: ["personal-os"] },
  { id: "products", title: "In Production", type: "nodes", nodeIds: ["dubs", "writ", "yoohoo"] },
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
