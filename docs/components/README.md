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
| [PortfolioReadingRoom](./PortfolioReadingRoom.md) | The responsive workspace shell | `/design#reading-room` |
| [PortfolioContents](./PortfolioContents.md) | Reading Room navigation | `/design#contents` |
| [PortfolioWorld](./PortfolioWorld.md) | The spatial map (2D canvas) | `/design#world` |
| [PortfolioReader](./PortfolioReader.md) | The fixed dossier | `/design#reader` |
| [PortfolioChat](./PortfolioChat.md) | The assistant dock | `/design#chat` |
| [PortfolioNodeMark](./PortfolioNodeMark.md) | The register mark | `/design#marks` |
| [CursorInstrument](./CursorInstrument.md) | The site cursor | `/design#cursor` |
| [PortfolioAnalytics](./PortfolioAnalytics.md) | Replay consent and its control | `/design#analytics` |
| [PortfolioFeedback](./PortfolioFeedback.md) | Reviewer notes for Bradley on the preview | none, see sheet |
| [MacMenuBar](./MacMenuBar.md) | Live macOS menu bar over a captured panel | none, see sheet |
| [ReaderCarousel](./ReaderCarousel.md) | Auto-scrolling strip of gallery assets | none, see sheet |
| [TouringDemo](./TouringDemo.md) | Interactive tour advance | `/demos/touring` |

## Avatar

| Sheet | Component | Gallery |
| --- | --- | --- |
| [AvatarOverlay](./avatar/AvatarOverlay.md) | The avatar's mount point and renderer lifecycle | `/design#avatar` |
| [AvatarStageActor](./avatar/AvatarStageActor.md) | Screen-pixel placement in an orthographic canvas | `/design#avatar` |
| [AvatarAssetAdapter](./avatar/AvatarAssetAdapter.md) | The rigged GLB plus its motion library | `/design#avatar` |
| [AvatarBoundary](./avatar/AvatarBoundary.md) | Contains renderer and lazy-load failures | `/design#avatar` |
| [useAvatarStage](./useAvatarStage.md) | Runtime, registrations and viewport effects | `/design#avatar` |
| [useBrainFoodSession](./useBrainFoodSession.md) | Live-map Brain Food controls and state | `/design#composition` |

## Standalone work samples

| Sheet | Component | Route |
| --- | --- | --- |
| [QuarterlyDashboard](./QuarterlyDashboard.md) | Interactive pitch-conversion dashboard | `/demos/quarterly-dashboard` |
| [QuarterlyDashboardPreview](./QuarterlyDashboardPreview.md) | Working dashboard embed | `/design` |

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
