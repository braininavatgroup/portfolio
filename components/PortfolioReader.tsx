"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { PortfolioNodeMark } from "./PortfolioNodeMark";
import { EditableText } from "./editor/EditableText";
import { EditorStatusLine } from "./editor/EditorStatusLine";
import type { AvatarTargetId } from "../lib/avatar/contracts";
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
  type PortfolioBodyBlock,
  type PortfolioThread,
  type PortfolioVisualBlock,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";

type PortfolioReaderProps = {
  activeThreadId: string | null;
  onOpenVisual?: (
    block: PortfolioVisualBlock,
    trigger: HTMLButtonElement,
  ) => void;
  onReset: () => void;
  onSelect: (node: PortfolioWorldNode) => void;
  onSelectThread: (threadId: string) => void;
  registerAvatarTarget?: (
    target: AvatarTargetId,
    element: HTMLElement | null,
  ) => void;
  selectedId: string | null;
  spotlightTarget?: AvatarTargetId | null;
};

function IndexRow({
  node,
  onSelect,
}: {
  node: PortfolioWorldNode;
  onSelect: (node: PortfolioWorldNode) => void;
}) {
  return (
    <button aria-label={node.label} className="reader-index-row" onClick={() => onSelect(node)} type="button">
      <EditableText path={`records.${node.id}.label`} value={node.label} />
      <PortfolioNodeMark family={node.family} register={node.register} />
      <EditableText as="small" path={`records.${node.id}.kind`} value={node.kind} />
    </button>
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
    <button
      aria-label={thread.title}
      className="reader-index-row"
      onClick={() => onSelect(thread.id)}
      type="button"
    >
      <EditableText path={`threads.${thread.id}.title`} value={thread.title} />
      <PortfolioNodeMark family={node.family} register={node.register} />
      <EditableText
        as="small"
        path="interface.reader.threadLabel"
        value={portfolioInterfaceText["reader.threadLabel"]}
      />
    </button>
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
      {portfolioWorldIndexSections.map((section) => {
        if (section.type === "threads") {
          return (
            <section className="reader-index-group reader-thread-index" key={section.id}>
              <EditableText
                as="h2"
                path={`interface.${section.titleKey}`}
                value={section.title}
              />
              {portfolioThreads.map((thread) => (
                <ThreadIndexRow
                  key={thread.id}
                  onSelect={onSelectThread}
                  thread={thread}
                />
              ))}
            </section>
          );
        }

        return (
          <section className="reader-index-group" key={section.id}>
            <EditableText
              as="h2"
              path={`interface.${section.titleKey}`}
              value={section.title}
            />
            {section.nodeIds.map((nodeId) => {
              const node = portfolioWorldNodeById.get(nodeId);
              return node ? <IndexRow key={node.id} node={node} onSelect={onSelect} /> : null;
            })}
          </section>
        );
      })}
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
    block.assets?.[0]?.src ??
    (format === "image" ? block.src : undefined);
  const thumbnailAlt =
    block.assets?.[0]?.alt ??
    block.alt ??
    "";
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
          <div className="reader-placeholder-frame" aria-hidden="true">
            {format === "video" ? (
              <>
                <span className="reader-placeholder-play" />
                <i className="reader-placeholder-timeline" />
              </>
            ) : format === "gallery" ? (
              <>
                <span />
                <span />
                <span />
                <i className="reader-placeholder-count">1 / 3</i>
              </>
            ) : (
              <>
                <span />
                <span />
                <span />
              </>
            )}
          </div>
        )}
        <figcaption>
          {!ready ? (
            <span className="reader-placeholder-label">Planned {format}</span>
          ) : null}
          <EditableText
            as="strong"
            path={`${contentBase}.visuals.${block.id}.${captionField}`}
            value={block.caption ?? block.purpose}
          />
          <span className="reader-placeholder-meta">
            {[format, block.treatment, block.sourceStatus]
              .filter(Boolean)
              .join(" · ")}
          </span>
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

