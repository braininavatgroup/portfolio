# EditableText

Source: [`components/editor/EditableText.tsx`](../../../components/editor/EditableText.tsx) ·
No `/design` section (see Pitfalls) · Tests: `components/editor/EditableText.test.tsx`

Editable rendering for one static string. Outside an activated writing session
— a development build with `?edit=1` — it renders exactly the element the
caller asked for, holding the base value, with no wrapper and no extra
attributes. Inside one it swaps in
[`ActiveEditableText`](./ActiveEditableText.md) through a lazy boundary, so the
interactive half is never in a production bundle. Also exports
`useEditorActive` and `useEditableContent` — the latter for attribute strings
such as a placeholder, which cannot host a caret.

## Props

`path` and `value` required; `as` defaults to `"span"`, `multiline` opts into
newline handling. Every other prop is forwarded to the created element. See
[`EditableTextProps`](../../../components/editor/EditableText.tsx).

## Requires

Nothing in production. In development the store must be activated for the
interactive path to appear, which [`DevEditorGate`](./DevEditorGate.md) does —
normally via [`ContentEditorProvider`](./ContentEditorProvider.md). `path` must
match one the writing endpoint knows, or the save returns a conflict.

## Example

```tsx
import { EditableText, useEditableContent } from "components/editor/EditableText";

export function EditableTextExample() {
  // Outside an activated session this renders exactly `as` with `value` and
  // nothing else — no wrapper, no attributes. `path` addresses the string in
  // the content store; it must match the path the writing endpoint knows.
  const placeholder = useEditableContent("chat.placeholder", "Ask about a project");

  return (
    <article>
      <EditableText as="h2" path="records.dubs.label" value="Dubs" />
      <EditableText
        as="p"
        multiline
        path="records.dubs.body"
        value="A music promotions system."
      />
      <input placeholder={placeholder} readOnly />
    </article>
  );
}
```

## Pitfalls

- **`value` is the base, not the current text.** The rendered string is the
  session override when one exists. Reading `value` back tells you what shipped,
  not what the user sees.
- **`as` must be able to hold text.** A void element gets `contentEditable` in
  writing mode and silently refuses the caret.
- **Two `EditableText`s sharing a `path` stay in sync**, since the store is the
  source of truth. Deliberate, but an accidental collision looks haunted.
- **`multiline` changes what is read back**: `innerText` rather than
  `textContent`, with trailing newlines trimmed.
- **No `/design` specimen, deliberately.** Activating the editor store is
  one-way — there is no deactivate — so a gallery specimen would leave every
  editable string on that page writing to the local endpoint. Run the site with
  `?edit=1` instead.
