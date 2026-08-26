import type { AvatarCommand, AvatarTargetId } from "./contracts";

export type AvatarAmbientVariant =
  | { id: "still"; command: null }
  | {
      id: `look:${AvatarTargetId}`;
      command: Extract<AvatarCommand, { action: "lookAt" }>;
    }
  | {
      id: "swim:lap";
      command: Extract<AvatarCommand, { action: "swimRoute" }>;
    };

type ChooseAmbientVariantOptions = {
  previousId: string | null;
  targets: readonly AvatarTargetId[];
  canSwim: boolean;
  random: () => number;
};

export function chooseAmbientVariant(
  options: ChooseAmbientVariantOptions,
): AvatarAmbientVariant {
  const weighted: AvatarAmbientVariant[] = [
    ...Array.from({ length: 5 }, () => ({ id: "still" as const, command: null })),
    ...options.targets.flatMap((target) => [
      { id: `look:${target}` as const, command: { action: "lookAt" as const, target } },
      { id: `look:${target}` as const, command: { action: "lookAt" as const, target } },
    ]),
    ...(options.canSwim
      ? [{ id: "swim:lap" as const, command: { action: "swimRoute" as const, route: "lap" as const } }]
      : []),
  ];
  const alternatives = weighted.filter(
    ({ id }) => id !== options.previousId,
  );
  const choices = alternatives.length > 0 ? alternatives : weighted;
  const index = Math.min(
    choices.length - 1,
    Math.floor(Math.max(0, options.random()) * choices.length),
  );
  return choices[index]!;
}
