// Canned data and stubs for the /design gallery. Fixtures live here rather
// than in components/ so no production component grows a gallery-only branch.

import type { AvatarSnapshot } from "../../lib/avatar/controller";
import { defaultAvatarTone } from "../../lib/avatar/contracts";
import type { AskPortfolio } from "../../lib/portfolio-chat-client";
import type { PortfolioGroundingEvidence } from "../../lib/portfolio-grounding";
import type { TurnstileRenderer } from "../../lib/portfolio-chat-turnstile";
import type {
  PortfolioVisualBlock,
  PortfolioWorldFamily,
  PortfolioWorldRegister,
} from "../../lib/portfolio-world";

export const galleryFamilies: readonly PortfolioWorldFamily[] = [
  "identity",
  "story",
  "formative",
  "operation",
  "component",
  "personal",
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
  formative: "finding",
  operation: "warm",
  component: "bridge",
  personal: "bridge",
  engagement: "bridge",
  product: "cool",
};

const galleryEvidence: readonly PortfolioGroundingEvidence[] = [
  {
    id: "gallery-evidence-reporting",
    title: "Campaign reporting",
    excerpt:
      "Placements are reconciled against the campaign record before anything is reported.",
    href: "/?view=graph#reporting",
    projectTitle: "Campaign reporting",
  },
  {
    id: "gallery-evidence-dubs",
    title: "Dubs",
    excerpt: "A spoken document you can walk and talk back to.",
    href: "/?view=graph#dubs",
    projectTitle: "Dubs",
  },
];

const galleryAnswer =
  "This is a gallery fixture, not the production assistant. It streams a canned answer so the answering, evidence, and settled states are all visible without a network call.";

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

/** Never renders a widget; the gallery does not run a Turnstile challenge. */
export const galleryRenderTurnstile: TurnstileRenderer = async () => ({
  reset() {},
  remove() {},
});

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
    state: "idle",
    animation: "idle_3",
    currentCommand: null,
    target: null,
    position: { x: 0, y: 0 },
    locomotion: "grounded",
    motion: null,
    facing: "front",
    pointing: null,
    tone: defaultAvatarTone,
    visible: true,
    failed: false,
    ...overrides,
  };
}

export const galleryPlannedVisual: PortfolioVisualBlock = {
  type: "visual",
  id: "gallery-planned-visual",
  status: "planned",
  purpose: "Placeholder for the campaign reporting artifact.",
  treatment: "artifact",
  sourceStatus: "capture",
  format: "image",
};
