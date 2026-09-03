# Reading Room implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current world/dossier/floating-chat composition with the approved responsive Reading Room while preserving content, map motion, and chat safety contracts.

**Architecture:** `PortfolioExperience` remains the selection, URL, avatar, and integration owner. A new `PortfolioReadingRoom` owns responsive chrome, panel persistence, slot assignment, and DnD. Existing Reader, World, and Chat components become embeddable controlled views; pure layout and citation helpers keep state transitions independently testable.

**Tech stack:** React 19, TypeScript, Vitest and Testing Library, `react-resizable-panels` v4, `@dnd-kit/react`, `@assistant-ui/react`, Canvas 2D, CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-09-02-reading-room-design.md`

## Global constraints

- Treat the spec and the handoff package README as authority; do not ship any `.dc.html` file.
- Preserve `/api/portfolio-chat`, `AskPortfolio`, NDJSON events, Turnstile, bounded conversation, rate/spend controls, grounding, provider validation, avatar effects, and failure redaction.
- Use `react-resizable-panels` v4 `Group`/`Panel`/`Separator`/`useDefaultLayout`, `@dnd-kit/react`, and `@assistant-ui/react`.
- Use existing semantic color tokens in CSS. Add or repoint aliases in `:root`, `.portfolio-composition`, both `[data-theme]` blocks, and `docs/design-tokens.md` together.
- All composition CSS stays in `app/globals.css`; declarations remain alphabetical; hover is fine-pointer-only; interaction changes are instant outside existing Map/avatar motion.
- Desktop begins at 1020px. Contents minimum is 300px; main minimum 720px; right minimum 360px; vertical slot minimum 160px.
- Use test-first development for every state transition, parser, component contract, and regression.
- Update component sheets and `/design` fixtures whenever a public component contract changes.
- Commit only explicit task paths after inspecting the staged diff.

---

### Task 1: Pure Reading Room state and dependency floor

**Files:**
- Create: `lib/reading-room-layout.ts`
- Create: `lib/reading-room-layout.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces `ReadingRoomView = "reader" | "map" | "guide"`.
- Produces `ReadingRoomSlot = "main" | "top" | "bottom"`.
- Produces `ReadingRoomLayoutState`, `DEFAULT_READING_ROOM_LAYOUT`,
  `parseReadingRoomLayout`, `serializeReadingRoomLayout`, `swapReadingRoomSlots`,
  `setReadingRoomViewHidden`, and `visibleReadingRoomSlots`.

- [ ] Add failing tests for valid/invalid stored state, defaults, swapping any
  two slots, hiding/reopening right views, lower-slot collapse, and the
  invariant that the upper side slot cannot remain hidden while the lower side
  slot is visible.
- [ ] Run `npm test -- lib/reading-room-layout.test.ts` and confirm the module
  is missing.
- [ ] Implement the discriminated types and pure helpers. Parsing must ignore
  unknown views, duplicate slot assignments, non-finite sizes, and malformed
  hidden arrays, falling back per field without throwing.
- [ ] Install exact current stable packages with
  `npm install react-resizable-panels@4.12.3 @dnd-kit/react@0.5.0 @assistant-ui/react@0.15.17`.
- [ ] Run the focused test, `npm run typecheck`, and `npm run deadcode`.
- [ ] Commit the four explicit paths with message
  `Reading Room: add layout state and UI dependencies`.

### Task 2: Marks, assets, tokens, and design rules

**Files:**
- Modify: `lib/portfolio-node-mark.ts`
- Modify: `lib/portfolio-node-mark.test.ts`
- Modify: `lib/portfolio-control-mark.ts`
- Modify: `lib/portfolio-control-mark.test.ts`
- Modify: `components/PortfolioNodeMark.tsx`
- Modify: `public/biv-brain-symbol.svg`
- Create: `public/biv-twirl-sprite.png`
- Modify: `app/globals.css`
- Modify: `docs/design-conventions.md`
- Modify: `docs/design-tokens.md`
- Modify: `docs/components/PortfolioNodeMark.md`
- Modify: `/design` mark fixtures/tests as required by the existing sheet sync contract.

