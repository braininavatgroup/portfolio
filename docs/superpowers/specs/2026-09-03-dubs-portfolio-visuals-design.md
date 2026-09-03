# Dubs portfolio visuals

## Intent

The Dubs case study should prove three things in order: interaction craft,
the product model that accumulates beneath the interaction, and the controlled
handoff of that context to an agent. The screenshots are evidence, not a
decorative carousel.

## Accepted sequence

1. **Catch the thought where it happens.** Four complete Apple-framed screens:
   Lock Screen access, reading and listening, inline response, and the response
   preserved with its source.
2. **What accumulates.** Three complete Apple-framed screens: Library, Tagged,
   and Perspective.
3. **Connect your agent.** One complete Apple-framed MCP setup screen showing
   the revocable token and visible authorization boundary.

The Share sheet is not part of this sequence. The MCP connection is the more
meaningful handoff artifact.

## Presentation contract

- Use Apple Frames for complete device presentation: the Black iPhone bezel
  at 794x1600, via `scripts/frame-portfolio-visual.sh <capture> <group> <name>`
  (the `frames` CLI default colour for iPhones is Black in
  `~/.config/frames/config.json`). Every screen in a story uses that one frame.
- Never crop a screenshot to manufacture a detail view.
- Never duplicate the screenshot inside explanatory zoom panels.
- Keep captions short and subordinate to the interface evidence.
- Present every media format on the Silver Studio field: a quiet radial blend
  from reader paper through the near-map neutral to map silver. The field has
  no grid or texture and changes mode through the existing semantic aliases.
- A slide may contain one or more complete assets. Previous and Next move
  between slides, not between individual phones inside a slide.
- The dossier renders all three slides as separate Silver Studio blocks in the
  authored order. No reader evidence depends on opening the gallery.

## Responsive behavior

Desktop keeps the 4 → 3 → 1 arrangement inside the existing visual stage.
Mobile preserves the same arrangement without horizontal scrolling. The four
screens become smaller, but remain complete; the single MCP screen receives
the full available height.

## Acceptance

The gallery is successful when all eight assets load, each slide fits without
overflow, every screenshot uses `object-fit: contain`, keyboard-accessible
Previous, Next, and Close controls retain their existing behavior, and the
final visual-feel decision can be made by reviewing the live Dubs page.
