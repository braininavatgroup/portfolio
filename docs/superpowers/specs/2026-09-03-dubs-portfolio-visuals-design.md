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
- The dossier renders all three authored groups in order using the shared
  gallery rows: each row contains either three equal phones or one larger phone.
  The four-image group becomes three plus one large; the three-image group stays
  three; the final phone is large. All authored evidence remains present; this
  rule does not select representative images.
- Opening any group uses the shared Reader image viewer. It begins on that
  group's first asset, then Previous and Next move through individual images.
- The viewer stays over the Reader on desktop and mobile. It never opens in or
  switches to the Map, and Dubs has no project-specific viewer behavior.

## Responsive behavior

Desktop and mobile use the same three-or-one inline gallery without horizontal
scrolling. The shared viewer presents one complete image at a time over the
Reader with a translucent paper wash and slight backdrop blur, a centered
asset label, and centered `n of total` navigation.

## Acceptance

The gallery is successful when all eight assets load, each inline group fits
without overflow, every viewer image uses `object-fit: contain`,
keyboard-accessible Previous, Next, and Close controls retain their behavior,
and the Map never opens.
