import Link from "next/link";
import { PortfolioHeader } from "../../components/PortfolioHeader";
import { PortfolioNodeMark } from "../../components/PortfolioNodeMark";
import {
  portfolioInterfaceText,
  portfolioThreads,
  portfolioThroughline,
  portfolioWorldIndexSections,
  portfolioWorldNodeById,
} from "../../lib/portfolio-world";
import { EditableText } from "../../components/editor/EditableText";

export default function ProjectIndex() {
  return (
    <main
      className="flat-index stacked-editorial-index"
      data-index-layout="stacked-editorial"
      data-theme="light"
      id="main-content"
      tabIndex={-1}
    >
      <PortfolioHeader activeView="index" />
      <header className="index-header">
        <EditableText
          as="h1"
          path="interface.reader.indexTitle"
          value={portfolioInterfaceText["reader.indexTitle"]}
        />
        <EditableText
          as="p"
          className="lede"
          path="interface.hero.throughline"
          value={portfolioThroughline}
        />
      </header>

      {portfolioWorldIndexSections.map((section) => {
        if (section.type === "threads") {
          return (
            <section className="domain-section" data-project-count={portfolioThreads.length} id={section.id} key={section.id}>
              <div className="domain-heading">
                <div>
                  <EditableText
                    as="h2"
                    path={`interface.${section.titleKey}`}
                    value={section.title}
                  />
                  <EditableText
                    as="p"
                    path="interface.indexPage.threadsSubtitle"
                    value={portfolioInterfaceText["indexPage.threadsSubtitle"]}
                  />
                </div>
              </div>
              <div className="domain-work">
                <ol className="artifact-index-list">
                  {portfolioThreads.map((thread) => {
                    const node = portfolioWorldNodeById.get(thread.nodeId);
                    if (!node) return null;
                    return (
                    <li className="artifact-index-entry" key={thread.id}>
                      <Link
                        className="artifact-main-link"
                        href={`/?view=graph#thread/${thread.id}`}
                      >
                        <span className="artifact-index-copy">
                          <EditableText
                            as="strong"
                            path={`threads.${thread.id}.title`}
                            value={thread.title}
                          />
                          <EditableText
                            as="small"
                            path={`threads.${thread.id}.lede`}
                            value={thread.lede}
                          />
                        </span>
                        <span className="artifact-index-meta">
                          <PortfolioNodeMark family={node.family} register={node.register} />
                        </span>
                      </Link>
                    </li>
                    );
                  })}
                </ol>
              </div>
            </section>
          );
        }

        return (
          <section
            className="domain-section"
            data-project-count={section.nodeIds.length}
            id={section.id}
            key={section.id}
          >
            <div className="domain-heading">
              <div>
                <EditableText
                  as="h2"
                  path={`interface.${section.titleKey}`}
                  value={section.title}
                />
              </div>
            </div>
            <div className="domain-work">
              <ol className="artifact-index-list">
                {section.nodeIds.map((nodeId) => {
                  const node = portfolioWorldNodeById.get(nodeId);
                  if (!node) return null;
                  return (
                    <li className="artifact-index-entry" key={node.id}>
                      <Link
                        className="artifact-main-link"
                        href={`/?view=graph#${node.id}`}
                      >
                        <span className="artifact-index-copy">
                          <EditableText
                            as="strong"
                            path={`records.${node.id}.label`}
                            value={node.label}
                          />
                          <EditableText
                            as="small"
                            path={`records.${node.id}.summary`}
                            value={node.summary}
                          />
                        </span>
                        <span className="artifact-index-meta">
                          <PortfolioNodeMark family={node.family} register={node.register} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        );
      })}
    </main>
  );
}
