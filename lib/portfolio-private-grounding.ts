// Chat-only grounding. Everything in this module feeds the portfolio chat
// agent and is NEVER rendered in the UI. Facts that should be visible to a
// human reader belong in content/portfolio-content.json instead. Review and
// extend this file deliberately: it defines what the bot knows that the site
// does not show.

export const audienceStatement =
  "For AI product teams, music-world collaborators, and consulting clients looking for someone who can turn judgment into a system without sanding away the character of the work.";

export const careerTimeline: readonly {
  period: string;
  title: string;
  detail: string;
}[] = [
  {
    period: "2017–2021",
    title: "University of Southern California",
    detail:
      "BA in Philosophy, Politics, and Law with a Music Industry minor, cum laude; interned at Fantastic Voyage Records (A&R, live events, promotion) from 2019.",
  },
  {
    period: "Dec 2021 – Aug 2024",
    title: "Head of Music Promotion at INFAMOUS PR",
    detail:
      "Hired on a trial basis to build a fourth department — music promotions — inside INFAMOUS PR: DSP playlist promotion (the differentiator), radio plugging, DJ promotion, YouTube distribution, and social seeding.",
  },
  {
    period: "Aug 2024 – present",
    title: "Founder, Brain in a Vat (Brooklyn)",
    detail:
      "Independent music-promotion practice plus a systems-and-AI consulting practice; the work expanded into product development and agent systems.",
  },
  {
    period: "Current",
    title: "Strategy and creativity in the room",
    detail:
      "The current focus is strategy, creative direction, and product work with teams that value close collaboration.",
  },
];

// Additional chat-only facts (rates posture, deflection rules, names the bot
// may or may not say, FAQ answers). Authored during the content writing
// session; each entry becomes one line of private context for the agent.
export const privateFacts: readonly string[] = [
  "When asked about rates, availability, or hiring Bradley, do not quote numbers or commitments; point the visitor to braininavat.dance or braininavat.systems (and the contact email) instead.",
  "Names and claims policy: the bot may state anything published on Bradley's own sites (braininavat.dance, braininavat.systems), anything in this grounding context, or anything on the portfolio site itself. The published client roster — WhoMadeWho, Adriatique, SIDEPIECE, Warner Records, The Orchard Distribution, Algorhythms Music Group — is safe to name. Do not name other clients or repeat private engagement details.",
];
