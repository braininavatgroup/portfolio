// The Story tree: Bradley sits at twelve o'clock, one trunk drops straight
// down from his mark, and the visible Story lines branch from that junction.
// Pure screen-space geometry so the canvas and the tests share one answer.

export type ScreenPoint = { x: number; y: number };

/** How far down the root-to-stories drop the junction sits. */
export const STORY_TREE_JUNCTION_RATIO = 0.55;
/** The trunk never collapses below this, even if a story sits beside the root. */
export const STORY_TREE_MIN_TRUNK = 24;

export function storyTreeJunction(
  root: ScreenPoint,
  stories: readonly ScreenPoint[],
): ScreenPoint {
  if (stories.length === 0) return { x: root.x, y: root.y + STORY_TREE_MIN_TRUNK };
  const meanY = stories.reduce((sum, { y }) => sum + y, 0) / stories.length;
  const drop = Math.max(
    STORY_TREE_MIN_TRUNK,
    (meanY - root.y) * STORY_TREE_JUNCTION_RATIO,
  );
  return { x: root.x, y: root.y + drop };
}