function PortfolioBody({
  body,
  contentBase,
  onOpenVisual,
}: {
  body: readonly PortfolioBodyBlock[];
  contentBase: string;
  onOpenVisual?: (
    block: PortfolioVisualBlock,
    trigger: HTMLButtonElement,
  ) => void;
}) {
  return (
    <section className="reader-record-section reader-composed-body">
      {bodyWithParagraphIds(body).map(({ block, paragraphId }, index) => {
        if (typeof block === "string") {
          return (
            <EditableText
              as="p"
              key={`paragraph-${index}`}
              multiline
              path={`${contentBase}.paragraphs.${paragraphId}`}
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
  threadId,
}: {
  onOpenVisual?: (
    block: PortfolioVisualBlock,
    trigger: HTMLButtonElement,
  ) => void;
  onSelect: (node: PortfolioWorldNode) => void;
  threadId: string;
}) {
  const thread = portfolioThreadById.get(threadId);
  if (!thread) return null;
  const register =
    portfolioWorldNodeById.get(thread.nodeId)?.register ?? "story";
  return (
    <div className="reader-content reader-thread-content">
      <EditableText as="h1" path={`threads.${thread.id}.title`} value={thread.title} />
      <EditableText
        as="p"
        className="reader-kind"
        data-register={register}
        path="interface.reader.threadLabel"
        value={portfolioInterfaceText["reader.threadLabel"]}
      />
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
      />
      <section className="reader-record-section">
        <EditableText
          as="h2"
          path="interface.reader.exploreThread"
          value={portfolioInterfaceText["reader.exploreThread"]}
        />
        {thread.members.map((nodeId) => {
          const node = portfolioWorldNodeById.get(nodeId);
          return node ? <IndexRow key={node.id} node={node} onSelect={onSelect} /> : null;
        })}
      </section>
    </div>
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
      <a href={`mailto:${portfolioContact.email}`}>
        <EditableText path="contact.email" value={portfolioContact.email} />
      </a>
      <a href={portfolioContact.cv.href} download>
        <EditableText path="contact.cvLabel" value={portfolioContact.cv.label} />
      </a>
      {portfolioContact.socials.map(({ label, href, key }) => (
        <a href={href} key={key} rel="noreferrer" target="_blank">
          <EditableText path={`contact.socialLabels.${key}`} value={label} />
        </a>
      ))}
    </section>
  );
}

function WorldRecord({
  activeThreadId,
  node,
  onOpenVisual,
  onSelect,
  onSelectThread,
}: {
  activeThreadId: string | null;
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
  const threadRows = containingThreads.length > 0 ? containingThreads : portfolioThreads;
  const activeThread = activeThreadId
    ? portfolioThreadById.get(activeThreadId)
    : undefined;
  return (
    <div className="reader-content reader-record-content">
      <EditableText as="h1" path={`records.${node.id}.label`} value={node.label} />
      <EditableText
        as="p"
        className="reader-kind"
        data-register={node.register}
        path={`records.${node.id}.kind`}
        value={node.kind}
      />
      {activeThread ? (
        <p className="reader-path">
          <button onClick={() => onSelectThread(activeThread.id)} type="button">
            <EditableText
              path={`threads.${activeThread.id}.title`}
              value={activeThread.title}
            />
          </button>
          <span aria-hidden="true"> / </span>
          <EditableText path={`records.${node.id}.label`} value={node.label} />
        </p>
      ) : null}
      <EditableText
        as="p"
        className={`reader-summary${node.summaryStatus === "placeholder" ? " reader-summary-placeholder reader-text-placeholder" : ""}`}
        path={`records.${node.id}.summary`}
        value={node.summary}
      />
      {node.body.length > 0 ? (
        <PortfolioBody
          body={node.body}
          contentBase={`records.${node.id}`}
          onOpenVisual={onOpenVisual}
        />
      ) : null}
      {node.id === "bradley" ? <ContactSection /> : null}
      {node.id === "bradley" || containingThreads.length > 0 ? (
        <section className="reader-record-section">
          <EditableText
            as="h2"
            path="interface.reader.threadsTitle"
            value={portfolioInterfaceText["reader.threadsTitle"]}
          />
          {threadRows.map((thread) => (
            <ThreadIndexRow
              key={thread.id}
              onSelect={onSelectThread}
              thread={thread}
            />
          ))}
        </section>
      ) : null}
      {relatedIds.size > 0 ? (
        <section className="reader-record-section">
          <EditableText
            as="h2"
            path="interface.reader.relatedTitle"
            value={portfolioInterfaceText["reader.relatedTitle"]}
          />
          {[...relatedIds].map((nodeId) => {
            const related = portfolioWorldNodeById.get(nodeId);
            return related ? <IndexRow key={related.id} node={related} onSelect={onSelect} /> : null;
          })}
        </section>
      ) : null}
    </div>
  );
}

export function PortfolioReader({
  activeThreadId,
  onOpenVisual,
  onReset,
  onSelect,
  onSelectThread,
  registerAvatarTarget,
  selectedId,
  spotlightTarget,
}: PortfolioReaderProps) {
  const readerRef = useRef<HTMLElement | null>(null);
  const indexScrollTop = useRef(0);
  const node = selectedId ? portfolioWorldNodeById.get(selectedId) : undefined;
  const thread = activeThreadId ? portfolioThreadById.get(activeThreadId) : undefined;
  const mode = node && node.family !== "story" ? "record" : thread ? "thread" : "index";
  const avatarTarget: AvatarTargetId = node?.projectSlug
    ? `project:${node.projectSlug}`
    : "portfolio:index";
  const setReaderRef = useCallback(
    (element: HTMLElement | null) => {
      readerRef.current = element;
      registerAvatarTarget?.(avatarTarget, element);
    },
    [avatarTarget, registerAvatarTarget],
  );
  const label = node && node.family !== "story"
    ? `${node.label} record`
    : thread
      ? `${thread.title} thread`
      : "Portfolio index";
  const cleanReview =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("review") === "clean";

  useLayoutEffect(() => {
    if (mode === "index" && readerRef.current) {
      readerRef.current.scrollTop = indexScrollTop.current;
    }
  }, [mode]);

  return (
    <aside
      aria-label={label}
      className={`portfolio-reader${cleanReview ? " portfolio-reader-clean-review" : ""}${spotlightTarget === avatarTarget ? " avatar-spotlight" : ""}`}
      data-reader-mode={mode}
      onScroll={(event) => {
        if (mode === "index") indexScrollTop.current = event.currentTarget.scrollTop;
      }}
      ref={setReaderRef}
    >
      {node || thread ? (
        <header className="reader-topbar">
          <h1>
            <button aria-label="Portfolio index" onClick={onReset} type="button">
              <EditableText
                path="interface.reader.backButton"
                value={portfolioInterfaceText["reader.backButton"]}
              />
            </button>
          </h1>
        </header>
      ) : null}
      {node && node.family !== "story" ? (
        <WorldRecord
          activeThreadId={activeThreadId}
          node={node}
          onOpenVisual={onOpenVisual}
          onSelect={onSelect}
          onSelectThread={onSelectThread}
        />
      ) : thread ? (
        <ThreadRecord
          onOpenVisual={onOpenVisual}
          onSelect={onSelect}
          threadId={thread.id}
        />
      ) : (
        <ReaderIndex onSelect={onSelect} onSelectThread={onSelectThread} />
      )}
      <footer className="portfolio-reader-footer">
        <a href="/privacy">
          <EditableText
            path="interface.reader.privacyLink"
            value={portfolioInterfaceText["reader.privacyLink"]}
          />
        </a>
        <EditorStatusLine />
      </footer>
    </aside>
  );
}
