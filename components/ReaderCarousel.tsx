"use client";

import useEmblaCarousel from "embla-carousel-react";
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
                <svg
                  aria-hidden="true"
                  fill={key === "instagram" ? "none" : "currentColor"}
                  stroke={key === "instagram" ? "currentColor" : "none"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  {key === "instagram" ? (
                    <>
                      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <path d="M17.5 6.5h.01" />
                    </>
                  ) : key === "spotify" ? (
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                  ) : (
                    <path d="M21.429 17.055a7.114 7.114 0 0 1-.794 3.246 6.917 6.917 0 0 1-2.181 2.492 6.698 6.698 0 0 1-3.063 1.163 6.653 6.653 0 0 1-3.239-.434 6.796 6.796 0 0 1-2.668-1.932 7.03 7.03 0 0 1-1.481-2.983 7.124 7.124 0 0 1 .049-3.345 7.015 7.015 0 0 1 1.566-2.937l-4.626 4.73-2.421-2.479 5.201-5.265a3.791 3.791 0 0 0 1.066-2.675V0h3.41v6.613a7.172 7.172 0 0 1-.519 2.794 7.02 7.02 0 0 1-1.559 2.353l-.153.156a6.768 6.768 0 0 1 3.49-1.725 6.687 6.687 0 0 1 3.845.5 6.873 6.873 0 0 1 2.959 2.564 7.118 7.118 0 0 1 1.118 3.8Zm-3.089 0a3.89 3.89 0 0 0-.611-2.133 3.752 3.752 0 0 0-1.666-1.424 3.65 3.65 0 0 0-2.158-.233 3.704 3.704 0 0 0-1.92 1.037 3.852 3.852 0 0 0-1.031 1.955 3.908 3.908 0 0 0 .205 2.213c.282.7.76 1.299 1.374 1.721a3.672 3.672 0 0 0 2.076.647 3.637 3.637 0 0 0 2.635-1.096c.347-.351.622-.77.81-1.231.188-.461.285-.956.286-1.456Z" />
                  )}
                </svg>
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
    const shouldPause = () => reducedMotion || root.contains(document.activeElement) || (
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
  }, [emblaApi, reducedMotion]);

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
            <li className="reader-carousel-item" key={asset.src}>
              <button
                aria-label={`Show details for ${asset.label ?? asset.alt}`}
                className="reader-carousel-trigger"
                onClick={(event) => event.currentTarget.focus()}
                type="button"
              >
                <img
                  alt={asset.alt}
                  draggable={false}
                  loading="lazy"
                  src={asset.src}
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
