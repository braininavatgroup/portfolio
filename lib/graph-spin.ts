// The graph spins ambiently in the overview, but domain camera framing uses
// static node positions, so a selected domain must ease the graph back to its
// canonical orientation for the frame to match (BIV-304).
export const ambientSpinStep = 0.00045;

const TAU = Math.PI * 2;
const aligningRate = 0.08;
const snapEpsilon = 0.001;

const normalize = (angle: number) => ((angle % TAU) + TAU) % TAU;

export function nextGraphSpin(
  current: number,
  { spinning, aligning }: { spinning: boolean; aligning: boolean },
): number {
  if (aligning) {
    const normalized = normalize(current);
    const signed = normalized > Math.PI ? normalized - TAU : normalized;
    const eased = signed * (1 - aligningRate);
    if (Math.abs(eased) < snapEpsilon) return 0;
    return normalize(eased);
  }
  if (spinning) return normalize(current + ambientSpinStep);
  return current;
}
