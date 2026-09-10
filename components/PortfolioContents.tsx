"use client";

import { PortfolioControlMark, PortfolioNodeMark } from "./PortfolioNodeMark";
import {
  portfolioInterfaceText,
  portfolioThreads,
  portfolioWorldIndexSections,
  portfolioWorldNodeById,
  type PortfolioThread,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";

type PortfolioContentsProps = {
  activeThreadId: string | null;
  onClose?: () => void;
  onHome: () => void;
  onNavigate?: () => void;
  onSelect: (node: PortfolioWorldNode) => void;
  onSelectThread: (threadId: string) => void;
  selectedId: string | null;
};

function shortRecordLabel(node: PortfolioWorldNode): string {
  return node.label.replace(/^Brain in a Vat /, "");
}

function ContentsRow({
  label,
  node,
  onSelect,
  selected,
}: {
  label: string;
  node: PortfolioWorldNode;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <li>
      <button
        aria-label={node.label}
        className="portfolio-contents-row"
        data-register={node.register}
        data-row-size="contents"
        data-selected={selected}
        onClick={onSelect}
        type="button"
      >
        <span>{label}</span>
        <PortfolioNodeMark family={node.family} register={node.register} />
      </button>
    </li>
  );
}

function ThreadRow({
  activeThreadId,
  onSelect,
  thread,
}: {
  activeThreadId: string | null;
  onSelect: () => void;
  thread: PortfolioThread;
}) {
  const node = portfolioWorldNodeById.get(thread.nodeId);
  if (!node) return null;

  return (
    <ContentsRow
      label={thread.title}
      node={node}
      onSelect={onSelect}
      selected={activeThreadId === thread.id}
    />
  );
}

export function PortfolioContents({
  activeThreadId,
  onClose,
  onHome,
  onNavigate,
  onSelect,
  onSelectThread,
  selectedId,
}: PortfolioContentsProps) {
  const navigate = (select: () => void) => {
    select();
    onNavigate?.();
  };

  return (
    <nav aria-label="Portfolio contents" className="portfolio-contents">
      <div className="portfolio-contents-mast">
        <PortfolioControlMark
          aria-label={onClose ? "Hide Contents" : "Return to About"}
          kind="sidebarLeft"
          onClick={() => (onClose ? onClose() : navigate(onHome))}
        />
        <button
          aria-label="Portfolio home"
          className="portfolio-contents-home"
          onClick={() => navigate(onHome)}
          type="button"
        >
          {portfolioInterfaceText["world.mast"]}
        </button>
      </div>
      <div className="portfolio-contents-scroll">
        <div className="portfolio-contents-groups">
          {portfolioWorldIndexSections.map((section) => (
            <section className="portfolio-contents-group" key={section.id}>
              <h2>{section.title}</h2>
              <ul>
                {section.type === "threads"
                  ? portfolioThreads.map((thread) => (
                      <ThreadRow
                        activeThreadId={activeThreadId}
                        key={thread.id}
                        onSelect={() =>
                          navigate(() => onSelectThread(thread.id))
                        }
                        thread={thread}
                      />
                    ))
                  : section.nodeIds.map((nodeId) => {
                      const node = portfolioWorldNodeById.get(nodeId);
                      return node ? (
                        <ContentsRow
                          key={node.id}
                          label={shortRecordLabel(node)}
                          node={node}
                          onSelect={() => navigate(() => onSelect(node))}
                          selected={selectedId === node.id}
                        />
                      ) : null;
                    })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </nav>
  );
}
