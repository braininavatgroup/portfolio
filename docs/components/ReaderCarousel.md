# ReaderCarousel

Source: [`components/ReaderCarousel.tsx`](../../components/ReaderCarousel.tsx) · Tests: `components/ReaderCarousel.test.tsx`, `components/PortfolioReader.test.tsx`

One scrolling strip of 128px square client images. Images rest in grayscale and show their name and platform icons on hover, keyboard focus, or tap. The strip loops and drags without opening the Reader overlay.

## Props

`assets`: `src`, `alt`, optional `label` and `links`. `label` names the strip. `direction` defaults to `"forward"`; `speed` defaults to `0.4` pixels per frame.

## Requires

A `.portfolio-composition` ancestor, a `.reader-visual-block` figure, and enough assets to overflow the column. `PortfolioReader` mounts it for a ready gallery with `layout: "carousel"`, one strip per slide.

## Example

```tsx
import { ReaderCarousel } from "components/ReaderCarousel";

export function ReaderCarouselExample() {
  // One strip of client marks. It scrolls on its own, pauses under the
  // pointer or keyboard focus, drags freely, and stays still for visitors who
  // prefer reduced motion. Wrap it in a reader figure for the caption voice.
  const assets = [
    { alt: "Adriatique — Electronic music duo", label: "Adriatique", src: "/visuals/clients/adriatique.webp" },
    { alt: "Satori — Electronic music artist", label: "Satori", src: "/visuals/clients/satori.webp" },
    { alt: "WhoMadeWho — Electronic music band", label: "WhoMadeWho", src: "/visuals/clients/wmw.webp" },
    { alt: "Armada Music — Record Label", label: "Armada Music", src: "/visuals/clients/armada.webp" },
    { alt: "The Orchard — Music Distribution", label: "The Orchard", src: "/visuals/clients/the-orchard.webp" },
    { alt: "Higher Ground — Record Label", label: "Higher Ground", src: "/visuals/clients/hgsquare.webp" },
  ];
  return (
    <div className="portfolio-composition" style={{ width: 560 }}>
      <figure className="reader-visual-block reader-visual-carousel" data-media-surface="floating">
        <ReaderCarousel assets={assets} label="Clients. A few marquee names." />
        <figcaption>
          <strong>Clients</strong>
          <span>A few marquee names.</span>
        </figcaption>
      </figure>
    </div>
  );
}
```

## Pitfalls

- Reduced motion keeps the strip still. Fine-pointer hover and keyboard focus pause scrolling; leaving resumes it.
- Platform marks inherit the card contrast and brighten over a subtle background on hover or keyboard focus; the focus ring remains visible.
- A touch press opens the card and holds it open (`data-open` on the item) until another opens or a press lands outside the strip; a mouse keeps its hover-only card. Focus cannot hold a card open for touch: revealing it between press and release retargets the click to the list item, and touch browsers drop focus before a link's click lands, so a focus-only card swallowed every platform-link tap. Tab continues into the card's accessible platform links, each with a tooltip and a new-tab target.
- Images use precompressed local WebP files with explicit 128px dimensions, lazy loading, and asynchronous decoding; the native image element deliberately avoids runtime transformation. Images are center-cropped. Supply square sources or pad wide logos to preserve their edges.
- `.reader-visual-block img` stretches images; the carousel overrides that to 128px square. Keep this override when changing shared media styles.
- Every asset needs corresponding alt text in the content document; content/structure parity tests guard their alignment.
- Cards show Instagram and Spotify when present. Beatport appears only when Spotify is absent, regardless of client type. There is no Artist/Label row.

## Shared carousels and sources
BiV (`music-practice`) and INFAMOUS (`infamous`) use the same `readyCarousel` helper, this component, and `.reader-carousel-*` styles. Keep motion, sizing, focus, touch, and icons here; only client data differs. Both records run through shared integration tests.

BiV's 45 clients come from https://braininavat.dance/, checked 8 September 2026. Port London's Instagram source was `n`; keep only Spotify. INFAMOUS has Bradley's trimmed 20-client list and images in `public/visuals/clients/infamous/`; provenance is in [`docs/content/infamous-client-assets.json`](../content/infamous-client-assets.json). Names live in the content document; URLs in `lib/portfolio-structure.ts`.

Sita Abellán links to SITA; Totally Enormous Extinct Dinosaurs to TEED; KH / Four Tet uses Four Tet's profiles. Social marks use `PortfolioContactMark`: Instagram shares Contact’s outline; Spotify and Beatport retain their original brand paths. The shared 18px mark renderer sits inside 24px targets.
