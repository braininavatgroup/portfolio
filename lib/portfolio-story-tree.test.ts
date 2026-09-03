import { describe, expect, it } from "vitest";
import {
  STORY_TREE_JUNCTION_RATIO,
  STORY_TREE_MIN_TRUNK,
  storyTreeJunction,
} from "./portfolio-story-tree";

describe("storyTreeJunction", () => {
  it("drops the trunk straight down from the root, part-way to the stories", () => {
    const root = { x: 448, y: 150 };
    const stories = [
      { x: 230, y: 350 },
      { x: 370, y: 410 },
      { x: 525, y: 410 },
      { x: 665, y: 350 },
    ];

    const junction = storyTreeJunction(root, stories);

    expect(junction.x).toBe(root.x);
    expect(junction.y).toBeCloseTo(150 + (380 - 150) * STORY_TREE_JUNCTION_RATIO);
    for (const story of stories) expect(story.y).toBeGreaterThan(junction.y);
  });

  it("keeps a minimum trunk when a story sits beside or above the root", () => {
    const root = { x: 600, y: 120 };

    expect(storyTreeJunction(root, [{ x: 400, y: 110 }])).toEqual({
      x: 600,
      y: 120 + STORY_TREE_MIN_TRUNK,
    });
    expect(storyTreeJunction(root, [])).toEqual({ x: 600, y: 120 + STORY_TREE_MIN_TRUNK });
  });
});