**Interfaces:**
- Expands `PortfolioControlMarkKind` with `sidebarLeft`, `sidebarRight`,
  `panelBottom`, `reader`, `copy`, `newChat`, `chevron`, and `readArrow`.
- `PortfolioControlMark` renders patterned `map` and `chat` marks and uses the
  SVG brain asset for identity.

- [ ] Write failing geometry tests for 60-degree Story spokes, equilateral
  triangle circumradius 0.56, operation 2:1 radii, close endpoints, the return
  Send path, and exact Map/Guide outline paths.
- [ ] Run the two focused mark test files and confirm the new assertions fail.
- [ ] Implement the geometry and control-kind changes without changing the
  shared 15-unit envelope or 1.45 stroke contract.
- [ ] Replace every composition brain mask/image reference with the SVG.
  Reduce the supplied SVG to its rendering `viewBox`, group transform, and
  paths, preserving `fill="currentColor"`; add the 8064x64 twirl sprite.
- [ ] Repoint `--world-story` to the arc red pair in normal, dark, and gallery
  theme blocks. Add a semantic Acid focus alias if needed. Update row/type
  values and design docs to the handoff, including all listed convention
  amendments.
- [ ] Update mark gallery fixtures and sheet examples, then run the sync script.
- [ ] Run focused tests, `npm run typecheck`, and `npm run lint`.
- [ ] Commit the explicit paths with message
  `Reading Room: adopt final marks and palette`.

### Task 3: Contents and embedded Reader

**Files:**
- Create: `components/PortfolioContents.tsx`
- Create: `components/PortfolioContents.test.tsx`
- Create: `docs/components/PortfolioContents.md`
- Modify: `components/PortfolioReader.tsx`
- Modify: `components/PortfolioReader.test.tsx`
- Modify: `docs/components/PortfolioReader.md`
- Modify: `app/design/sheet-examples.tsx`
- Modify: `app/design/sheet-examples.test.tsx`
- Modify: `app/globals.css`
- Modify: content adapter types only if a short label cannot be safely derived.

**Interfaces:**
- `PortfolioContents` consumes `selectedId`, `activeThreadId`, `onHome`,
  `onSelect`, `onSelectThread`, and optional `onNavigate` for mobile tab
  handoff.
- `PortfolioReader` keeps selection and visual callbacks but removes the
  `indexOpen`/`onOpenIndex` footer navigation contract.

- [ ] Write failing Contents tests for exact group order, Home mast, 28px/36px
  row semantics through class/state attributes, selected register state,
  record and thread selection, and mobile `onNavigate`.
- [ ] Write failing Reader regressions proving About/record/thread rendering,
  inline and row navigation, visual opening, and Privacy as the final in-flow
  line without Index/Home footer controls.
- [ ] Run the two focused suites and confirm the contract failures.
- [ ] Implement Contents from `portfolioWorldIndexSections`, deriving short
  labels from authoritative content only when the handoff does not supply one.
- [ ] Simplify Reader modes to About, record, and thread. Keep editor hooks,
  content parsing, visual blocks, avatar targets, and scroll restoration.
- [ ] Add exact desktop/mobile Contents and fixed-column Reader CSS using
  semantic tokens.
- [ ] Add component sheets and compiled `/design` examples, sync sheets, then
  run focused tests, component-sheet tests, typecheck, and lint.
- [ ] Commit the explicit paths with message
  `Reading Room: add Contents and embed the Reader`.

### Task 4: Slot-sized Map

**Files:**
- Modify: `components/PortfolioWorld.tsx`
- Modify: `components/PortfolioWorld.test.tsx`
- Modify: `docs/components/PortfolioWorld.md`
- Modify: `app/design/sheet-examples.tsx` when its compiled example changes.
- Modify: `app/globals.css`

