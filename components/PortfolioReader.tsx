"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import type { AvatarTargetId } from "../lib/avatar/contracts";
import {
  portfolioContact,
  portfolioThreads,
  portfolioThreadById,
  portfolioWorldIndexSections,
  portfolioWorldLinks,
  portfolioWorldNodeById,
  type PortfolioBodyBlock,
  type PortfolioVisualBlock,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";

type PortfolioReaderProps = {
  activeThreadId: string | null;
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
      <span aria-hidden="true">→</span>
      <small>{node.kind}</small>
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
                <button
                  aria-label={thread.title}
                  className="reader-index-row"
                  key={thread.id}
                  onClick={() => onSelectThread(thread.id)}
                  type="button"
                >
                  <span>{thread.title}</span>
                  <span aria-hidden="true">→</span>
                  <small>Thread</small>
                </button>
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

function VisualBlock({ block }: { block: PortfolioVisualBlock }) {
  if (block.src) {
    return (
      <figure className="reader-visual-block" data-status={block.status}>
        <img alt={block.alt ?? ""} loading="lazy" src={block.src} />
        {block.caption ? <figcaption>{block.caption}</figcaption> : null}
      </figure>
    );
  }

  return (
    <figure
      aria-label={`Planned visual: ${block.purpose}`}
      className="reader-visual-placeholder"
      data-status={block.status}
    >
      <div className="reader-placeholder-frame" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <figcaption>
        <span className="reader-placeholder-label">Planned visual</span>
        <strong>{block.purpose}</strong>
        <span className="reader-placeholder-meta">
          {[block.treatment, block.sourceStatus].filter(Boolean).join(" · ")}
        </span>
      </figcaption>
    </figure>
  );
}

function PortfolioBody({
  body,
}: {
  body: readonly PortfolioBodyBlock[];
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
        return <VisualBlock block={block} key={block.id} />;
      })}
    </section>
  );
}

function ThreadRecord({
  onSelect,
  threadId,
}: {
  onSelect: (node: PortfolioWorldNode) => void;
  threadId: string;
}) {
  const thread = portfolioThreadById.get(threadId);
  if (!thread) return null;
  const register =
    portfolioWorldNodeById.get(thread.nodeId)?.register ?? "story";
  return (
    <div className="reader-content reader-thread-content">
      <p className="reader-kind" data-register={register}>Thread</p>
      <h1>{thread.title}</h1>
      <p className="reader-summary">{thread.lede}</p>
      <PortfolioBody body={thread.body} />
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
  onSelect,
  onSelectThread,
}: {
  activeThreadId: string | null;
  node: PortfolioWorldNode;
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
      {activeThreadId ? (
        <p className="reader-path">
          <button onClick={() => onSelectThread(activeThreadId)} type="button">
            {portfolioThreadById.get(activeThreadId)?.title}
          </button>
          <span aria-hidden="true"> / </span>{node.label}
        </p>
      ) : null}
      <p className="reader-kind" data-register={node.register}>{node.kind}</p>
      <h1>{node.label}</h1>
      <p
        className={`reader-summary${node.summaryStatus === "placeholder" ? " reader-summary-placeholder reader-text-placeholder" : ""}`}
      >
        {node.summary}
      </p>
      {node.body.length > 0 ? <PortfolioBody body={node.body} /> : null}
      {node.id === "bradley" ? <ContactSection /> : null}
      {node.id === "bradley" || containingThreads.length > 0 ? (
        <section className="reader-record-section">
          <h2>Threads</h2>
          {threadRows.map((thread) => (
            <button
              className="reader-index-row"
              key={thread.id}
              onClick={() => onSelectThread(thread.id)}
              type="button"
            >
              <span>{thread.title}</span><span aria-hidden="true">→</span><small>Thread</small>
            </button>
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
          <button aria-label="Portfolio index" onClick={onReset} type="button">← Index</button>
        </header>
      ) : null}
      {node && node.family !== "story" ? (
        <WorldRecord
          activeThreadId={activeThreadId}
          node={node}
          onSelect={onSelect}
          onSelectThread={onSelectThread}
        />
      ) : thread ? (
        <ThreadRecord onSelect={onSelect} threadId={thread.id} />
      ) : (
        <ReaderIndex onSelect={onSelect} onSelectThread={onSelectThread} />
      )}
    </aside>
  );
}
