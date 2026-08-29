// Chat-only grounding. Everything in this module feeds the portfolio chat
// agent and is NEVER rendered in the UI. Facts that should be visible to a
// human reader belong in lib/portfolio-world.ts instead. Review and extend
// this file deliberately: it defines what the bot knows that the site does
// not show.

export const audienceStatement =
  "For AI product teams, music-world collaborators, and consulting clients looking for someone who can turn judgment into a system without sanding away the character of the work.";

export const careerTimeline: readonly {
  period: string;
  title: string;
  detail: string;
}[] = [
  {
    period: "Origin / 2016",
    title: "Electronic music becomes the native domain",
    detail:
      "Electronic music became the starting point for the work represented here.",
  },
  {
    period: "2021–2024",
    title: "Head of Music Promotion at INFAMOUS PR",
    detail:
      "Led music-promotion strategy and operations at INFAMOUS PR. Representative campaigns and outcomes are being prepared for publication.",
  },
  {
    period: "After 2024",
    title: "The work branches into consulting, development, and agent systems",
    detail:
      "Expanded the same process-modeling work into consulting, product development, and agent systems.",
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
export const privateFacts: readonly string[] = [];
