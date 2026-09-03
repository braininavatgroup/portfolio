export const avatarActions = ["swim_lap"] as const;

export type AvatarAction = (typeof avatarActions)[number];

export type PortfolioResponseEffects = {
  avatarAction: AvatarAction | null;
  issues: string[];
};
