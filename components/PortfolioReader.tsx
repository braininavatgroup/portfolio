"use client";

import Link from "next/link";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { AvatarTargetId } from "../lib/avatar/contracts";
import {
  portfolioContact,
  portfolioThreads,
  portfolioThreadById,
  portfolioWorldIndexGroups,
  portfolioWorldLinks,
  portfolioWorldNodeById,
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
      <span aria-hidden="true">↗</span>
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
      <p className="reader-summary">Systems, products, and the work around them</p>
      <section className="reader-index-group reader-thread-index">
        <h2>Threads</h2>
        {portfolioThreads.map((thread) => (
          <button
            aria-label={thread.title}
            className="reader-index-row"
            key={thread.id}
            onClick={() => onSelectThread(thread.id)}
            type="button"
          >
            <span>{thread.title}</span>
            <span aria-hidden="true">↗</span>
            <small>Thread</small>
          </button>
        ))}
      </section>
      {portfolioWorldIndexGroups.map((group) => (
        <section className="reader-index-group" key={group.id}>
          <h2>{group.title}</h2>
          {group.nodeIds.map((nodeId) => {
            const node = portfolioWorldNodeById.get(nodeId);
            return node ? <IndexRow key={node.id} node={node} onSelect={onSelect} /> : null;
          })}
        </section>
      ))}
      <footer className="reader-footer">
        <Link href="/index">View as list</Link>
      </footer>
    </div>
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
  return (
    <div className="reader-content reader-thread-content">
      <p className="reader-kind" data-thread={thread.id}>Thread</p>
      <h1>{thread.title}</h1>
      <p className="reader-summary">{thread.lede}</p>
      <section className="reader-record-section"><p>{thread.body}</p></section>
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
      <p className="reader-kind">{node.kind}</p>
      <h1>{node.label}</h1>
      <p className="reader-summary">{node.summary}</p>
      {node.principle ? (
        <p className="reader-principle">{node.principle}</p>
      ) : null}
      <section className="reader-record-section">
        {node.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>
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
              <span>{thread.title}</span><span aria-hidden="true">↗</span><small>Thread</small>
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

  useLayoutEffect(() => {
    if (mode === "index" && readerRef.current) {
      readerRef.current.scrollTop = indexScrollTop.current;
    }
  }, [mode]);

  return (
    <aside
      aria-label={label}
      className={`portfolio-reader${spotlightTarget === avatarTarget ? " avatar-spotlight" : ""}`}
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
