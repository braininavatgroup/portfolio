"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  type ReactNode,
} from "react";
import {
  PortfolioContactMark,
  PortfolioControlMark,
  PortfolioNodeMark,
} from "./PortfolioNodeMark";
import { QuarterlyDashboardPreview } from "./QuarterlyDashboardPreview";
import { TouringDemo } from "./TouringDemo";
import { MacPanelFrame } from "./MacMenuBar";
import { ReaderCarousel } from "./ReaderCarousel";
import type { PortfolioContactMarkKind } from "../lib/portfolio-contact-mark";
import { parseInlineLinks } from "../lib/portfolio-inline-links";
import { portfolioLinkPreview, portfolioLinkPreviewLayout } from "../lib/portfolio-link-preview";
import { isCampaignReportEmbedOrigin } from "../lib/portfolio-report-embed";
import { paragraphHasList, parseParagraphFlow } from "../lib/portfolio-paragraph";
import { attachPortfolioVideoSource } from "../lib/portfolio-video";
import {
  PortfolioAttention,
  trackPortfolioAttention,
  trackPortfolioInsight,
} from "../lib/portfolio-analytics";
import {
  portfolioContact,
  portfolioInterfaceText,
  portfolioThreads,
  portfolioThreadById,
  portfolioVisualFormat,
  isPortfolioVisualReady,
  portfolioWorldLinks,
  portfolioWorldNodeById,
  type PortfolioBodyBlock,
  type PortfolioThread,
  type PortfolioVisualBlock,
  type PortfolioVisualFormat,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";

const HOME_NODE_ID = "bradley";
const homeNode = portfolioWorldNodeById.get(HOME_NODE_ID)!;

const subscribeToReportOrigin = () => () => {};
const canEmbedReport = () => isCampaignReportEmbedOrigin(window.location.origin);

function CampaignReportPreview({ block }: { block: PortfolioVisualBlock }) {
  const embedded = useSyncExternalStore(subscribeToReportOrigin, canEmbedReport, () => false);
  return (
    <figure className="reader-visual-block reader-report-preview" data-format="interactive">
      {embedded ? (
        <iframe
          className="reader-report-frame"
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-downloads allow-modals allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          src={block.href}
          title={block.purpose}
        />
      ) : (
        <img alt={block.alt ?? block.purpose} loading="lazy" src={block.src} />
      )}
    </figure>
  );
}

type PortfolioVideoProps = Omit<ComponentPropsWithoutRef<"video">, "src"> & {
  captionsSrc: string;
  fallbackSrc?: string;
  muxPlaybackId?: string;
};

function setForwardedRef(
  forwardedRef: ForwardedRef<HTMLVideoElement>,
  video: HTMLVideoElement | null,
) {
  if (typeof forwardedRef === "function") {
    forwardedRef(video);
  } else if (forwardedRef) {
    forwardedRef.current = video;
  }
}

export const PortfolioVideo = forwardRef<HTMLVideoElement, PortfolioVideoProps>(
  function PortfolioVideo(
    { captionsSrc, fallbackSrc, muxPlaybackId, ...videoProps },
    forwardedRef,
  ) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const assignVideo = useCallback(
      (video: HTMLVideoElement | null) => {
        videoRef.current = video;
        setForwardedRef(forwardedRef, video);
      },
      [forwardedRef],
    );

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !muxPlaybackId) return;

      let disposed = false;
      let detach: (() => void) | undefined;
      void attachPortfolioVideoSource(
        video,
        muxPlaybackId,
        undefined,
        fallbackSrc,
      )
        .then((cleanup) => {
          if (disposed) cleanup();
          else detach = cleanup;
        })
        .catch(() => {
          if (!disposed && fallbackSrc) video.src = fallbackSrc;
        });

      return () => {
        disposed = true;
        detach?.();
      };
    }, [fallbackSrc, muxPlaybackId]);

    return (
      <video {...videoProps} ref={assignVideo}>
        {fallbackSrc && !muxPlaybackId ? (
          <source src={fallbackSrc} type="video/mp4" />
        ) : null}
        <track default kind="captions" src={captionsSrc} srcLang="en" />
      </video>
    );
  },
);

function useVisibleVideoPlayback(forcedPaused: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (forcedPaused) {
      video.pause();
      return;
    }
    if (typeof IntersectionObserver === "undefined") return;

    let isVisible = false;
    const syncPlayback = () => {
      if (!isVisible || document.visibilityState !== "visible") {
        video.pause();
        return;
      }
      void video.play().catch(() => {
        // Autoplay can still be denied by a browser-level preference.
      });
    };
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? false;
      syncPlayback();
    });

    video.pause();
    observer.observe(video);
    document.addEventListener("visibilitychange", syncPlayback);
    return () => {
      document.removeEventListener("visibilitychange", syncPlayback);
      observer.disconnect();
      video.pause();
    };
  }, [forcedPaused]);

  return videoRef;
}

type NativeFullscreenVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

function useNativeVideoFullscreen(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [controls, setControls] = useState(false);

  const restoreInlineLoop = useCallback(() => {
    const video = videoRef.current;
    setControls(false);
    if (!video) return;
    video.controls = false;
    const playback = video.play();
    void playback?.catch(() => {
      // The inline loop can still be denied by a browser-level preference.
    });
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef.current as NativeFullscreenVideo | null;
    if (!video) return;
    const handleFullscreenChange = () => {
      if (document.fullscreenElement !== video) restoreInlineLoop();
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    video.addEventListener("webkitendfullscreen", restoreInlineLoop);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      video.removeEventListener("webkitendfullscreen", restoreInlineLoop);
    };
  }, [restoreInlineLoop, videoRef]);

  const enterFullscreen = useCallback(() => {
    const video = videoRef.current as NativeFullscreenVideo | null;
    if (!video) return;
    setControls(true);
    video.controls = true;

    if (typeof video.requestFullscreen === "function") {
      try {
        void video.requestFullscreen().catch(restoreInlineLoop);
        return;
      } catch {
        // A synchronous denial can still leave the iPhone video API available.
      }
    }

    if (typeof video.webkitEnterFullscreen === "function") {
      try {
        video.webkitEnterFullscreen();
        return;
      } catch {
        // Restore the embedded loop when native fullscreen is unavailable.
      }
    }

    restoreInlineLoop();
  }, [restoreInlineLoop, videoRef]);

  return { controls, enterFullscreen };
}

type OpenVisual = (
  block: PortfolioVisualBlock,
  trigger: HTMLButtonElement,
  initialFrame?: number,
) => void;

type InsightContent = {
  contentId: string;
  contentKind: "record" | "thread";
};

type PortfolioReaderProps = {
  activeThreadId: string | null;
  onReset: () => void;
  onSelect: (node: PortfolioWorldNode) => void;
  onSelectThread: (threadId: string) => void;
  selectedId: string | null;
};

// Every Reader row is one shape: a label in the row voice and the record's
// mark trailing in its register.
function IndexRow({
  node,
  onSelect,
}: {
  node: PortfolioWorldNode;
  onSelect: (node: PortfolioWorldNode) => void;
}) {
  return (
    <li>
      <button aria-label={node.label} className="reader-index-row" onClick={() => onSelect(node)} type="button">
        <span>{node.label}</span>
        <PortfolioNodeMark family={node.family} register={node.register} />
      </button>
    </li>
  );
}

function ThreadIndexRow({
  onSelect,
  thread,
}: {
  onSelect: (threadId: string) => void;
  thread: PortfolioThread;
}) {
  const node = portfolioWorldNodeById.get(thread.nodeId);
  if (!node) return null;

  return (
    <li>
      <button
        aria-label={thread.title}
        className="reader-index-row"
        onClick={() => onSelect(thread.id)}
        type="button"
      >
        <span>{thread.title}</span>
        <PortfolioNodeMark family={node.family} register={node.register} />
      </button>
    </li>
  );
}

/**
 * The draft-state frame a planned visual shows in place of its asset: the
 * kind top-left in the label voice, `treatment · sourceStatus` bottom-left in
 * the caption voice, a play ring for video, a frame count for a gallery. The
 * placeholder overlay draws the same frame at Reader scale, so it is exported.
 */
export function ReaderPlaceholderFrame({
  format,
  frame = 1,
  frameCount = 3,
  showFrameCount = true,
  sourceStatus,
  treatment,
}: {
  format: PortfolioVisualFormat;
  frame?: number;
  frameCount?: number;
  showFrameCount?: boolean;
  sourceStatus?: string;
  treatment?: string;
}) {
  const source = [treatment, sourceStatus].filter(Boolean).join(" · ");
  return (
    <div className="reader-placeholder-frame" data-format={format}>
      <span className="reader-placeholder-label">Planned {format}</span>
      {format === "video" ? <span className="reader-placeholder-play" /> : null}
      {format === "gallery" && showFrameCount ? (
        <span className="reader-placeholder-count">
          {frame} / {frameCount}
        </span>
      ) : null}
      {source ? <span className="reader-placeholder-source">{source}</span> : null}
    </div>
  );
}

