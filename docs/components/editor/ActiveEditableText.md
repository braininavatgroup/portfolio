# ActiveEditableText

Source: [`components/editor/ActiveEditableText.tsx`](../../../components/editor/ActiveEditableText.tsx) ·
No `/design` section (see Pitfalls) · Tests: `components/editor/EditableText.test.tsx`

The interactive half of [`EditableText`](./EditableText.md): a
`contentEditable="plaintext-only"` element with plain-text normalisation,
keyboard handling and draft state. It is a default export loaded through a lazy
boundary that only exists under `import.meta.env.DEV`, so the production bundle
never includes this module. Typing schedules a debounced save; blur and Enter
save immediately; Escape restores the last persisted value.

## Props

`ActiveEditableTextProps` — `as`, `path` and `value` required, `multiline`
optional, everything else forwarded. Identical to
[`EditableText`](../../../components/editor/EditableText.tsx)'s, minus the
default for `as`.

## Requires

An activated editor store and an open writing session, since every handler
calls into
[`lib/editor/session-client.ts`](../../../lib/editor/session-client.ts).
Rendering it directly, as the example does, makes the element editable whether
or not a session exists — reach it through `EditableText` instead.

## Example

```tsx
import { ActiveEditableText } from "components/editor/ActiveEditableText";

export function ActiveEditableTextExample() {
  // The interactive half, normally reached only through EditableText's lazy
  // boundary. Rendering it directly makes the element contentEditable whether
  // or not a session is active, so this is a gallery affordance, not a usage
  // pattern.
  return (
    <ActiveEditableText as="h2" path="records.dubs.label" value="Dubs" />
  );
}
```

## Pitfalls

- **React never re-renders the text.** Initial markup is set once through
  `dangerouslySetInnerHTML`; every later change flows through the DOM or the
  sync effect. Trying to drive the content from a prop will not work.
- **Clicks are swallowed at the capture phase.** Text inside a link or button
  edits rather than activating the control — correct in writing mode, and the
  reason a control appears dead when you forgot to leave it.
- **An unchanged edit saves nothing.** Focus, no change, blur cancels the
  scheduled save. That is deliberate: it stops a stray click producing a commit.
- **Paste is always plain text**, and in single-line mode newlines collapse to
  spaces.
- **No `/design` specimen, deliberately.** Activating the editor store is
  one-way — there is no deactivate — so a gallery specimen would leave every
  editable string on that page writing to the local endpoint. Run the site with
  `?edit=1` instead.
