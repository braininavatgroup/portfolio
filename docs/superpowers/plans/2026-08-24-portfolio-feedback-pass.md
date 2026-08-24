# Portfolio Feedback Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved visual-review feedback across portfolio navigation, chat, graph interaction, domain labeling, project index, and case-study layouts.

**Architecture:** Keep the existing route and data model contracts. Extract a shared portfolio header, make keyboard navigation a behavior-only controller, and express visual differentiation through existing data attributes and CSS rather than adding a new rendering system.

**Tech Stack:** React 19, Next/vinext, TypeScript, Vitest, Testing Library, Three.js/R3F, global CSS.

**Spec:** `docs/superpowers/specs/2026-08-24-portfolio-feedback-pass-design.md`

## Global Constraints

- Preserve existing uncommitted changes in the workspace.
- Do not add dependencies.
- Keep chat preview controls dormant and unchanged.
- Keep map, index, and case-study routes accessible by keyboard and links.

---

### Task 1: Shared navigation and landing shell

**Files:**
- Create: `components/PortfolioHeader.tsx`
- Modify: `components/PortfolioExperience.tsx`
- Modify: `app/work/page.tsx`
- Modify: `app/work/[slug]/page.tsx`
- Modify: `components/PortfolioExperience.test.tsx`
- Modify: `tests/rendered-html.test.mjs`

- [ ] Add a shared header component with wordmark, Map link, Project index link, and current-view state.
- [ ] Replace the graph-only Replay intro button and both page-specific navigation blocks.
- [ ] Keep the home wordmark reset behavior and remove the landing instruction and Explore the work button.
- [ ] Update interaction and rendered-output assertions.

### Task 2: Lower-profile chat without starter pills

**Files:**
- Modify: `components/PortfolioChat.tsx`
- Modify: `components/PortfolioChat.test.tsx`
- Modify: `app/globals.css`

- [ ] Remove starter question data, submitter branching, and starter button markup.
- [ ] Preserve typed-question submission, preview access, evidence, pose changes, and event containment.
- [ ] Remove pill-specific CSS and reduce the panel's visual weight.
- [ ] Update tests to assert the single input path.

### Task 3: Automatic graph keyboard navigation

**Files:**
- Modify: `components/KeyboardNavigator.tsx`
- Modify: `components/KeyboardNavigator.test.tsx`
- Modify: `components/PortfolioExperience.tsx`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `app/globals.css`

- [ ] Replace the visible trigger/step controls with a behavior-only controller.
- [ ] Start at the first actionable node on the first arrow key, wrap with existing index logic, open links on Enter, and clear on Escape.
- [ ] Ignore input, textarea, select, button, link, and contenteditable targets.
- [ ] Update tests for automatic activation, ignored controls, and no rendered keyboard-control button.

### Task 4: Domain label differentiation

**Files:**
- Modify: `lib/portfolio.ts`
- Modify: `components/scene/BrainGraph.tsx`
- Modify: `app/globals.css`
- Test: `components/scene/GraphNodeLabel.test.tsx` or a focused domain-label test

- [ ] Add stable colors to the three domain records and pass each color to the rendered label.
- [ ] Increase label scale/readability and add restrained backing/glow treatment.
- [ ] Preserve mobile hiding behavior except when a domain is focused.

### Task 5: Project index treatment

**Files:**
- Modify: `app/work/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

- [ ] Remove the Portfolio · 9 projects eyebrow.
- [ ] Apply the shared header and simplify project entries into consistent editorial rows.
- [ ] Remove the separator rule causing column pixel artifacts and verify route/link coverage.

### Task 6: Case-study layout and markers

**Files:**
- Modify: `components/CaseStudyArticle.tsx`
- Modify: `components/CaseStudyArticle.test.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-routes.test.mjs`

- [ ] Remove numeric chain markers from markup and styles.
- [ ] Use a clean three-column desktop step flow and one-column mobile fallback.
- [ ] Flatten nested entity/evidence surfaces while preserving headings, relations, links, and evidence semantics.
- [ ] Add assertions that markers are absent and all three roles remain ordered.

### Task 7: Verification and cleanup

**Files:**
- Modify only files required by failing checks.

- [ ] Run focused component tests after each task.
- [ ] Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npm run test:rendered` serially.
- [ ] Search production sources for removed labels and stale selectors.
- [ ] Review `git diff --check` and the final status before handoff.
