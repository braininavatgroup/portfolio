// Canned data and stubs for the /design gallery. Fixtures live here rather
// than in components/ so no production component grows a gallery-only branch.

import type { AvatarSnapshot } from "../../lib/avatar/runtime";
import type { AskPortfolio } from "../../lib/portfolio-chat-client";
import type { PortfolioGroundingEvidence } from "../../lib/portfolio-grounding";
import type {
  PortfolioWorldFamily,
  PortfolioWorldRegister,
} from "../../lib/portfolio-world";

export const galleryFamilies: readonly PortfolioWorldFamily[] = [
  "identity",
  "story",
  "operation",
  "component",
  "engagement",
  "product",
];

/** The register each family carries in the live content, for the mark grid. */
export const galleryFamilyRegister: Record<
  PortfolioWorldFamily,
  PortfolioWorldRegister
> = {
  identity: "identity",
  story: "story",
  operation: "warm",
  component: "bridge",
  engagement: "bridge",
  product: "cool",
};

const galleryEvidence: readonly PortfolioGroundingEvidence[] = [
  {
    id: "gallery-evidence-reporting",
    title: "Music Promo Campaign Reporting",
    excerpt:
      "Placements are reconciled against the campaign record before anything is reported.",
    href: "/?view=graph#reporting",
  },
  {
    id: "gallery-evidence-dubs",
    title: "Dubs",
    excerpt: "A spoken document you can walk and talk back to.",
    href: "/?view=graph#dubs",
  },
];

const galleryAnswer =
  "This is a gallery fixture, not the production Guide. It reveals a canned answer so the answer and inline evidence states are visible without a network call [E1] [E2].";

/**
 * A stand-in for `streamPortfolioAnswer`. It emits the same event shapes the
 * real transport does, on a timer, and never touches the chat API.
 */
export const galleryAskPortfolio: AskPortfolio = async (question, options) => {
  const { onEvent, signal } = options;
  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => resolve(), ms);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });

  onEvent({ type: "turn_mode", mode: "portfolio" });
  await wait(120);
  onEvent({ type: "evidence", evidence: [...galleryEvidence] });

  for (const word of `You asked: “${question}”. ${galleryAnswer}`.split(" ")) {
    await wait(24);
    onEvent({ type: "answer_delta", delta: `${word} ` });
  }

  onEvent({ type: "done" });
};


/** Keeps the analytics preference fixture out of real browser storage. */
export function createMemoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial) values.set("portfolio_analytics_consent", initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

export function galleryAvatarSnapshot(
  overrides: Partial<AvatarSnapshot> = {},
): AvatarSnapshot {
  return {
    phase: "idle",
    animation: "idle",
    position: { x: 0, y: 0 },
    motion: null,
    facing: "front",
    swimHeading: null,
    visible: true,
    fitHeight: null,
    failed: false,
    ready: true,
    ...overrides,
  };
}
