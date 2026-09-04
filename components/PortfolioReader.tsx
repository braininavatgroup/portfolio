"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  PortfolioContactMark,
  PortfolioControlMark,
  PortfolioNodeMark,
} from "./PortfolioNodeMark";
import type { PortfolioContactMarkKind } from "../lib/portfolio-contact-mark";
import { EditableText } from "./editor/EditableText";
import { EditorStatusLine } from "./editor/EditorStatusLine";
import { parseInlineLinks } from "../lib/portfolio-inline-links";
import { paragraphHasList, parseParagraphFlow } from "../lib/portfolio-paragraph";
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
        <EditableText path={`records.${node.id}.label`} value={node.label} />
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
        <EditableText path={`threads.${thread.id}.title`} value={thread.title} />
        <PortfolioNodeMark family={node.family} register={node.register} />
      </button>
    </li>
  );
}

/**
 * The draft-state frame a planned visual shows in place of its asset: the
 * kind top-left in the label voice, `treatment · sourceStatus` bottom-left in
 * the caption voice, a play ring for video, a frame count for a gallery. The
 * visual stage draws the same frame over the map, so it is exported.
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
  contentBase,
  insightContent,
  onOpen,
  videoPaused = false,
}: {
  block: PortfolioVisualBlock;
  contentBase: string;
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
  const captionField = block.caption !== undefined ? "caption" : "purpose";
  const inlineVideoRef = useVisibleVideoPlayback(videoPaused);

  if (ready && format === "video" && block.src) {
    return (
      <button
        aria-label={`Open video in reader: ${block.purpose}`}
        className="reader-visual-trigger"
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
            <video
              aria-label={block.alt ?? block.purpose}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              ref={inlineVideoRef}
            >
              <source src={block.src} type="video/mp4" />
              <track default kind="captions" src={block.captionsSrc} srcLang="en" />
            </video>
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
          </div>
          <figcaption>
            <EditableText
              path={`${contentBase}.visuals.${block.id}.${captionField}`}
              value={block.caption ?? block.purpose}
            />
          </figcaption>
        </figure>
      </button>
    );
  }

  if (ready && format === "gallery" && block.slides?.length) {
    return (
      <div className="reader-visual-gallery">
        {block.slides.map((slide, slideIndex) => {
          const initialFrame = block.slides!
            .slice(0, slideIndex)
            .reduce((count, prior) => count + prior.assets.length, 0);
          return (
            <button
              aria-label={`Open gallery visual in reader: ${slide.title}. ${block.purpose}`}
              className="reader-visual-trigger"
              data-format={format}
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
                  style={
                    { "--visual-asset-count": slide.assets.length } as CSSProperties
                  }
                >
                  {slide.assets.map((asset) => (
                    <img
                      alt={asset.alt}
                      key={asset.src}
                      loading="lazy"
                      src={asset.src}
                    />
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
          <EditableText
            path={`${contentBase}.visuals.${block.id}.${captionField}`}
            value={block.caption ?? block.purpose}
          />
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
  const videoSrc = format === "video" ? block.src : undefined;
  const assets = format === "video"
    ? []
    : block.slides?.flatMap((slide) => slide.assets) ??
      (block.src ? [{ alt: block.alt ?? "", src: block.src }] : []);
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
      aria-label={`${format === "video" ? "Video full screen" : "Visual in reader"}: ${block.purpose}`}
      className="reader-visual-overlay"
      data-format={format}
      data-media-surface="floating"
      data-scope={format === "video" ? "viewport" : "reader"}
    >
      <div className="reader-visual-overlay-media">
        {videoSrc ? (
          <video
            aria-label={block.alt ?? block.purpose}
            autoPlay
            controls
            loop
            muted
            playsInline
            preload="metadata"
            src={videoSrc}
          >
            <track default kind="captions" src={block.captionsSrc} srcLang="en" />
          </video>
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
      <p className="reader-visual-overlay-caption">{block.caption ?? block.purpose}</p>
      {assets.length > 1 ? (
        <div className="reader-visual-overlay-navigation">
          <PortfolioControlMark
            aria-label="Previous visual frame"
            kind="previous"
            onClick={() => setFrame((current) => (current - 1 + assets.length) % assets.length)}
          />
          <span aria-live="polite">{frame + 1} / {assets.length}</span>
          <PortfolioControlMark
            aria-label="Next visual frame"
            kind="next"
            onClick={() => setFrame((current) => (current + 1) % assets.length)}
          />
        </div>
      ) : null}
      <PortfolioControlMark
        aria-label="Close visual in reader"
        className="reader-visual-overlay-close"
        kind="close"
        onClick={onClose}
        ref={closeRef}
      />
    </section>
  );

  if (format !== "video" || typeof document === "undefined") return overlay;
  const composition = document.querySelector<HTMLElement>(".portfolio-composition");
  return createPortal(overlay, composition ?? document.body);
}

// Pairs each prose block with its stable paragraph ID (p1, p2, … in authored
// order), matching the content document's path grammar.
function bodyWithParagraphIds(body: readonly PortfolioBodyBlock[]) {
  const entries: Array<{ block: PortfolioBodyBlock; paragraphId: string | null }> = [];
  let paragraphCount = 0;
  for (const block of body) {
    if (typeof block === "string") {
      paragraphCount += 1;
      entries.push({ block, paragraphId: `p${paragraphCount}` });
    } else {
      entries.push({ block, paragraphId: null });
    }
  }
  return entries;
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
    // The link wears its target's map register, so the phrase reads in the
    // same colour as the node it opens.
    const register = node
      ? node.register
      : portfolioWorldNodeById.get(thread!.nodeId)?.register;
    return (
      <button
        className="reader-inline-link"
        data-register={register}
        key={`link-${index}`}
        onClick={() => (node ? onSelect(node) : onSelectThread(target.id))}
        type="button"
      >
        {segment.text}
      </button>
    );
  });
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
  contentBase,
  insightContent,
  onOpenVisual,
  onSelect,
  onSelectThread,
  videoPreviewsPaused,
}: Pick<PortfolioReaderProps, "onSelect" | "onSelectThread"> & {
  body: readonly PortfolioBodyBlock[];
  contentBase: string;
  insightContent: InsightContent;
  onOpenVisual?: OpenVisual;
  videoPreviewsPaused?: boolean;
}) {
  return (
    <section className="reader-composed-body">
      {bodyWithParagraphIds(body).map(({ block, paragraphId }, index) => {
        if (typeof block === "string") {
          const listed = paragraphHasList(block);
          return (
            <EditableText
              as={listed ? "div" : "p"}
              {...(listed ? { className: "reader-paragraph-group" } : {})}
              key={`paragraph-${index}`}
              multiline
              path={`${contentBase}.paragraphs.${paragraphId}`}
              render={(text) =>
                listed ? (
                  <ParagraphFlow
                    insightContent={insightContent}
                    onSelect={onSelect}
                    onSelectThread={onSelectThread}
                    text={text}
                  />
                ) : (
                  <LinkedParagraph
                    insightContent={insightContent}
                    onSelect={onSelect}
                    onSelectThread={onSelectThread}
                    text={text}
                  />
                )
              }
              value={block}
            />
          );
        }
        if (block.type === "copy-placeholder") {
          return (
            <aside
              aria-label={`Copy in progress: ${block.prompt}`}
              className="reader-copy-placeholder reader-text-placeholder"
              key={block.id}
            >
              <EditableText
                as="span"
                className="reader-placeholder-label"
                path="interface.reader.copyInProgress"
                value={portfolioInterfaceText["reader.copyInProgress"]}
              />
              <EditableText
                as="strong"
                path={`${contentBase}.placeholders.${block.id}.prompt`}
                value={block.prompt}
              />
              {block.questions?.length ? (
                <ul>
                  {block.questions.map((question, questionIndex) => (
                    <EditableText
                      as="li"
                      key={`question-${questionIndex}`}
                      path={`${contentBase}.placeholders.${block.id}.questions.q${questionIndex + 1}`}
                      value={question}
                    />
                  ))}
                </ul>
              ) : null}
            </aside>
          );
        }
        return (
          <VisualBlock
            block={block}
            contentBase={contentBase}
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
      <EditableText as="h1" path={`threads.${thread.id}.title`} value={thread.title} />
      <EditableText
        as="p"
        className="reader-summary"
        path={`threads.${thread.id}.lede`}
        value={thread.lede}
      />
      <PortfolioBody
        body={thread.body}
        contentBase={`threads.${thread.id}`}
        insightContent={{ contentId: thread.id, contentKind: "thread" }}
        onOpenVisual={onOpenVisual}
        onSelect={onSelect}
        onSelectThread={onSelectThread}
        videoPreviewsPaused={videoPreviewsPaused}
      />
      <section className="reader-record-section">
        <EditableText
          as="h2"
          path="interface.reader.exploreThread"
          value={portfolioInterfaceText["reader.exploreThread"]}
        />
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
      <EditableText
        as="h2"
        path="interface.reader.contactTitle"
        value={portfolioInterfaceText["reader.contactTitle"]}
      />
      <ul className="reader-rows">
        <ContactRow href={`mailto:${portfolioContact.email}`} kind="email">
          <EditableText path="contact.email" value={portfolioContact.email} />
        </ContactRow>
        <ContactRow download href={portfolioContact.cv.href} kind="cv">
          <EditableText path="contact.cvLabel" value={portfolioContact.cv.label} />
        </ContactRow>
        {portfolioContact.socials.map(({ label, href, key }) => (
          <ContactRow
            href={href}
            key={key}
            kind={key}
            rel="noreferrer"
            target="_blank"
          >
            <EditableText path={`contact.socialLabels.${key}`} value={label} />
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
      {home ? (
        <EditableText as="h1" path={`records.${node.id}.summary`} value={node.summary} />
      ) : (
        <>
          <EditableText as="h1" path={`records.${node.id}.label`} value={node.label} />
          <EditableText
            as="p"
            className={`reader-summary${node.summaryStatus === "placeholder" ? " reader-summary-placeholder reader-text-placeholder" : ""}`}
            path={`records.${node.id}.summary`}
            value={node.summary}
          />
        </>
      )}
      {node.body.length > 0 ? (
        <PortfolioBody
          body={node.body}
          contentBase={`records.${node.id}`}
          insightContent={{ contentId: node.id, contentKind: "record" }}
          onOpenVisual={onOpenVisual}
          onSelect={onSelect}
          onSelectThread={onSelectThread}
          videoPreviewsPaused={videoPreviewsPaused}
        />
      ) : null}
      {node.id === HOME_NODE_ID ? <ContactSection /> : null}
      {!home && hasRelated ? (
        <section className="reader-record-section">
          <EditableText
            as="h2"
            path="interface.reader.relatedTitle"
            value={portfolioInterfaceText["reader.relatedTitle"]}
          />
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
      ? `${thread.title} thread`
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
        ref={scrollRef}
      >
        {node && node.outlineType !== "why" ? (
          <WorldRecord
            node={node}
            onOpenVisual={openVisual}
            onSelect={onSelect}
            onSelectThread={onSelectThread}
            videoPreviewsPaused={Boolean(activeVisual?.context === visualContext)}
          />
        ) : thread ? (
          <ThreadRecord
            onOpenVisual={openVisual}
            onSelect={onSelect}
            onSelectThread={onSelectThread}
            threadId={thread.id}
            videoPreviewsPaused={Boolean(activeVisual?.context === visualContext)}
          />
        ) : (
          <WorldRecord
            home
            node={homeNode}
            onOpenVisual={openVisual}
            onSelect={onSelect}
            onSelectThread={onSelectThread}
            videoPreviewsPaused={Boolean(activeVisual?.context === visualContext)}
          />
        )}
        <EditorStatusLine />
        {/* Privacy is the dossier's last line and appears only once the
            reader has scrolled to the end. */}
        <a className="reader-privacy" href="/privacy">
          <EditableText
            path="interface.reader.privacyLink"
            value={portfolioInterfaceText["reader.privacyLink"]}
          />
        </a>
      </div>
      {activeVisual?.context === visualContext ? (
        <ReaderVisualOverlay
          block={activeVisual.block}
          initialFrame={activeVisual.initialFrame}
          key={`${activeVisual.block.id}:${activeVisual.initialFrame}`}
          onClose={closeVisual}
        />
      ) : null}
    </aside>
  );
}
