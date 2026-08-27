"use client";

import Link from "next/link";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { AvatarTargetId } from "../lib/avatar/contracts";
import {
  portfolioStories,
  portfolioStoryById,
  portfolioWorldIndexGroups,
  portfolioWorldLinks,
  portfolioWorldNodeById,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";

type PortfolioReaderProps = {
  activeStoryId: string | null;
  onReset: () => void;
  onSelect: (node: PortfolioWorldNode) => void;
  onSelectStory: (storyId: string) => void;
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
  onSelectStory,
}: Pick<PortfolioReaderProps, "onSelect" | "onSelectStory">) {
  return (
    <div className="reader-content reader-index-content">
      <h1>Index</h1>
      <p className="reader-summary">Systems, products, and the work around them</p>
      <section className="reader-index-group reader-story-index">
        <h2>Stories</h2>
        {portfolioStories.map((story) => (
          <button
            aria-label={story.title}
            className="reader-index-row"
            key={story.id}
            onClick={() => onSelectStory(story.id)}
            type="button"
          >
            <span>{story.title}</span>
            <span aria-hidden="true">↗</span>
            <small>Story</small>
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
    </div>
  );
}

function StoryRecord({
  onSelect,
  storyId,
}: {
  onSelect: (node: PortfolioWorldNode) => void;
  storyId: string;
}) {
  const story = portfolioStoryById.get(storyId);
  if (!story) return null;
  return (
    <div className="reader-content reader-story-content">
      <p className="reader-kind" data-story={story.id}>Story</p>
      <h1>{story.title}</h1>
      <p className="reader-summary">{story.lede}</p>
      <section className="reader-record-section"><p>{story.body}</p></section>
      <section className="reader-record-section">
        <h2>Explore this story</h2>
        {story.members.map((nodeId) => {
          const node = portfolioWorldNodeById.get(nodeId);
          return node ? <IndexRow key={node.id} node={node} onSelect={onSelect} /> : null;
        })}
      </section>
    </div>
  );
}

function WorldRecord({
  activeStoryId,
  node,
  onSelect,
  onSelectStory,
}: {
  activeStoryId: string | null;
  node: PortfolioWorldNode;
  onSelect: (node: PortfolioWorldNode) => void;
  onSelectStory: (storyId: string) => void;
}) {
  const relatedIds = new Set<string>();
  for (const { from, to } of portfolioWorldLinks) {
    if (from === node.id) relatedIds.add(to);
    if (to === node.id) relatedIds.add(from);
  }
  const containingStories = portfolioStories.filter(({ members }) =>
    members.includes(node.id),
  );
  return (
    <div className="reader-content reader-record-content">
      {activeStoryId ? (
        <p className="reader-path">
          <button onClick={() => onSelectStory(activeStoryId)} type="button">
            {portfolioStoryById.get(activeStoryId)?.title}
          </button>
          <span aria-hidden="true"> / </span>{node.label}
        </p>
      ) : null}
      <p className="reader-kind">{node.kind}</p>
      <h1>{node.label}</h1>
      <p className="reader-summary">{node.summary}</p>
      <section className="reader-record-section">
        <h2>{node.sectionTitle}</h2>
        <p>{node.sectionBody}</p>
      </section>
      {node.id === "bradley" || containingStories.length > 0 ? (
        <section className="reader-record-section">
          <h2>Stories</h2>
          {containingStories.length > 0
            ? containingStories.map((story) => (
                <button
                  className="reader-index-row"
                  key={story.id}
                  onClick={() => onSelectStory(story.id)}
                  type="button"
                >
                  <span>{story.title}</span><span aria-hidden="true">↗</span><small>Editorial path</small>
                </button>
              ))
            : portfolioStories.map((story) => (
                <button
                  className="reader-index-row"
                  key={story.id}
                  onClick={() => onSelectStory(story.id)}
                  type="button"
                >
                  <span>{story.title}</span><span aria-hidden="true">↗</span><small>Editorial path</small>
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
      {node.projectSlug ? (
        <footer className="reader-footer">
          <Link href={`/index/${node.projectSlug}`}>Read the current case study</Link>
        </footer>
      ) : null}
    </div>
  );
}

export function PortfolioReader({
  activeStoryId,
  onReset,
  onSelect,
  onSelectStory,
  registerAvatarTarget,
  selectedId,
  spotlightTarget,
}: PortfolioReaderProps) {
  const readerRef = useRef<HTMLElement | null>(null);
  const indexScrollTop = useRef(0);
  const node = selectedId ? portfolioWorldNodeById.get(selectedId) : undefined;
  const story = activeStoryId ? portfolioStoryById.get(activeStoryId) : undefined;
  const mode = node && node.family !== "story" ? "record" : story ? "story" : "index";
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
    : story
      ? `${story.title} story`
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
      {node || story ? (
        <header className="reader-topbar">
          <button aria-label="Portfolio index" onClick={onReset} type="button">← Index</button>
        </header>
      ) : null}
      {node && node.family !== "story" ? (
        <WorldRecord
          activeStoryId={activeStoryId}
          node={node}
          onSelect={onSelect}
          onSelectStory={onSelectStory}
        />
      ) : story ? (
        <StoryRecord onSelect={onSelect} storyId={story.id} />
      ) : (
        <ReaderIndex onSelect={onSelect} onSelectStory={onSelectStory} />
      )}
    </aside>
  );
}
