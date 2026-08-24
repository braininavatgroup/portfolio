# Portfolio Feedback Pass Design

## Goal

Apply the attached visual-review feedback across the portfolio shell, graph controls, project index, and case-study pages while preserving existing route behavior and grounded chat functionality.

## Design

- Use one shared portfolio header treatment across the map, project index, and case-study pages. The Bradley Berkman wordmark is the home/reset action; remove the separate Replay intro control.
- Keep the landing canvas click-to-enter behavior, remove the redundant landing instruction and Explore the work button, and retain only the headline and transition status.
- Remove chat starter buttons. Keep the question input as the single prompt surface and reduce the panel's visual weight with a compact translucent treatment.
- Remove the visible keyboard navigator trigger and controls. Keyboard navigation listens at the graph surface/document boundary, ignores editable controls, begins from the first actionable node, and supports arrows, Enter, and Escape.
- Give each graph domain a stable color and use larger, backed labels so the three spatial areas read as distinct zones.
- Simplify the project index header and convert project cards to flatter editorial entries with consistent separators.
- Remove case-study step numbers and use a deliberate three-column desktop flow with role labels and quiet dividers; stack the same flow on narrow screens. Keep entity and evidence content readable without heavy nested cards.

## Acceptance criteria

- No production markup contains Replay intro, Explore by keyboard, the three starter-question buttons, Portfolio · 9 projects, or numbered chain markers.
- Map, project index, and case-study routes retain working navigation.
- Clicking the landing scene enters the graph; chat interactions do not enter it.
- Arrow navigation works without activating a visible control and does not hijack text inputs or buttons.
- Domain labels are visually larger and use distinct domain colors.
- Component, rendered HTML, route, and full test suites pass.