**Interfaces:**
- Add explicit `compact?: boolean` and `nodesInTabOrder?: boolean` props.
- Canvas sizing and projection read the `.portfolio-world` slot bounds through
  `ResizeObserver`; viewport resize remains a fallback.

- [ ] Write failing tests for parent-sized canvas updates, observer cleanup,
  compact always-visible labels, left-30-percent label placement, and
  `tabIndex=-1` when `nodesInTabOrder` is false.
- [ ] Run the focused World suite and confirm the new tests fail.
- [ ] Replace viewport-derived sizing with element bounds without changing
  composition goals, connector envelopes, seeded poses, node drag, selection,
  blank-space reset, or visual-stage behavior.
- [ ] Implement explicit compact label visibility and placement. Keep real
  buttons for semantics and pointer interaction.
- [ ] Replace fixed-position Map CSS with slot containment and remove desktop
  stage shadows per the spec.
- [ ] Update the component sheet/example and run World tests plus all
  `lib/portfolio-world-*`, story-tree, projection, field, envelope, and layout
  suites, followed by typecheck and lint.
- [ ] Commit the explicit paths with message
  `Reading Room: make the Map slot-aware`.

### Task 5: Docked assistant-ui Guide

**Files:**
- Modify: `components/PortfolioChat.tsx`
- Modify: `components/PortfolioChat.test.tsx`
- Modify: `docs/components/PortfolioChat.md`
- Create: `lib/portfolio-guide-citations.ts`
- Create: `lib/portfolio-guide-citations.test.ts`
- Create: `lib/portfolio-guide-prompts.ts`
- Create: `lib/portfolio-guide-prompts.test.ts`
- Modify: `app/design/fixtures.ts` and sheet examples if their injection API changes.
- Modify: `app/globals.css`

**Interfaces:**
- `PortfolioChat` becomes the always-mounted Guide body and exposes
  `onNavigateEvidence`, `onThreadStateChange`, and `resetSignal` in addition
  to the protected transport/avatar injection seams.
- `parseGuideAnswerSegments(answer, evidence)` returns plain and citation
  segments. Only in-range `[E#]` references become actions.
- Prompt helpers return deterministic three-item sets when given a visit seed
  and follow-ups keyed by cited evidence.

- [ ] Write failing pure tests for valid, repeated, adjacent, malformed, and
  out-of-range evidence labels plus node/thread/home target resolution.
- [ ] Write failing prompt tests for rotation, two-serious/one-playful initial
  sets, record-aware questions, and stable fallback follow-ups.
- [ ] Rewrite component tests first for docked rendering through
  `AssistantRuntimeProvider`, Thread/Message/Composer primitives, protected
  AskPortfolio options, citation navigation, 10-second slow state, error and
  one-shot retry, offline listeners, IME-safe Enter, new conversation reset,
  Turnstile gating, abort/stale-turn behavior, and avatar callbacks.
- [ ] Run the three focused suites and confirm the new contract fails before
  implementation.
- [ ] Adapt `AskPortfolio` to an assistant-ui local runtime. Convert its
  messages to the existing bounded conversation type, preserve visit state and
  challenge tokens, and yield cumulative text. If the transport supplies one
  complete answer, reveal it word by word client-side.
- [ ] Render custom Thread, Message, Suggestion, Composer, slow, error, offline,
  citation, copy, and follow-up primitives with the exact handoff copy.
- [ ] Remove floating positioning, drag/minimize/mobile-back behavior and all
  shadows. Keep `registerAvatarTarget`, `onLayoutChange`, and protected
  transport callbacks.
- [ ] Update the component sheet and fixtures. Run focused tests, every chat
  client/server/provider/eval test, typecheck, lint, and dead-code checks.
- [ ] Commit the explicit paths with message
  `Reading Room: turn chat into the docked Guide`.

