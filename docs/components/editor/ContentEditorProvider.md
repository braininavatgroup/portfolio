# ContentEditorProvider

Source: [`components/editor/ContentEditorProvider.tsx`](../../../components/editor/ContentEditorProvider.tsx) ·
No `/design` section (see Pitfalls) · Tests: `components/editor/EditableText.test.tsx`

Mounts local writing mode. In a production build it is a pure pass-through and
[`DevEditorGate`](./DevEditorGate.md) is never imported; in development it
renders its children plus the gate behind a `<Suspense>`, and the gate decides
whether anything actually activates.

## Props

`children` only.

## Requires

Nothing. It is designed to be mounted unconditionally in the root layout — the
production check is inside, not at the call site, so no caller has to remember
the gate.

## Example

```tsx
import { ContentEditorProvider } from "components/editor/ContentEditorProvider";

export function ContentEditorProviderExample() {
  // Mounted once, wrapping the app in the root layout. In a production build
  // it is a pass-through and the gate is never even imported.
  return (
    <ContentEditorProvider>
      <main>The site.</main>
    </ContentEditorProvider>
  );
}
```

## Pitfalls

- **Mount it once.** A second provider opens a second session against the same
  endpoint.
- **It does not activate anything by itself.** Without `?edit=1` the gate is
  loaded and does nothing, which is the intended production-parity behaviour and
  also the usual reason writing mode "isn't working".
- **The gate is dynamically imported**, so the first `?edit=1` load pays a chunk
  fetch before any element becomes editable.
- **No `/design` specimen, deliberately.** Activating the editor store is
  one-way — there is no deactivate — so a gallery specimen would leave every
  editable string on that page writing to the local endpoint. Run the site with
  `?edit=1` instead.
