# MacMenuBar

Source: [`components/MacMenuBar.tsx`](../../components/MacMenuBar.tsx) ·
Tests: `lib/mac-menu-bar.test.ts`, `components/PortfolioReader.test.tsx`

A macOS menu bar rendered live above a captured panel, so the panel can sit on
the centre line of any reader column while the bar fills the column's width.
The items are real captures of the menu bar on Bradley's machine, exported as
dark template glyphs and listed with their widths in
[`lib/mac-menu-bar.ts`](../../lib/mac-menu-bar.ts). `layoutMacMenuBar` there is
the whole rule: the centre icon is pinned to the midline, spacing shrinks from
`maxGap` toward `minGap`, and only then are items shed, leftmost on screen
first, which is how macOS hides overflowing menu extras.

`MacMenuBar` measures its container with `ResizeObserver` and writes each side's gap to
`--mac-menu-bar-gap-left` and `-right`. `MacPanelFrame` stacks the bar over an `<img>`; the reader
uses it for any gallery asset whose structure declares `chrome: "mac-menu-bar"`.

## Props

`MacMenuBar` takes an optional `spec`, defaulting to `WRIT_MENU_BAR`.
`MacPanelFrame` takes `src`, `alt`, and optional `loading`, `width`, and `height`.
Supply intrinsic dimensions so lazy captures reserve their ratio before loading.

## Requires

An ancestor defining `--ink` and `--mac-menu-bar-glyph-invert`, normally
`.portfolio-composition`, so the active-item highlight resolves and the glyphs
invert in dark mode. Panel captures must be transparent PNGs on a canvas whose
horizontal centre is the panel's own centre; every Writ capture shares one
600px-wide canvas and renders at native scale, so all are the same size.

## Example

```tsx
import { MacMenuBar, MacPanelFrame } from "components/MacMenuBar";

export function MacMenuBarExample() {
  // The bar fills whatever column it sits in, keeps the Writ icon on the
  // midline, and re-spaces or sheds items as the column resizes. The panel
  // frame hangs a captured panel from it; the capture's canvas is centred on
  // the panel so centring the image centres the panel under the icon.
  return (
    <div className="portfolio-composition" style={{ width: 560 }}>
      <MacMenuBar />
      <MacPanelFrame
        alt="Writ output priority list"
        src="/visuals/writ/output-priority.png"
      />
    </div>
  );
}
```

## Pitfalls

- **Reader image rules reach the glyphs.** `.reader-visual-block img` sets
  `width: 100%`; the bar overrides it so each glyph keeps its attribute width.
  A new ancestor rule that stretches images will stretch the bar again.
- **Captures must share a canvas.** A panel cut tight to its own bounds is
  no longer centred on its panel, and it renders at a different scale from
  its neighbours.
- **Dark mode is a token, not a second asset.** Glyphs invert through
  `--mac-menu-bar-glyph-invert`; items that keep their own colour set
  `color: true` in the manifest and are exempt.
