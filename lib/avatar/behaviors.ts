import type { AvatarTone } from "./contracts";

type AvatarBehaviorDefinition = {
  id: string;
  clipName: string;
  label: string;
  guidance: string;
  holdMs: number;
  ambientEligible: boolean;
  tone: AvatarTone;
};

const standardHoldMs = 1_600;
const calmTone = {
  energy: "low",
  warmth: "warm",
  confidence: "neutral",
  mischief: "none",
} as const satisfies AvatarTone;

const conversationalTone = {
  energy: "medium",
  warmth: "warm",
  confidence: "assured",
  mischief: "none",
} as const satisfies AvatarTone;

const curiousTone = {
  energy: "medium",
  warmth: "warm",
  confidence: "neutral",
  mischief: "playful",
} as const satisfies AvatarTone;

const uncertainTone = {
  energy: "low",
  warmth: "reserved",
  confidence: "uncertain",
  mischief: "none",
} as const satisfies AvatarTone;

const energeticTone = {
  energy: "high",
  warmth: "warm",
  confidence: "assured",
  mischief: "playful",
} as const satisfies AvatarTone;

const distressedTone = {
  energy: "high",
  warmth: "reserved",
  confidence: "uncertain",
  mischief: "playful",
} as const satisfies AvatarTone;

function behaviorStyle(
  tone: AvatarTone,
  ambientEligible = false,
) {
  return {
    ambientEligible,
    tone,
  };
}

export const avatarBehaviors = [
  { id: "agree_gesture", clipName: "Agree_Gesture", label: "Agree gesture", guidance: "Conversational agreement, acknowledgment, or a calm affirmative answer", holdMs: standardHoldMs, ...behaviorStyle(conversationalTone) },
  { id: "alert", clipName: "Alert", label: "Alert", guidance: "Sudden attention, discovery, or an important warning", holdMs: standardHoldMs, ...behaviorStyle(curiousTone) },
  { id: "angry_to_tantrum_sit", clipName: "Angry_To_Tantrum_Sit", label: "Angry to tantrum sit", guidance: "Comedic frustration or an explicitly requested dramatic reaction", holdMs: standardHoldMs, ...behaviorStyle(distressedTone) },
  { id: "big_wave_hello", clipName: "Big_Wave_Hello", label: "Big wave hello", guidance: "An enthusiastic greeting or farewell", holdMs: 2_200, ...behaviorStyle(energeticTone) },
  { id: "cheer_with_both_hands_1", clipName: "Cheer_with_Both_Hands_1", label: "Big two-hand cheer", guidance: "A strong celebration for a meaningful success", holdMs: standardHoldMs, ...behaviorStyle(energeticTone) },
  { id: "cheer_with_both_hands", clipName: "Cheer_with_Both_Hands", label: "Two-hand cheer", guidance: "A lighter celebration or congratulations", holdMs: standardHoldMs, ...behaviorStyle(energeticTone) },
  { id: "formal_bow", clipName: "Formal_Bow", label: "Formal bow", guidance: "Respectful thanks, an introduction, or a formal sign-off", holdMs: 2_200, ...behaviorStyle(conversationalTone) },
  { id: "groan_holding_stomach_in_sleep", clipName: "Groan_Holding_Stomach_in_Sleep", label: "Groan holding stomach", guidance: "Comedic exhaustion, discomfort, or a requested exaggerated reaction", holdMs: standardHoldMs, ...behaviorStyle(distressedTone) },
  { id: "idle_3", clipName: "Idle_3", label: "Quiet idle", guidance: "Quiet presence when a restrained response is appropriate", holdMs: standardHoldMs, ...behaviorStyle(calmTone, true) },
  { id: "indoor_play", clipName: "Indoor_Play", label: "Indoor play", guidance: "Playful activity or hands-on exploration", holdMs: standardHoldMs, ...behaviorStyle(curiousTone) },
  { id: "joyful_dance_with_hand_sway", clipName: "Joyful_Dance_with_Hand_Sway", label: "Joyful hand-sway dance", guidance: "Relaxed delight, music, or a playful positive response", holdMs: 2_800, ...behaviorStyle(energeticTone) },
  { id: "prone_reach_help", clipName: "Prone_Reach_Help", label: "Prone reach for help", guidance: "An explicitly dramatic plea or slapstick request for help", holdMs: standardHoldMs, ...behaviorStyle(distressedTone) },
  { id: "running", clipName: "Running", label: "Running", guidance: "Urgency, momentum, or going somewhere quickly", holdMs: 1_200, ...behaviorStyle(energeticTone) },
  { id: "shrug", clipName: "Shrug", label: "Shrug", guidance: "Uncertainty, not knowing, or a light it-depends answer", holdMs: standardHoldMs, ...behaviorStyle(uncertainTone) },
  { id: "sneaky_walk", clipName: "Sneaky_Walk", label: "Sneaky walk", guidance: "Mischief, secrecy, or a playful reveal", holdMs: standardHoldMs, ...behaviorStyle(curiousTone) },
  { id: "swim_forward", clipName: "Swim_Forward", label: "Swim forward", guidance: "Swimming, forward effort, or an explicitly aquatic joke", holdMs: standardHoldMs, ...behaviorStyle(energeticTone) },
  { id: "wake_up_and_look_up", clipName: "Wake_Up_and_Look_Up", label: "Wake up and look up", guidance: "Thinking, remembering, noticing, or becoming curious", holdMs: standardHoldMs, ...behaviorStyle(curiousTone) },
  { id: "walking", clipName: "Walking", label: "Walking", guidance: "A calm entrance, exit, or movement toward something", holdMs: 1_200, ...behaviorStyle(conversationalTone) },
  { id: "wave_one_hand", clipName: "Wave_One_Hand", label: "One-hand wave", guidance: "A casual greeting, acknowledgment, or sign-off", holdMs: standardHoldMs, ...behaviorStyle(conversationalTone) },
  { id: "swimming_to_edge", clipName: "swimming_to_edge", label: "Swimming to edge", guidance: "Reaching the end of a swim or an explicitly aquatic transition", holdMs: standardHoldMs, ...behaviorStyle(energeticTone) },
  { id: "orange_justice_cc0", clipName: "Orange_Justice_CC0", label: "Orange Justice", guidance: "A deliberately big, game-like dance or an explicit dance request", holdMs: 2_800, ...behaviorStyle(energeticTone) },
] as const satisfies readonly AvatarBehaviorDefinition[];

export type AllowedAnimation = (typeof avatarBehaviors)[number]["id"];

export const allowedAvatarAnimations = avatarBehaviors.map(
  ({ id }) => id,
) as [AllowedAnimation, ...AllowedAnimation[]];

const behaviorById = new Map<AllowedAnimation, (typeof avatarBehaviors)[number]>(
  avatarBehaviors.map((behavior) => [behavior.id, behavior]),
);

export function getAvatarBehavior(id: AllowedAnimation) {
  const behavior = behaviorById.get(id);
  if (!behavior) throw new Error(`Unknown avatar behavior: ${id}`);
  return behavior;
}

export function formatAvatarBehaviorCatalog() {
  return avatarBehaviors
    .map(({ id, guidance }) => `${id}: ${guidance}`)
    .join("\n");
}

export function expandAvatarSequence(ids: readonly AllowedAnimation[]) {
  return ids.flatMap((id) => {
    const play = { action: "play" as const, animation: id };
    return [
      play,
      { action: "wait" as const, durationMs: getAvatarBehavior(id).holdMs },
    ];
  });
}
