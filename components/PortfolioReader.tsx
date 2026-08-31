"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { PortfolioNodeMark } from "./PortfolioNodeMark";
import type { AvatarTargetId } from "../lib/avatar/contracts";
import {
  portfolioContact,
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
      <span>{node.label}</span>
      <PortfolioNodeMark family={node.family} register={node.register} />
      <small>{node.kind}</small>
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
      <span>{thread.title}</span>
      <PortfolioNodeMark family={node.family} register={node.register} />
      <small>Thread</small>
    </button>
  );
}

function ReaderIndex({
  onSelect,
  onSelectThread,
}: Pick<PortfolioReaderProps, "onSelect" | "onSelectThread">) {
  return (
    <div className="reader-content reader-index-content">
      <h1>Index</h1>
      {portfolioWorldIndexSections.map((section) => {
        if (section.type === "threads") {
          return (
            <section className="reader-index-group reader-thread-index" key={section.id}>
              <h2>{section.title}</h2>
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
            <h2>{section.title}</h2>
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
  onOpen,
}: {
  block: PortfolioVisualBlock;
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
          <strong>{block.caption ?? block.purpose}</strong>
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

function PortfolioBody({
  body,
  onOpenVisual,
}: {
  body: readonly PortfolioBodyBlock[];
  onOpenVisual?: (
    block: PortfolioVisualBlock,
    trigger: HTMLButtonElement,
  ) => void;
}) {
  return (
    <section className="reader-record-section reader-composed-body">
      {body.map((block, index) => {
        if (typeof block === "string") {
          return <p key={`paragraph-${index}`}>{block}</p>;
        }
        if (block.type === "copy-placeholder") {
          return (
            <aside
              aria-label={`Copy in progress: ${block.prompt}`}
              className="reader-copy-placeholder reader-text-placeholder"
              key={block.id}
            >
              <span className="reader-placeholder-label">Copy in progress</span>
              <strong>{block.prompt}</strong>
              {block.questions?.length ? (
                <ul>
                  {block.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              ) : null}
            </aside>
          );
        }
        return (
          <VisualBlock
            block={block}
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
      <h1>{thread.title}</h1>
      <p className="reader-kind" data-register={register}>Thread</p>
      <p className="reader-summary">{thread.lede}</p>
      <PortfolioBody body={thread.body} onOpenVisual={onOpenVisual} />
      <section className="reader-record-section">
        <h2>Explore this thread</h2>
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
      <h2>Contact</h2>
      <a href={`mailto:${portfolioContact.email}`}>{portfolioContact.email}</a>
      <a href={portfolioContact.cv.href} download>{portfolioContact.cv.label}</a>
      {portfolioContact.socials.map(({ label, href }) => (
        <a href={href} key={label} rel="noreferrer" target="_blank">{label}</a>
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
  return (
    <div className="reader-content reader-record-content">
      <h1>{node.label}</h1>
      <p className="reader-kind" data-register={node.register}>{node.kind}</p>
      {activeThreadId ? (
        <p className="reader-path">
          <button onClick={() => onSelectThread(activeThreadId)} type="button">
            {portfolioThreadById.get(activeThreadId)?.title}
          </button>
          <span aria-hidden="true"> / </span>{node.label}
        </p>
      ) : null}
      <p
        className={`reader-summary${node.summaryStatus === "placeholder" ? " reader-summary-placeholder reader-text-placeholder" : ""}`}
      >
        {node.summary}
      </p>
      {node.body.length > 0 ? (
        <PortfolioBody body={node.body} onOpenVisual={onOpenVisual} />
      ) : null}
      {node.id === "bradley" ? <ContactSection /> : null}
      {node.id === "bradley" || containingThreads.length > 0 ? (
        <section className="reader-record-section">
          <h2>Threads</h2>
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
          <h2>Related</h2>
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
              Index
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
    </aside>
  );
}
