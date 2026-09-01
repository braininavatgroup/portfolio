# EditorStatusLine

Source: [`components/editor/EditorStatusLine.tsx`](../../../components/editor/EditorStatusLine.tsx) ·
No `/design` section (see Pitfalls) · Tests: `components/editor/EditableText.test.tsx`

The writing-mode status line, rendered inside the dossier footer. Reports
Editing, Saving, Saved, `Committed <hash>`, or a specific failure. It does not
animate and introduces no new colour. Outside an active writing session it
returns null, so it costs an inactive page nothing but a subscription.

## Props

None. It subscribes to the editor store through `useSyncExternalStore`.

## Requires

Nothing at the call site. The store must be active for it to render anything,
which [`DevEditorGate`](./DevEditorGate.md) arranges.

## Example

```tsx
import { EditorStatusLine } from "components/editor/EditorStatusLine";

export function EditorStatusLineExample() {
  // Renders null unless the editor store is active, so in an ordinary page
  // this contributes no markup at all.
  return (
    <footer>
      <EditorStatusLine />
    </footer>
  );
}
```

## Pitfalls

- **It renders null far more often than not.** An empty footer in development
  usually means the store was never activated, not that the line is broken.
- **`committed` and `error` are distinct outcomes with the same cause.** The
  file save is durable before the Git commit is attempted, so "Saved, but Git
  commit failed" means your text is on disk.
- **`role="status"` makes it a live region.** Text that changes on every
  keystroke would be announced on every keystroke; the states are coarse on
  purpose.
- **No `/design` specimen, deliberately.** Activating the editor store is
  one-way — there is no deactivate — so a gallery specimen would leave every
  editable string on that page writing to the local endpoint. Run the site with
  `?edit=1` instead.