### Task 6: Responsive Reading Room shell and integration

**Files:**
- Create: `components/PortfolioReadingRoom.tsx`
- Create: `components/PortfolioReadingRoom.test.tsx`
- Create: `docs/components/PortfolioReadingRoom.md`
- Modify: `components/PortfolioExperience.tsx`
- Modify: `components/PortfolioExperience.test.tsx`
- Modify: `docs/components/PortfolioExperience.md`
- Modify: `app/design/sheet-examples.tsx`
- Modify: `app/design/sheet-examples.test.tsx`
- Modify: `app/globals.css`
- Modify: rendered-route/design-system tests whose assertions encode the old composition.

**Interfaces:**
- `PortfolioReadingRoom` receives controlled Reader, Map, and Guide nodes;
  Contents callbacks; selected subject metadata; Guide reset/thread state;
  and storage injection for tests.
- `PortfolioExperience` remains the only owner of selection, browser history,
  avatar lifecycle, visual state, and citation routing.

- [ ] Write failing shell tests for default desktop placement, v4 panel
  persistence, bar-as-handle DnD swaps, drop overlay, side/main/right/lower
  collapse and reopen controls, main mast substitution, Escape ordering, and
  Guide new-chat routing.
- [ ] Write failing mobile tests for the 1020px mode boundary, top mast, three
  tabs, Contents-to-Reader navigation, 52/48 Map+Guide DOM contract, selected
  Read chip, citation selection, and tab state that does not corrupt desktop
  slot persistence.
- [ ] Run focused shell and Experience suites and confirm failures.
- [ ] Implement `PortfolioReadingRoom` using v4 `Group`, `Panel`, `Separator`,
  `useDefaultLayout`, and `@dnd-kit/react`. Persist size groups through the
  library and `{slots, hidden}` through the pure layout serializer.
- [ ] Rewire `PortfolioExperience` to render one instance of each live view
  through the shell. Preserve URL/popstate, selection, active visual, avatar,
  toybox, editor, and citation target behavior.
- [ ] Implement exact desktop/mobile bars, panes, sashes, overlay, controls,
  chip, surfaces, minimums, overflow, and focus/hover CSS. Remove obsolete
  composition/mobile/floating-chat selectors once no rendered component reads
  them.
- [ ] Update sheets, compiled gallery examples, and rendered assertions. Run
  focused tests, the full Vitest suite, typecheck, lint, dead-code check, and
  `npm run build`.
- [ ] Commit the explicit paths with message
  `Reading Room: integrate the responsive workspace`.

### Task 7: Browser fidelity pass and final proof

**Files:**
- Modify only files implicated by observed discrepancies.
- Save reports and screenshots under `.context/reading-room-verification/`.

**Interfaces:**
- No new public interface unless a browser-observed defect cannot be fixed
  through the planned contracts.

- [ ] Start one workspace server on `$CONDUCTOR_PORT` and use the reusable
  parallel web verification contract with ephemeral browser contexts.
- [ ] Verify 1440x900 light and dark: About, a record, a thread, Contents
  selection, all three default slots, each swap pair, Contents collapse,
  right collapse, bottom collapse/reopen, Guide starter, answer/citation,
  slow, error, and offline states.
- [ ] Verify 390x844 light and dark: each tab, Contents selection to Reader,
  record Read chip, fixed 52/48 Map+Guide, Guide thread/reset, and no horizontal
  overflow.
- [ ] Compare screenshots against the handoff HTML references and fix every
  objective spacing, surface, type, mark, clipping, or state discrepancy.
- [ ] Record device-only Map motion, touch feel, avatar placement, and final
  interaction feel as acceptance-walk items rather than weakening automated
  proof.
- [ ] Run full tests, typecheck, lint, dead-code check, and production build
  after the final diff.
- [ ] Commit explicit changed paths with message
  `Reading Room: finish fidelity and verification`.
