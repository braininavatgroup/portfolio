export const avatarActions = ["swim_lap", "stroll", "dance", "turn", "brain_food"] as const;

export type AvatarAction = (typeof avatarActions)[number];

export type PortfolioResponseEffects = {
  avatarAction: AvatarAction | null;
  issues: string[];
};
