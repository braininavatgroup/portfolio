"use client";

import useEmblaCarousel from "embla-carousel-react";
import { PortfolioContactMark } from "./PortfolioNodeMark";
import AutoScroll from "embla-carousel-auto-scroll";
import { useEffect, useMemo, useState } from "react";
import type {
  PortfolioVisualAsset,
  PortfolioVisualAssetLinks,
} from "../lib/portfolio-world";

export type ReaderCarouselDirection = "forward" | "backward";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const LINK_PLATFORMS: readonly {
  key: keyof PortfolioVisualAssetLinks;
  name: string;
}[] = [
  { key: "instagram", name: "Instagram" },
  { key: "spotify", name: "Spotify" },
  { key: "beatport", name: "Beatport" },
];

/**
 * The card a mark reveals under a fine pointer or keyboard focus: its label,
 * and off-site links. Rendered only when the asset
 * carries something to show, so a bare strip stays a bare strip.
 */
function ReaderCarouselCard({ asset }: { asset: PortfolioVisualAsset }) {
  const links = LINK_PLATFORMS.flatMap(({ key, name }) => {
    if (key === "beatport" && asset.links?.spotify) return [];
    const href = asset.links?.[key];
    return href ? [{ href, name, key }] : [];
  });
  if (!asset.label && links.length === 0) return null;
  return (
    <div className="reader-carousel-card">
      {asset.label ? <strong>{asset.label}</strong> : null}
      {links.length > 0 ? (
        <ul className="reader-carousel-card-links">
          {links.map(({ href, name, key }) => (
            <li key={href}>
              <a
                aria-label={`${asset.label ?? asset.alt} on ${name}`}
                href={href}
                rel="noopener noreferrer"
                target="_blank"
                title={name}
              >
                <PortfolioContactMark kind={key} />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Whether the visitor asked for reduced motion. Read after mount so the
 * server and the first client render agree; until then the strip is still.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * One continuously scrolling strip of images: a marquee row for client marks
 * and similar assets whose value is the set, not any single frame. Embla owns
 * the geometry and the drag; the auto-scroll plugin advances the strip a few
 * pixels a frame, pauses under a fine pointer or keyboard focus, and never
 * starts when the visitor prefers reduced motion — the strip stays draggable.
 */
export function ReaderCarousel({
  assets,
  direction = "forward",
  label,
  speed = 0.4,
}: {
  assets: readonly PortfolioVisualAsset[];
  direction?: ReaderCarouselDirection;
  label: string;
  /** Pixels advanced per animation frame. */
  speed?: number;
}) {
  const reducedMotion = usePrefersReducedMotion();
  // Which card a *touch* opened. A mouse still reveals cards by hover alone.
  // Touch has no hover and cannot lean on focus either: revealing the card
  // between press and release retargets the click to the list item, and a
  // touch browser drops focus before a link's click lands — so a focus-only
  // card vanished under the finger and swallowed every platform-link tap.
  const [openSrc, setOpenSrc] = useState<string | null>(null);
  const plugins = useMemo(
    () => [
      AutoScroll({
        active: !reducedMotion,
        direction,
        playOnInit: !reducedMotion,
        speed,
        startDelay: 0,
        stopOnFocusIn: false,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
    ],
    [direction, reducedMotion, speed],
  );
  const [viewportRef, emblaApi] = useEmblaCarousel(
    { align: "start", dragFree: true, loop: true },
    plugins,
  );

  // Focus includes taps as well as keyboard navigation. The plugin's default
  // focus handler only catches Tab, and its mouseleave/drag handlers can start
  // scrolling again while a link still has focus.
  useEffect(() => {
    if (!emblaApi) return;
    const root = emblaApi.rootNode();
    let disposed = false;
    const shouldPause = () => reducedMotion || openSrc !== null || root.contains(document.activeElement) || (
      window.matchMedia("(pointer: fine)").matches && root.matches(":hover")
    );
    const stop = () => emblaApi.plugins().autoScroll?.stop();
    const restart = () => {
      if (disposed) return;
      if (shouldPause()) stop();
      else emblaApi.plugins().autoScroll?.play();
    };
    const afterFocus = () => queueMicrotask(restart);
    // AutoScroll emits play before marking itself active. Stop after that
    // synchronous change, before its animation timer can advance the strip.
    const guardPlay = () => {
      queueMicrotask(() => {
        if (!disposed && shouldPause()) stop();
      });
    };
    root.addEventListener("focusin", stop);
    root.addEventListener("focusout", afterFocus);
    emblaApi.on("autoScroll:play", guardPlay);
    emblaApi.on("reInit", restart);
    restart();
    return () => {
      disposed = true;
      root.removeEventListener("focusin", stop);
      root.removeEventListener("focusout", afterFocus);
      emblaApi.off("autoScroll:play", guardPlay);
      emblaApi.off("reInit", restart);
    };
  }, [emblaApi, openSrc, reducedMotion]);

  // A press outside the strip closes the open card, the way a tap away
  // dismisses any other transient surface. Presses inside the strip belong to
  // the cards themselves: a trigger opens its own card, a link opens its site.
  useEffect(() => {
    if (!openSrc || !emblaApi) return;
    const root = emblaApi.rootNode();
    const dismiss = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && root.contains(target)) return;
      setOpenSrc(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [emblaApi, openSrc]);

  return (
    <div
      aria-label={label}
      className="reader-carousel"
      data-direction={direction}
      data-motion={reducedMotion ? "reduced" : "auto"}
      role="group"
    >
      <div className="reader-carousel-viewport" ref={viewportRef}>
        <ul className="reader-carousel-track">
          {assets.map((asset) => (
            <li
              className="reader-carousel-item"
              data-open={openSrc === asset.src ? "true" : undefined}
              key={asset.src}
            >
              <button
                aria-label={`Show details for ${asset.label ?? asset.alt}`}
                className="reader-carousel-trigger"
                onClick={(event) => event.currentTarget.focus()}
                // The press, not the click: a tap's click is retargeted to the
                // list item once the card appears, so the button never sees
                // it. A mouse keeps its hover-only card.
                onPointerDown={(event) => {
                  if (event.pointerType !== "mouse") setOpenSrc(asset.src);
                }}
                type="button"
              >
                {/* Precompressed local WebP thumbnails; runtime optimization adds an unnecessary request path. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={asset.alt}
                  decoding="async"
                  draggable={false}
                  height={128}
                  loading="lazy"
                  src={asset.src}
                  width={128}
                />
              </button>
              <ReaderCarouselCard asset={asset} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
