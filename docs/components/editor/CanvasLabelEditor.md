# CanvasLabelEditor

Source: [`components/editor/CanvasLabelEditor.tsx`](../../../components/editor/CanvasLabelEditor.tsx) ·
No `/design` section (see Pitfalls) · Tests: `components/PortfolioWorld.test.tsx`

An anchored single-line input for map labels, which are painted into a canvas
and so cannot host a browser caret. It borrows the label's typography, writes
the draft into the editor store on every keystroke so the canvas redraws live,
saves on Enter or blur, restores on Escape, and unmounts. Development-only, and
a default export.

## Props

`anchor` and `onClose`, both required. `anchor` carries the content path, the
base and initial strings, the measured `rect`, the label's alignment and
whether the map is in its compact layout — see
[`CanvasLabelAnchor`](../../../components/editor/CanvasLabelEditor.tsx).

## Requires

A **positioned ancestor**: the input is `position: absolute` and its `left` and
`top` come straight from `anchor.rect`, in that ancestor's coordinate space. On
the map that ancestor is the world element the canvas sits in. It also needs an
active writing session, since saving goes through
[`session-client`](../../../lib/editor/session-client.ts).

## Example

```tsx
import { CanvasLabelEditor } from "components/editor/CanvasLabelEditor";
import { useState } from "react";

export function CanvasLabelEditorExample() {
  const [editing, setEditing] = useState(true);

  // Positioned absolutely from `rect`, so it needs a positioned ancestor —
  // on the map that is the world element the canvas sits in.
  if (!editing) return <button onClick={() => setEditing(true)} type="button">Edit</button>;
  return (
    <div style={{ height: 120, position: "relative" }}>
      <CanvasLabelEditor
        anchor={{
          align: "center",
          base: "Dubs",
          compact: false,
          initial: "Dubs",
          nodeId: "dubs",
          path: "records.dubs.label",
          rect: { left: 40, top: 40, width: 96, height: 16 },
        }}
        onClose={() => setEditing(false)}
      />
    </div>
  );
}
```

## Pitfalls

- **The canvas must hide its own text while this is open**, or the label renders
  twice. [`PortfolioWorld`](../PortfolioWorld.md) does that through
  `data-editing-label` on the world element.
- **`rect` is measured, not derived.** Reusing a stale rect after a pan, zoom or
  resize leaves the input somewhere the label no longer is.
- **Blur saves.** Escape has to both `preventDefault` and `stopPropagation`,
  because the map's own Escape handler would otherwise deselect underneath it.
- **`compact` only picks the font size.** It does not reposition; the caller's
  `rect` and `align` already account for the compact layout.
- **No `/design` specimen, deliberately.** Activating the editor store is
  one-way — there is no deactivate — so a gallery specimen would leave every
  editable string on that page writing to the local endpoint. Run the site with
  `?edit=1` instead.
