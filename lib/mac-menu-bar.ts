// A macOS menu bar rendered live above a captured panel. The panel image is
// pinned to the centre of whatever column it sits in; the menu bar items on
// either side re-space to fill that column and drop, leftmost first, once the
// column is too narrow to hold them at the minimum spacing. Icons are real
// captures of the menu bar items, exported as dark template glyphs.

export type MacMenuBarItem = {
  id: string;
  src: string;
  width: number;
  height: number;
  /** Keeps its own colour instead of following the template glyph tint. */
  color?: boolean;
};

export type MacMenuBarSpec = {
  center: MacMenuBarItem;
  /** Items to the left of the centre icon, ordered from the centre outward. */
  left: readonly MacMenuBarItem[];
  /** Items to the right of the centre icon, ordered from the centre outward. */
  right: readonly MacMenuBarItem[];
  minGap: number;
  maxGap: number;
  edgePadding: number;
};

export type MacMenuBarLayout = {
  /** Spacing on each side, chosen independently so both halves fill the column. */
  leftGap: number;
  rightGap: number;
  left: readonly MacMenuBarItem[];
  right: readonly MacMenuBarItem[];
};

const MENU_BAR_ICON_ROOT = "/visuals/writ/menu-bar";

const icon = (
  id: string,
  width: number,
  height = 30,
  color = false,
): MacMenuBarItem => ({
  id,
  src: `${MENU_BAR_ICON_ROOT}/${id}.png`,
  width,
  height,
  ...(color ? { color: true } : {}),
});

/** The menu bar around the Writ icon on Bradley's machine, centre outward. */
export const WRIT_MENU_BAR: MacMenuBarSpec = {
  center: icon("writ", 16),
  left: [
    icon("cloud", 21),
    icon("spray", 14),
    icon("airpods", 18),
    icon("dots", 16),
    icon("half-circle", 15),
    icon("shield", 13),
  ],
  right: [
    icon("half-rect", 15),
    icon("vivaldi", 16),
    icon("command", 16),
    icon("weather", 48),
    icon("arch", 18),
    icon("toggles", 14),
    icon("location", 6, 28, true),
    icon("clock", 110),
  ],
  minGap: 10,
  maxGap: 22,
  edgePadding: 12,
};

const sideWidth = (items: readonly MacMenuBarItem[], gap: number) =>
  items.reduce((total, item) => total + item.width + gap, 0);

/**
 * Chooses which items fit in a column of the given width with the centre icon
 * pinned to the middle. Each side spreads to fill its half: spacing shrinks
 * from maxGap toward minGap first; only then are items removed, always the
 * one farthest left on screen, which is how macOS itself hides overflowing
 * menu extras.
 */
export function layoutMacMenuBar(
  spec: MacMenuBarSpec,
  width: number,
): MacMenuBarLayout {
  const available = Math.max(0, width / 2 - spec.center.width / 2 - spec.edgePadding);
  const left = [...spec.left];
  const right = [...spec.right];

  // The left side is ordered centre-outward, so its leftmost item is last.
  while (left.length && sideWidth(left, spec.minGap) > available) left.pop();
  // The right side's leftmost item is the one nearest the centre.
  while (right.length && sideWidth(right, spec.minGap) > available) right.shift();

  const gapFor = (items: readonly MacMenuBarItem[]) => {
    if (!items.length) return spec.maxGap;
    const fixed = items.reduce((total, item) => total + item.width, 0);
    return Math.max(spec.minGap, Math.min(spec.maxGap, (available - fixed) / items.length));
  };

  return { leftGap: gapFor(left), rightGap: gapFor(right), left, right };
}
