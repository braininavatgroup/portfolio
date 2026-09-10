export type AvatarChatAction = "dance" | "wave" | "swim_lap" | "brain_food";
export type GuideActionAvailability = {
  status: "ready" | "loading" | "hidden" | "unavailable";
  reducedMotion: boolean;
  gameSupported: boolean;
};

// Exact, standalone requests are controls; broader conversation still goes to
// the model. Anchoring the whole utterance avoids matching negation or topics.
function isDirectDanceRequest(question: string) {
  return /^(?:bradley,?\s+)?(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?(?:dance|do (?:a|the) dance|show me (?:a|your) dance)(?: for me)?(?: please)?[.!?]*$/i.test(
    question.trim().replace(/\s+/g, " "),
  );
}

export function directAvatarRequest(question: string): AvatarChatAction | null {
  if (/^(?:please\s+)?(?:(?:can|could) we |let['’]?s )?(?:play|start|launch)(?: the)? brain food(?: game)?(?: please)?[.!?]*$/i.test(question.trim())) return "brain_food";
  if (isDirectDanceRequest(question)) return "dance";
  const request = question.trim().replace(/\s+/g, " ");
  if (/^(?:bradley,?\s+)?(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?(?:wave(?: hello)?|give me a wave)(?: (?:to|for) me)?(?: please)?[.!?]*$/i.test(request)) return "wave";
  if (/^(?:bradley,?\s+)?(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?(?:swim(?: a lap)?|go for a swim|take a swim)(?: for me)?(?: please)?[.!?]*$/i.test(request)) return "swim_lap";
  return null;
}

export function actionUnavailableReason(action: string, availability: GuideActionAvailability): string | null {
  if (availability.status === "unavailable") return "The avatar couldn't load in this browser. You can still explore the portfolio and chat.";
  if (availability.status === "hidden") return "The avatar is hidden. Choose Show avatar to play.";
  if (availability.status === "loading") return "The avatar is still loading. Try again in a moment.";
  if (availability.reducedMotion) return "Animation is paused to respect your reduced-motion preference. You can still explore the portfolio and chat.";
  if (action === "brain_food" && !availability.gameSupported) return "Brain Food needs a keyboard and a larger window.";
  return null;
}

export function actionAcknowledgement(action: AvatarChatAction) {
  if (action === "wave") return "Hello there.";
  if (action === "brain_food") return "Use Arrow keys or WASD to swim through every node. Escape brings you back.";
  return "Here we go.";
}
