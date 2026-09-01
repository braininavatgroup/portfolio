# DevEditorGate

Source: [`components/editor/DevEditorGate.tsx`](../../../components/editor/DevEditorGate.tsx) ·
No `/design` section (see Pitfalls) · Tests: `components/editor/EditableText.test.tsx`

Development-only activation for writing mode, and a default export. Renders
nothing. On mount it checks for `?edit=1`; if present it activates the editor
store, opens a session against the local writing endpoint, and injects the
hover and focus outline styles for `[data-editable-path]` elements using the
existing `--ink` token rather than a new colour.

## Props

None.

## Requires

A browser and the local writing endpoint that
[`initEditorSession`](../../../lib/editor/session-client.ts) talks to. Normally
mounted by [`ContentEditorProvider`](./ContentEditorProvider.md) rather than
directly.

## Example

```tsx
import { DevEditorGate } from "components/editor/DevEditorGate";

export function DevEditorGateExample() {
  // Renders nothing. Normally mounted by ContentEditorProvider rather than
  // directly; it activates the store only when the URL carries ?edit=1.
  return (
    <>
      <DevEditorGate />
      <p>Load this page with ?edit=1 to activate writing mode.</p>
    </>
  );
}
```

## Pitfalls

- **The `?edit=1` check runs once, on mount.** Adding the parameter with a
  client-side navigation does not activate writing mode; the page has to load
  with it.
- **The injected `<style>` is removed on unmount**, so the outlines vanish while
  the store stays active if the gate unmounts without the session closing.
- **Session failures are silent by design** — `initEditorSession` is fired and
  not awaited. [`EditorStatusLine`](./EditorStatusLine.md) is where a failure
  becomes visible.
- **No `/design` specimen, deliberately.** Activating the editor store is
  one-way — there is no deactivate — so a gallery specimen would leave every
  editable string on that page writing to the local endpoint. Run the site with
  `?edit=1` instead.
