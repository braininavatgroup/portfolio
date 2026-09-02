"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { PortfolioContactMark, PortfolioNodeMark } from "./PortfolioNodeMark";
import type { PortfolioContactMarkKind } from "../lib/portfolio-contact-mark";
import { EditableText } from "./editor/EditableText";
import { EditorStatusLine } from "./editor/EditorStatusLine";
import type { AvatarTargetId } from "../lib/avatar/contracts";
import { parseInlineLinks } from "../lib/portfolio-inline-links";
import {
  portfolioContact,
  portfolioInterfaceText,
  portfolioThreads,
  portfolioThreadById,
  portfolioVisualFormat,
  isPortfolioVisualReady,
  portfolioWorldIndexSections,
  portfolioWorldLinks,
  portfolioWorldNodeById,
  isPortfolioWhatNode,
  type PortfolioBodyBlock,
  type PortfolioThread,
  type PortfolioVisualBlock,
  type PortfolioVisualFormat,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";

const HOME_NODE_ID = "bradley";
const homeNode = portfolioWorldNodeById.get(HOME_NODE_ID)!;

type PortfolioReaderProps = {
  activeThreadId: string | null;
  onOpenVisual?: (
    block: PortfolioVisualBlock,
    trigger: HTMLButtonElement,
  ) => void;
  /** True when the footer's Index control has opened the index state. */
  indexOpen?: boolean;
  onOpenIndex?: () => void;
  onReset: () => void;
  onSelect: (node: PortfolioWorldNode) => void;
  onSelectThread: (threadId: string) => void;
  registerAvatarTarget?: (
    target: AvatarTargetId,
    element: HTMLElement | null,
  ) => void;
  selectedId: string | null;
};

// Every row on the dossier — index, related, explore, contact — is one shape:
// a label in the row voice and the record's mark trailing in its register.
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

function ReaderIndex({
  onSelect,
  onSelectThread,
}: Pick<PortfolioReaderProps, "onSelect" | "onSelectThread">) {
  return (
    <div className="reader-content reader-index-content">
      <EditableText
        as="h1"
        path="interface.reader.indexTitle"
        value={portfolioInterfaceText["reader.indexTitle"]}
      />
      {portfolioWorldIndexSections.map((section) => (
        <section className="reader-index-group" key={section.id}>
          <EditableText
            as="h2"
            path={`interface.${section.titleKey}`}
            value={section.title}
          />
          <ul className="reader-rows">
            {section.type === "threads"
              ? portfolioThreads.map((thread) => (
                  <ThreadIndexRow
                    key={thread.id}
                    onSelect={onSelectThread}
                    thread={thread}
                  />
                ))
              : section.nodeIds.map((nodeId) => {
                  const node = portfolioWorldNodeById.get(nodeId);
                  return node ? <IndexRow key={node.id} node={node} onSelect={onSelect} /> : null;
                })}
          </ul>
        </section>
      ))}
    </div>
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
  sourceStatus,
  treatment,
}: {
  format: PortfolioVisualFormat;
  frame?: number;
  frameCount?: number;
  sourceStatus?: string;
  treatment?: string;
}) {
  const source = [treatment, sourceStatus].filter(Boolean).join(" · ");
  return (
    <div className="reader-placeholder-frame" data-format={format}>
      <span className="reader-placeholder-label">Planned {format}</span>
      {format === "video" ? <span className="reader-placeholder-play" /> : null}
      {format === "gallery" ? (
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
  onOpen,
}: {
  block: PortfolioVisualBlock;
  contentBase: string;
  onOpen?: (
    block: PortfolioVisualBlock,
    trigger: HTMLButtonElement,
  ) => void;
}) {
  const format = portfolioVisualFormat(block);
  const thumbnailSrc =
    block.poster ??
    (format !== "video" ? block.src : undefined);
  const thumbnailAlt = block.alt ?? "";
  const ready = isPortfolioVisualReady(block);
  const captionField = block.caption !== undefined ? "caption" : "purpose";

  return (
    <button
      aria-label={`Open ${format} visual in map: ${block.purpose}`}
      className={`reader-visual-trigger${ready ? "" : " reader-visual-draft"}`}
      data-format={format}
      data-status={block.status}
      onClick={(event) => onOpen?.(block, event.currentTarget)}
      type="button"
    >
      <figure
        className={ready ? "reader-visual-block" : "reader-visual-placeholder"}
        data-format={format}
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
  onSelect,
  onSelectThread,
  text,
}: Pick<PortfolioReaderProps, "onSelect" | "onSelectThread"> & { text: string }) {
  return parseInlineLinks(text).map((segment, index) => {
    if (segment.type === "text") return segment.text;
    const { target } = segment;
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

function PortfolioBody({
  body,
  contentBase,
  onOpenVisual,
  onSelect,
  onSelectThread,
}: Pick<PortfolioReaderProps, "onSelect" | "onSelectThread"> & {
  body: readonly PortfolioBodyBlock[];
  contentBase: string;
  onOpenVisual?: (
    block: PortfolioVisualBlock,
    trigger: HTMLButtonElement,
  ) => void;
}) {
  return (
    <section className="reader-composed-body">
      {bodyWithParagraphIds(body).map(({ block, paragraphId }, index) => {
        if (typeof block === "string") {
          return (
            <EditableText
              as="p"
              key={`paragraph-${index}`}
              multiline
              path={`${contentBase}.paragraphs.${paragraphId}`}
              render={(text) => (
                <LinkedParagraph
                  onSelect={onSelect}
                  onSelectThread={onSelectThread}
                  text={text}
                />
              )}
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
            key={block.id}
            onOpen={onOpenVisual}
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
}: {
  onOpenVisual?: (
    block: PortfolioVisualBlock,
    trigger: HTMLButtonElement,
  ) => void;
  onSelect: (node: PortfolioWorldNode) => void;
  onSelectThread: (threadId: string) => void;
  threadId: string;
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
        onOpenVisual={onOpenVisual}
        onSelect={onSelect}
        onSelectThread={onSelectThread}
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
      <a className="reader-index-row reader-contact-row" href={href} {...rest}>
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
}: {
  /**
   * The About record doubles as the home state: its summary is the title
   * (the map mast already carries the name), Contact follows the body, and
   * there is no Related section, which the index state covers.
   */
  home?: boolean;
  node: PortfolioWorldNode;
  onOpenVisual?: (
    block: PortfolioVisualBlock,
    trigger: HTMLButtonElement,
  ) => void;
  onSelect: (node: PortfolioWorldNode) => void;
  onSelectThread: (threadId: string) => void;
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
          onOpenVisual={onOpenVisual}
          onSelect={onSelect}
          onSelectThread={onSelectThread}
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
  indexOpen = false,
  onOpenIndex,
  onOpenVisual,
  onReset,
  onSelect,
  onSelectThread,
  registerAvatarTarget,
  selectedId,
}: PortfolioReaderProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const indexScrollTop = useRef(0);
  const selected = selectedId ? portfolioWorldNodeById.get(selectedId) : undefined;
  // The About record is the home state, so selecting it lands on home.
  const node = selected?.id === HOME_NODE_ID ? undefined : selected;
  const thread = activeThreadId ? portfolioThreadById.get(activeThreadId) : undefined;
  const mode = node && node.outlineType !== "why"
    ? "record"
    : thread
      ? "thread"
      : indexOpen
        ? "index"
        : "home";
  const avatarTarget: AvatarTargetId = node && isPortfolioWhatNode(node)
    ? `portfolio:record:${node.id}`
    : "portfolio:index";
  const setReaderRef = useCallback(
    (element: HTMLElement | null) => {
      registerAvatarTarget?.(avatarTarget, element);
    },
    [avatarTarget, registerAvatarTarget],
  );
  const label = node && node.outlineType !== "why"
    ? `${node.label} record`
    : thread
      ? `${thread.title} thread`
      : mode === "index"
        ? "Portfolio index"
        : "Portfolio home";
  // Not read during render: the server yields false and a client with
  // ?review=clean yields true, so reading it inline changed the className
  // between the server HTML and the first client render. The subscribe
  // callback is a no-op because the flag cannot change without a navigation.
  const cleanReview = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("review") === "clean",
    () => false,
  );

  // The index keeps its scroll position across a round trip; everything else
  // opens at its top, so a row tapped far down the index does not open the
  // record already scrolled past its title.
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = mode === "index" ? indexScrollTop.current : 0;
  }, [activeThreadId, mode, selectedId]);

  return (
    <aside
      aria-label={label}
      className={`portfolio-reader${cleanReview ? " portfolio-reader-clean-review" : ""}`}
      data-reader-mode={mode}
      ref={setReaderRef}
    >
      <div
        className="reader-scroll"
        onScroll={(event) => {
          if (mode === "index") indexScrollTop.current = event.currentTarget.scrollTop;
        }}
        ref={scrollRef}
      >
        {node && node.outlineType !== "why" ? (
          <WorldRecord
            node={node}
            onOpenVisual={onOpenVisual}
            onSelect={onSelect}
            onSelectThread={onSelectThread}
          />
        ) : thread ? (
          <ThreadRecord
            onOpenVisual={onOpenVisual}
            onSelect={onSelect}
            onSelectThread={onSelectThread}
            threadId={thread.id}
          />
        ) : mode === "index" ? (
          <ReaderIndex onSelect={onSelect} onSelectThread={onSelectThread} />
        ) : (
          <WorldRecord
            home
            node={homeNode}
            onOpenVisual={onOpenVisual}
            onSelect={onSelect}
            onSelectThread={onSelectThread}
          />
        )}
      </div>
      {/* One band outside the scroll area: one text control whose label the
          state sets (Index everywhere but the index, where it is Home), then
          Privacy. On mobile the map control sits at the band's right edge. */}
      <footer className="portfolio-reader-footer">
        <nav aria-label="Dossier" className="reader-footer-links">
          {mode === "index" ? (
            <button aria-label="Portfolio home" onClick={onReset} type="button">
              <EditableText
                path="interface.reader.backButton"
                value={portfolioInterfaceText["reader.backButton"]}
              />
            </button>
          ) : onOpenIndex ? (
            <button aria-label="Portfolio index" onClick={onOpenIndex} type="button">
              <EditableText
                path="interface.reader.indexTitle"
                value={portfolioInterfaceText["reader.indexTitle"]}
              />
            </button>
          ) : null}
          <a href="/privacy">
            <EditableText
              path="interface.reader.privacyLink"
              value={portfolioInterfaceText["reader.privacyLink"]}
            />
          </a>
        </nav>
        <EditorStatusLine />
      </footer>
    </aside>
  );
}
