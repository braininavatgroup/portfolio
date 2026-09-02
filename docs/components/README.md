# Component cheat-sheets

One sheet per component in `components/`, mirroring that directory's shape.
Read the sheet before using or modifying a component; it is shorter than the
source and it records the things the types do not say — what has to be around
the component for it to work, and what breaks silently.

Related: [`docs/design-conventions.md`](../design-conventions.md) for the
styling rules, [`docs/design-tokens.md`](../design-tokens.md) for the token
inventory, and `/design` for the same components rendered in their states.

## The composition

| Sheet | Component | Gallery |
| --- | --- | --- |
| [PortfolioExperience](./PortfolioExperience.md) | The whole accepted composition | `/design#composition` |
| [PortfolioWorld](./PortfolioWorld.md) | The spatial map (2D canvas) | `/design#world` |
| [PortfolioReader](./PortfolioReader.md) | The fixed dossier | `/design#reader` |
| [PortfolioChat](./PortfolioChat.md) | The assistant dock | `/design#chat` |
| [PortfolioNodeMark](./PortfolioNodeMark.md) | The register mark | `/design#marks` |
| [CursorInstrument](./CursorInstrument.md) | The site cursor | `/design#cursor` |
| [PortfolioAnalytics](./PortfolioAnalytics.md) | Replay consent and its control | `/design#analytics` |

## Avatar

| Sheet | Component | Gallery |
| --- | --- | --- |
| [AvatarOverlay](./avatar/AvatarOverlay.md) | The avatar's mount point and renderer lifecycle | `/design#avatar` |
| [AvatarStageActor](./avatar/AvatarStageActor.md) | Screen-pixel placement in an orthographic canvas | `/design#avatar` |
| [AvatarAssetAdapter](./avatar/AvatarAssetAdapter.md) | The rigged GLB plus its motion library | `/design#avatar` |
| [ProceduralAvatar](./avatar/ProceduralAvatar.md) | The primitive-built fallback rig | `/design#avatar` |
| [AvatarDirectorConsole](./avatar/AvatarDirectorConsole.md) | Development-only control room | `/design#avatar` |
| [useAvatarStage](./useAvatarStage.md) | Stage services, registrations and viewport effects | `/design#avatar` |

## Avatar toybox

| Sheet | Module | Gallery |
| --- | --- | --- |
| [useAvatarToyboxSession](./avatar-toybox/useAvatarToyboxSession.md) | All toybox state and physics | `/design#toybox` |
| [AvatarToyboxOverlay](./avatar-toybox/AvatarToyboxOverlay.md) | The portalled full-screen renderer | `/design#toybox` |
| [AvatarToyboxBoundary](./avatar-toybox/AvatarToyboxBoundary.md) | Error boundary around the toybox renderer | `/design#toybox` |

## Writing mode

Development-only inline editing (`?edit=1`). None of it reaches a production
bundle: the interactive halves load through lazy boundaries guarded by
`import.meta.env.DEV`.

These have **no `/design` section**, deliberately. Activating the store is
one-way — there is no deactivate — so a gallery specimen would leave every
editable string on that page writing to the local endpoint. Run the site with
`?edit=1` to see them instead.

| Sheet | Component |
| --- | --- |
| [ContentEditorProvider](./editor/ContentEditorProvider.md) | Mounts writing mode; a pass-through in production |
| [DevEditorGate](./editor/DevEditorGate.md) | Activates on `?edit=1`; injects the editable outlines |
| [EditableText](./editor/EditableText.md) | Editable rendering of one static string |
| [ActiveEditableText](./editor/ActiveEditableText.md) | The contentEditable half, development-only |
| [CanvasLabelEditor](./editor/CanvasLabelEditor.md) | Anchored input for canvas-painted map labels |
| [EditorStatusLine](./editor/EditorStatusLine.md) | Editing / Saving / Saved / Committed |

## How these stay true

`tests/component-sheets.test.ts` fails if a component has no sheet, if a sheet
points at a file that no longer exists, or if a sheet's example has drifted
from [`app/design/sheet-examples.tsx`](../../app/design/sheet-examples.tsx).
That module holds every example as real compiled source, and
`app/design/sheet-examples.test.tsx` mounts the ones that do not need WebGL —
so the examples here are runnable, not illustrative.

Editing an example means editing `sheet-examples.tsx` and copying the marked
region back into the sheet. `node scripts/sync-component-sheets.mjs` does the
copying.