function VisualBlock({
  block,
  insightContent,
  onOpen,
  videoPaused = false,
}: {
  block: PortfolioVisualBlock;
  insightContent: InsightContent;
  onOpen?: OpenVisual;
  videoPaused?: boolean;
}) {
  const format = portfolioVisualFormat(block);
  const thumbnailSrc =
    block.poster ??
    (format !== "video" ? block.src : undefined);
  const thumbnailAlt = block.alt ?? "";
  const ready = isPortfolioVisualReady(block);
  const inlineVideoRef = useVisibleVideoPlayback(videoPaused);
  const nativeFullscreen = useNativeVideoFullscreen(inlineVideoRef);

  if (ready && format === "video" && (block.muxPlaybackId || block.src)) {
    return (
      <figure
        className="reader-visual-block reader-inline-video"
        data-format={format}
        data-media-surface="floating"
      >
        <div className="reader-device-video">
          {block.poster ? (
            // The frame composite needs ordinary layered image geometry.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              aria-hidden="true"
              className="reader-device-poster"
              src={block.poster}
            />
          ) : null}
          <div className="reader-device-screen">
            <PortfolioVideo
              aria-label={block.alt ?? block.purpose}
              autoPlay
              captionsSrc={block.captionsSrc!}
              controls={nativeFullscreen.controls}
              fallbackSrc={block.src}
              loop
              muted
              muxPlaybackId={block.muxPlaybackId}
              playsInline
              preload="metadata"
              ref={inlineVideoRef}
            />
          </div>
          {block.frameSrc ? (
            // This is a local, lossless Apple frame asset used as an overlay.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              aria-hidden="true"
              className="reader-device-frame"
              src={block.frameSrc}
            />
          ) : null}
          <button
            aria-label={`Open video in reader: ${block.purpose}`}
            className="reader-visual-trigger reader-video-fullscreen-trigger"
            data-format={format}
            data-status={block.status}
            onClick={() => {
              trackPortfolioInsight("evidence_open", {
                content_id: insightContent.contentId,
                content_kind: insightContent.contentKind,
                evidence_id: block.id,
                evidence_kind: format,
              });
              nativeFullscreen.enterFullscreen();
            }}
            type="button"
          />
        </div>
        <figcaption>
          <span>{block.caption ?? block.purpose}</span>
        </figcaption>
      </figure>
    );
  }

  if (format === "interactive") {
    if (block.preview === "touring") return <TouringDemo embedded />;
    if (block.preview === "quarterly-dashboard") return <QuarterlyDashboardPreview />;
    if (block.preview === "campaign-report" && block.href) {
      return <CampaignReportPreview block={block} />;
    }
    return null;
  }

  if (ready && format === "gallery" && block.layout === "carousel" && block.slides?.length) {
    return (
      <div className="reader-visual-gallery">
        {block.slides.map((slide, slideIndex) => (
          <figure
            className="reader-visual-block reader-visual-carousel"
            data-format={format}
            data-media-surface="floating"
            key={slide.title}
          >
            <ReaderCarousel
              assets={slide.assets}
              direction={slideIndex % 2 === 0 ? "forward" : "backward"}
              label={`${slide.title}. ${block.purpose}`}
            />
            <figcaption>
              <strong>{slide.title}</strong>
              <span>{slide.caption}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    );
  }

  if (ready && format === "gallery" && block.slides?.length) {
    return (
      <div className="reader-visual-gallery">
        {block.slides.map((slide, slideIndex) => {
          const initialFrame = block.slides!
            .slice(0, slideIndex)
            .reduce((count, prior) => count + prior.assets.length, 0);
          const assetRows = [];
          for (let index = 0; index < slide.assets.length;) {
            const remaining = slide.assets.length - index;
            const rowSize = remaining === 2 ? 1 : Math.min(3, remaining);
            assetRows.push(slide.assets.slice(index, index + rowSize));
            index += rowSize;
          }
          return (
            <button
              aria-label={`Open gallery visual in reader: ${slide.title}. ${block.purpose}`}
              className="reader-visual-trigger"
              data-format={format}
              data-evidence-id={block.id}
              data-slide-index={slideIndex}
              data-status={block.status}
              key={slide.title}
              onClick={(event) => {
                trackPortfolioInsight("evidence_open", {
                  content_id: insightContent.contentId,
                  content_kind: insightContent.contentKind,
                  evidence_id: block.id,
                  evidence_kind: format,
                });
                onOpen?.(block, event.currentTarget, initialFrame);
              }}
              type="button"
            >
              <figure
                className="reader-visual-block"
                data-format={format}
                data-media-surface="floating"
              >
                <div
                  className="reader-visual-slide"
                  data-asset-count={slide.assets.length}
                  data-media-field="silver-studio"
                >
                  {assetRows.map((row, rowIndex) => (
                    <div
                      className="reader-visual-slide-row"
                      data-asset-count={row.length}
                      key={`${slide.title}:${rowIndex}`}
                    >
                      {row.map((asset) =>
                        asset.chrome === "mac-menu-bar" ? (
                          <MacPanelFrame
                            alt={asset.alt}
                            height={asset.height}
                            key={asset.src}
                            loading="lazy"
                            src={asset.src}
                            width={asset.width}
                          />
                        ) : (
                          <img
                            alt={asset.alt}
                            height={asset.height}
                            key={asset.src}
                            loading="lazy"
                            src={asset.src}
                            width={asset.width}
                          />
                        ),
                      )}
                    </div>
                  ))}
                </div>
                <figcaption>
                  <strong>{slide.title}</strong>
                  <span>{slide.caption}</span>
                </figcaption>
              </figure>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <button
      aria-label={`Open ${format} visual in reader: ${block.purpose}`}
      className={`reader-visual-trigger${ready ? "" : " reader-visual-draft"}`}
      data-format={format}
      data-status={block.status}
      onClick={(event) => {
        trackPortfolioInsight("evidence_open", {
          content_id: insightContent.contentId,
          content_kind: insightContent.contentKind,
          evidence_id: block.id,
          evidence_kind: format,
        });
        onOpen?.(block, event.currentTarget);
      }}
      type="button"
    >
      <figure
        className={ready ? "reader-visual-block" : "reader-visual-placeholder"}
        data-format={format}
        {...(ready ? { "data-media-surface": "floating" } : {})}
      >
        {ready && thumbnailSrc ? (
          <img alt={thumbnailAlt} loading="lazy" src={thumbnailSrc} />
        ) : (
          <ReaderPlaceholderFrame
            format={format}
            sourceStatus={block.sourceStatus}
            treatment={block.treatment}
          />
        )}
        <figcaption>
          <span>{block.caption ?? block.purpose}</span>
        </figcaption>
      </figure>
    </button>
  );
}

function ReaderVisualOverlay({
  block,
  initialFrame,
  onClose,
}: {
  block: PortfolioVisualBlock;
  initialFrame: number;
  onClose: () => void;
}) {
  const format = portfolioVisualFormat(block);
  const assets = block.slides?.flatMap((slide) => slide.assets) ??
    (format !== "video" && block.src ? [{ alt: block.alt ?? "", src: block.src }] : []);
  const [frame, setFrame] = useState(Math.min(initialFrame, Math.max(assets.length - 1, 0)));
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const asset = assets[frame];

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  const overlay = (
    <section
      aria-label={`Visual in reader: ${block.purpose}`}
      aria-modal="true"
      className="reader-visual-overlay"
      data-format={format}
      data-media-surface="floating"
      data-scope="reader"
      role="dialog"
    >
      <div className="reader-visual-overlay-media">
        {asset?.chrome === "mac-menu-bar" ? (
          <MacPanelFrame alt={asset.alt} src={asset.src} />
        ) : asset ? (
          <img alt={asset.alt} src={asset.src} />
        ) : (
          <ReaderPlaceholderFrame
            format={portfolioVisualFormat(block)}
            frame={frame + 1}
            frameCount={Math.max(assets.length, 1)}
            sourceStatus={block.sourceStatus}
            treatment={block.treatment}
          />
        )}
      </div>
      <div className="reader-visual-overlay-footer">
        <p className="reader-visual-overlay-caption">
          {asset?.label ?? block.caption ?? block.purpose}
        </p>
        {assets.length > 1 ? (
          <div className="reader-visual-overlay-navigation">
            <PortfolioControlMark
              aria-label="Previous visual frame"
              kind="previous"
              onClick={() => setFrame((current) => (current - 1 + assets.length) % assets.length)}
            />
            <span aria-live="polite">{frame + 1} of {assets.length}</span>
            <PortfolioControlMark
              aria-label="Next visual frame"
              kind="next"
              onClick={() => setFrame((current) => (current + 1) % assets.length)}
            />
          </div>
        ) : null}
      </div>
      <PortfolioControlMark
        aria-label="Close visual in reader"
        className="reader-visual-overlay-close"
        kind="close"
        onClick={onClose}
        ref={closeRef}
      />
    </section>
  );
  return overlay;
}

// A paragraph's inline `[label](record:id)` links become in-dossier controls:
// real buttons, so the cursor contract (Rule 6.7) and keyboard focus hold.
function LinkedParagraph({
  insightContent,
  onSelect,
  onSelectThread,
  text,
}: Pick<PortfolioReaderProps, "onSelect" | "onSelectThread"> & {
  insightContent: InsightContent;
  text: string;
}) {
  return parseInlineLinks(text).map((segment, index) => {
    if (segment.type === "text") return segment.text;
    const { target } = segment;
    if (target.kind === "external") {
      // An address off the site: the paragraph's voice in ink, opened in a
      // new tab so the dossier keeps its place.
      return (
        <a
          className="reader-inline-link"
          data-external="true"
          href={target.href}
          key={`link-${index}`}
          onClick={() => trackPortfolioInsight("evidence_open", {
            content_id: insightContent.contentId,
            content_kind: insightContent.contentKind,
            evidence_kind: "external",
          })}
          rel="noopener noreferrer"
          target="_blank"
        >
          {segment.text}
        </a>
      );
    }
    const node = target.kind === "record" ? portfolioWorldNodeById.get(target.id) : undefined;
    const thread = target.kind === "thread" ? portfolioThreadById.get(target.id) : undefined;
    if (!node && !thread) return segment.text;
    return (
      <InlineRecordLink
        key={`link-${index}`}
        label={segment.text}
        node={node}
        onSelect={onSelect}
        onSelectThread={onSelectThread}
        thread={thread}
      />
    );
  });
}

// One in-dossier link. It wears its target's map register, so the phrase
// reads in the same colour as the node it opens, and while a fine pointer
// rests on it (or keyboard focus reaches it) a still of the target's lead
// visual floats beside the phrase within the Reader's visible bounds.
// The still mounts only then, so the home page does not fetch every
// record's image on open.
function InlineRecordLink({
  label,
  node,
  onSelect,
  onSelectThread,
  thread,
}: Pick<PortfolioReaderProps, "onSelect" | "onSelectThread"> & {
  label: string;
  node?: PortfolioWorldNode;
  thread?: PortfolioThread;
}) {
  const [previewing, setPreviewing] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const previewRef = useRef<HTMLSpanElement>(null);
  const targetNode = node ?? portfolioWorldNodeById.get(thread!.nodeId);
  const preview = useMemo(
    () => portfolioLinkPreview((node ?? thread!).body, (node ?? thread!).id),
    [node, thread],
  );
  useLayoutEffect(() => {
    const link = linkRef.current;
    const image = previewRef.current;
    const pane = link?.closest<HTMLElement>(".reader-scroll");
    if (!previewing || !link || !image || !pane) return;
    const position = () => {
      const paneRect = pane.getBoundingClientRect();
      const styles = getComputedStyle(image);
      const gap = parseFloat(styles.getPropertyValue("--reader-space-1")) || 8;
      const inset = parseFloat(styles.getPropertyValue("--reader-space-2")) || 16;
      const bounds = {
        left: Math.max(0, paneRect.left) + inset,
        right: Math.min(window.innerWidth, paneRect.right) - inset,
        top: Math.max(0, paneRect.top) + inset,
        bottom: Math.min(window.innerHeight, paneRect.bottom) - inset,
      };
      image.style.maxWidth = `${Math.max(0, Math.min(400, bounds.right - bounds.left))}px`;
      image.style.maxHeight = "";
      const anchor = link.getBoundingClientRect();
      const available = portfolioLinkPreviewLayout(anchor, bounds, image.getBoundingClientRect(), gap);
      image.style.maxHeight = `${available.height}px`;
      const layout = portfolioLinkPreviewLayout(anchor, bounds, image.getBoundingClientRect(), gap);
      image.style.left = `${layout.left}px`;
      image.style.top = `${layout.top}px`;
      image.dataset.placement = layout.placement;
    };
    const dismiss = () => setPreviewing(false);
    position();
    image.addEventListener("load", position, true);
    pane.addEventListener("scroll", dismiss, { passive: true });
    window.addEventListener("resize", position);
    window.addEventListener("scroll", dismiss, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(position);
    observer?.observe(pane);
    return () => {
      image.removeEventListener("load", position, true);
      pane.removeEventListener("scroll", dismiss);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", dismiss);
      observer?.disconnect();
    };
  }, [previewing, preview]);
  return (
    <span className="reader-inline-link-anchor" data-register={targetNode?.register}>
      <a
        ref={linkRef}
        className="reader-inline-link"
        data-register={targetNode?.register}
        onBlur={() => setPreviewing(false)}
        href={`/index/${node?.id ?? thread!.nodeId}`}
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          if (node) onSelect(node);
          else onSelectThread(thread!.id);
        }}
        onFocus={() => setPreviewing(true)}
        onMouseEnter={() => setPreviewing(true)}
        onMouseLeave={() => setPreviewing(false)}
      >
        {label}
      </a>
      {preview && previewing ? (
        <span
          aria-hidden="true"
          className="reader-inline-link-preview"
          data-treatment={preview.treatment}
          ref={previewRef}
          style={preview.treatment ? {
            maskImage: `url("${preview.src}")`,
            WebkitMaskImage: `url("${preview.src}")`,
          } : undefined}
        >
          <img alt="" src={preview.src} />
        </span>
      ) : null}
    </span>
  );
}

// One authored paragraph: a single <p>, or, when the string carries `- `
// lines, a group of prose runs and bulleted lists.
function ParagraphFlow({
  insightContent,
  onSelect,
  onSelectThread,
  text,
}: Pick<PortfolioReaderProps, "onSelect" | "onSelectThread"> & {
  insightContent: InsightContent;
  text: string;
}) {
  return parseParagraphFlow(text).map((run, index) =>
    run.type === "prose" ? (
      <p key={`run-${index}`}>
        <LinkedParagraph
          insightContent={insightContent}
          onSelect={onSelect}
          onSelectThread={onSelectThread}
          text={run.text}
        />
      </p>
    ) : (
      <ul className="reader-list" key={`run-${index}`}>
        {run.items.map((item, itemIndex) => (
          <li key={`item-${itemIndex}`}>
            <LinkedParagraph
              insightContent={insightContent}
              onSelect={onSelect}
              onSelectThread={onSelectThread}
              text={item}
            />
          </li>
        ))}
      </ul>
    ),
  );
}

function PortfolioBody({
  body,
  insightContent,
  onOpenVisual,
  onSelect,
  onSelectThread,
  videoPreviewsPaused,
}: Pick<PortfolioReaderProps, "onSelect" | "onSelectThread"> & {
  body: readonly PortfolioBodyBlock[];
  insightContent: InsightContent;
  onOpenVisual?: OpenVisual;
  videoPreviewsPaused?: boolean;
}) {
  return (
    <section className="reader-composed-body">
      {body.map((block, index) => {
        if (typeof block === "string") {
          return paragraphHasList(block) ? (
            <div className="reader-paragraph-group" key={`paragraph-${index}`}>
              <ParagraphFlow
                insightContent={insightContent}
                onSelect={onSelect}
                onSelectThread={onSelectThread}
                text={block}
              />
            </div>
          ) : (
            <p key={`paragraph-${index}`}>
              <LinkedParagraph
                insightContent={insightContent}
                onSelect={onSelect}
                onSelectThread={onSelectThread}
                text={block}
              />
            </p>
          );
        }
        if (block.type === "copy-placeholder") {
          return (
            <aside
              aria-label={`Copy in progress: ${block.prompt}`}
              className="reader-copy-placeholder reader-text-placeholder"
              key={block.id}
            >
              <span className="reader-placeholder-label">
                {portfolioInterfaceText["reader.copyInProgress"]}
              </span>
              <strong>{block.prompt}</strong>
              {block.questions?.length ? (
                <ul>
                  {block.questions.map((question, questionIndex) => (
                    <li key={`question-${questionIndex}`}>{question}</li>
                  ))}
                </ul>
              ) : null}
            </aside>
          );
        }
        return (
          <VisualBlock
            block={block}
            insightContent={insightContent}
            key={block.id}
            onOpen={onOpenVisual}
            videoPaused={videoPreviewsPaused}
          />
        );
      })}
    </section>
  );
}

function ThreadRecord({
  onOpenVisual,
  onSelect,
  onSelectThread,
  threadId,
  videoPreviewsPaused,
}: {
  onOpenVisual?: OpenVisual;
  onSelect: (node: PortfolioWorldNode) => void;
  onSelectThread: (threadId: string) => void;
  threadId: string;
  videoPreviewsPaused?: boolean;
}) {
  const thread = portfolioThreadById.get(threadId);
  if (!thread) return null;
  return (
    <div className="reader-content reader-thread-content">
      <h1>{thread.title}</h1>
      <p className="reader-summary">{thread.lede}</p>
      <PortfolioBody
        body={thread.body}
        insightContent={{ contentId: thread.id, contentKind: "thread" }}
        onOpenVisual={onOpenVisual}
        onSelect={onSelect}
        onSelectThread={onSelectThread}
        videoPreviewsPaused={videoPreviewsPaused}
      />
      <section className="reader-record-section reader-related-section">
        <h2>{portfolioInterfaceText["reader.exploreThread"]}</h2>
        <ul className="reader-rows">
          {thread.members.map((nodeId) => {
            const node = portfolioWorldNodeById.get(nodeId);
            return node ? <IndexRow key={node.id} node={node} onSelect={onSelect} /> : null;
          })}
        </ul>
      </section>
    </div>
  );
}

function ContactRow({
  children,
  href,
  kind,
  ...rest
}: {
  children: ReactNode;
  href: string;
  kind: PortfolioContactMarkKind;
  download?: boolean;
  rel?: string;
  target?: string;
}) {
  return (
    <li>
      <a
        className="reader-index-row reader-contact-row"
        href={href}
        onClick={() => trackPortfolioInsight("contact_action", {
          contact_kind: kind,
        })}
        {...rest}
      >
        {children}
        <PortfolioContactMark kind={kind} />
      </a>
    </li>
  );
}

function ContactSection() {
  return (
    <section className="reader-record-section reader-contact">
      <h2>{portfolioInterfaceText["reader.contactTitle"]}</h2>
      <ul className="reader-rows">
        <ContactRow href={`mailto:${portfolioContact.email}`} kind="email">
          <span>{portfolioContact.email}</span>
        </ContactRow>
        <ContactRow download href={portfolioContact.cv.href} kind="cv">
          <span>{portfolioContact.cv.label}</span>
        </ContactRow>
        {portfolioContact.socials.map(({ label, href, key }) => (
          <ContactRow
            href={href}
            key={key}
            kind={key}
            rel="noreferrer"
            target="_blank"
          >
            <span>{label}</span>
          </ContactRow>
        ))}
      </ul>
    </section>
  );
}

function WorldRecord({
  home = false,
  node,
  onOpenVisual,
  onSelect,
  onSelectThread,
  videoPreviewsPaused,
}: {
  /**
   * The About record doubles as the home state: its summary is the title
   * (the map mast already carries the name), Contact follows the body, and
   * there is no Related section, which Contents covers.
   */
  home?: boolean;
  node: PortfolioWorldNode;
  onOpenVisual?: OpenVisual;
  onSelect: (node: PortfolioWorldNode) => void;
  onSelectThread: (threadId: string) => void;
  videoPreviewsPaused?: boolean;
}) {
  const relatedIds = new Set<string>();
  for (const { from, to } of portfolioWorldLinks) {
    if (from === node.id) relatedIds.add(to);
    if (to === node.id) relatedIds.add(from);
  }
  const containingThreads = portfolioThreads.filter(({ members }) =>
    members.includes(node.id),
  );
  // Related is one bundle: the record's containing threads first, then its
  // linked records. A record opened from within a thread renders the same
  // way — the map's foregrounded constellation carries that context.
  const hasRelated = containingThreads.length > 0 || relatedIds.size > 0;
  return (
    <div className="reader-content reader-record-content">
      <h1>{node.label}</h1>
      <p
        className={`reader-summary${node.summaryStatus === "placeholder" ? " reader-summary-placeholder reader-text-placeholder" : ""}`}
      >
        {node.summary}
      </p>
      {node.body.length > 0 ? (
        <PortfolioBody
          body={node.body}
          insightContent={{ contentId: node.id, contentKind: "record" }}
          onOpenVisual={onOpenVisual}
          onSelect={onSelect}
          onSelectThread={onSelectThread}
          videoPreviewsPaused={videoPreviewsPaused}
        />
      ) : null}
      {node.id === HOME_NODE_ID ? <ContactSection /> : null}
      {!home && hasRelated ? (
        <section className="reader-record-section reader-related-section">
          <h2>{portfolioInterfaceText["reader.relatedTitle"]}</h2>
          <ul className="reader-rows">
            {containingThreads.map((thread) => (
              <ThreadIndexRow
                key={thread.id}
                onSelect={onSelectThread}
                thread={thread}
              />
            ))}
            {[...relatedIds].map((nodeId) => {
              const related = portfolioWorldNodeById.get(nodeId);
              return related ? <IndexRow key={related.id} node={related} onSelect={onSelect} /> : null;
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function PortfolioReader({
  activeThreadId,
  onSelect,
  onSelectThread,
  selectedId,
}: PortfolioReaderProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const visualTriggerRef = useRef<HTMLButtonElement | null>(null);
  const visualContext = useMemo(
    () => ({ activeThreadId, selectedId }),
    [activeThreadId, selectedId],
  );
  const [activeVisual, setActiveVisual] = useState<{
    block: PortfolioVisualBlock;
    context: object;
    initialFrame: number;
  } | null>(null);
  const activeReaderVisual = activeVisual?.context === visualContext
    ? activeVisual
    : null;
  const selected = selectedId ? portfolioWorldNodeById.get(selectedId) : undefined;
  // The About record is the home state, so selecting it lands on home.
  const node = selected?.id === HOME_NODE_ID ? undefined : selected;
  const thread = activeThreadId ? portfolioThreadById.get(activeThreadId) : undefined;
  const mode = node && node.outlineType !== "why"
    ? "record"
    : thread
      ? "thread"
      : "about";
  const label = node && node.outlineType !== "why"
    ? `${node.label} record`
    : thread
      ? `${thread.title} theme`
      : "Portfolio home";
  const insightContentId = thread && (!node || node.outlineType === "why")
    ? thread.id
    : node?.id ?? homeNode.id;
  const insightContentKind: InsightContent["contentKind"] =
    thread && (!node || node.outlineType === "why") ? "thread" : "record";
  // Not read during render: the server yields false and a client with
  // ?review=clean yields true, so reading it inline changed the className
  // between the server HTML and the first client render. The subscribe
  // callback is a no-op because the flag cannot change without a navigation.
  const cleanReview = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("review") === "clean",
    () => false,
  );

  const openVisual = useCallback<OpenVisual>((block, trigger, initialFrame = 0) => {
    visualTriggerRef.current = trigger;
    setActiveVisual({
      block,
      context: visualContext,
      initialFrame,
    });
  }, [visualContext]);

  const closeVisual = useCallback(() => {
    const trigger = visualTriggerRef.current;
    setActiveVisual(null);
    window.setTimeout(() => {
      if (trigger?.isConnected) trigger.focus();
      if (visualTriggerRef.current === trigger) visualTriggerRef.current = null;
    }, 0);
  }, []);

  // Every selection opens at its top. The scroll element stays mounted so the
  // Reading Room can move this Reader between slots without replacing it.
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = 0;
  }, [activeThreadId, mode, selectedId]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    const now = () => performance.now();
    const attention = new PortfolioAttention({
      focused: document.hasFocus(),
      now: now(),
      visible: document.visibilityState === "visible",
    });
    let lastReport = "";
    const scrollPosition = () => ({
      clientHeight: scroll.clientHeight,
      scrollHeight: scroll.scrollHeight,
      scrollTop: scroll.scrollTop,
    });
    const report = (snapshot: ReturnType<PortfolioAttention["observe"]>) => {
      if (snapshot.activeMilliseconds < 1_000) return;
      const signature = `${Math.floor(snapshot.activeMilliseconds / 1_000)}:${snapshot.completionPercent}`;
      if (signature === lastReport) return;
      if (trackPortfolioAttention({
        contentId: insightContentId,
        contentKind: insightContentKind,
      }, snapshot)) lastReport = signature;
    };
    const sample = () => attention.observe({ now: now(), scroll: scrollPosition() });
    const handleScroll = () => {
      attention.observe({ activity: true, now: now(), scroll: scrollPosition() });
    };
    const handleActivity = () => {
      attention.observe({ activity: true, now: now() });
    };
    const handleFocus = () => {
      attention.observe({ focused: true, now: now() });
    };
    const handleBlur = () => {
      report(attention.observe({ focused: false, now: now(), scroll: scrollPosition() }));
    };
    const handleVisibility = () => {
      const snapshot = attention.observe({
        now: now(),
        scroll: scrollPosition(),
        visible: document.visibilityState === "visible",
      });
      if (document.visibilityState !== "visible") report(snapshot);
    };
    const handlePageHide = () => report(sample());
    const interval = window.setInterval(() => report(sample()), 15_000);

    scroll.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("keydown", handleActivity);
    document.addEventListener("pointerdown", handleActivity);
    document.addEventListener("touchstart", handleActivity, { passive: true });

    return () => {
      window.clearInterval(interval);
      scroll.removeEventListener("scroll", handleScroll);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("keydown", handleActivity);
      document.removeEventListener("pointerdown", handleActivity);
      document.removeEventListener("touchstart", handleActivity);
      report(sample());
    };
  }, [insightContentId, insightContentKind]);

  return (
    <aside
      aria-label={label}
      className={`portfolio-reader${cleanReview ? " portfolio-reader-clean-review" : ""}`}
      data-reader-mode={mode}
    >
      <div
        className="reader-scroll"
        inert={Boolean(activeReaderVisual)}
        ref={scrollRef}
      >
        {node && node.outlineType !== "why" ? (
          <WorldRecord
            node={node}
            onOpenVisual={openVisual}
            onSelect={onSelect}
            onSelectThread={onSelectThread}
            videoPreviewsPaused={Boolean(activeReaderVisual)}
          />
        ) : thread ? (
          <ThreadRecord
            onOpenVisual={openVisual}
            onSelect={onSelect}
            onSelectThread={onSelectThread}
            threadId={thread.id}
            videoPreviewsPaused={Boolean(activeReaderVisual)}
          />
        ) : (
          <WorldRecord
            home
            node={homeNode}
            onOpenVisual={openVisual}
            onSelect={onSelect}
            onSelectThread={onSelectThread}
            videoPreviewsPaused={Boolean(activeReaderVisual)}
          />
        )}
        {/* Privacy is the dossier's last line and appears only once the
            reader has scrolled to the end. */}
        <a className="reader-privacy" href="/privacy">
          {portfolioInterfaceText["reader.privacyLink"]}
        </a>
      </div>
      {activeReaderVisual ? (
        <ReaderVisualOverlay
          block={activeReaderVisual.block}
          initialFrame={activeReaderVisual.initialFrame}
          key={`${activeReaderVisual.block.id}:${activeReaderVisual.initialFrame}`}
          onClose={closeVisual}
        />
      ) : null}
    </aside>
  );
}
