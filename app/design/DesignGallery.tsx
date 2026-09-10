"use client";

import { lazy, useEffect, useState, useSyncExternalStore } from "react";
import {
  AnalyticsSection,
  CompositionSections,
  CursorSection,
} from "./ComponentGallery";
import { LazyFixture, Section, Stage } from "./gallery-ui";
import { TokenGallery } from "./TokenGallery";

// Three.js and the whole composition are code-split. Nothing below is fetched
// until a reviewer mounts it, so the route's first paint never waits on WebGL.
const AvatarFixtures = lazy(() =>
  import("./three-fixtures").then((module) => ({ default: module.AvatarFixtures })),
);
const PortfolioExperience = lazy(() =>
  import("../../components/PortfolioExperience").then((module) => ({
    default: module.PortfolioExperience,
  })),
);

function GroupHeading({
  group,
}: {
  group: { readonly title: string; readonly blurb: string };
}) {
  return (
    <div className="design-group-heading">
      <h2>{group.title}</h2>
      <p>{group.blurb}</p>
    </div>
  );
}

function CompositionFixture() {
  return (
    <Stage size="viewport">
      <PortfolioExperience />
    </Stage>
  );
}

/**
 * Thirteen sections in one flat row read as thirteen unrelated things. They are
 * not: three are the vocabulary everything else is built from, five are the
 * composition taken apart, four are ambient, and the last is the whole thing
 * running. The groups are the page's argument, so the nav states them.
 *
 * Order is deliberate. Composition runs last because it contains the avatar,
 * and seeing the parts before the assembly is the only order that
 * explains anything.
 */
const sectionGroups = [
  {
    title: "Foundations",
    blurb: "The vocabulary. Resolved from the stylesheet at runtime.",
    sections: [
      { id: "tokens-color", label: "Color" },
      { id: "tokens-type", label: "Type" },
      { id: "tokens-spacing", label: "Spacing" },
    ],
  },
  {
    title: "Composition",
    blurb: "The accepted portfolio, part by part, in assembly order.",
    sections: [
      { id: "marks", label: "Marks" },
      { id: "reading-room", label: "Reading Room" },
      { id: "world", label: "World" },
      { id: "reader", label: "Reader" },
      { id: "chat", label: "Guide" },
    ],
  },
  {
    title: "Ambient",
    blurb: "Site-wide, or on a page of its own. Not part of the composition.",
    sections: [
      { id: "cursor", label: "Cursor" },
      { id: "avatar", label: "Avatar" },
      { id: "analytics", label: "Analytics" },
    ],
  },
  {
    title: "Whole",
    blurb: "Everything above, running together.",
    sections: [{ id: "composition", label: "Full composition" }],
  },
] as const;


type Theme = "light" | "dark";

const darkQuery = "(prefers-color-scheme: dark)";

function subscribeToColorScheme(onChange: () => void) {
  const query = window.matchMedia(darkQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function DesignGallery() {
  // The gallery follows the reader's own preference until they pick a mode.
  // useSyncExternalStore keeps the server snapshot ("light") and the hydrated
  // client value in step, so adopting a dark preference is not a mismatch.
  const systemDark = useSyncExternalStore(
    subscribeToColorScheme,
    () => window.matchMedia(darkQuery).matches,
    () => false,
  );
  const [chosen, setChosen] = useState<Theme | null>(null);
  const theme: Theme = chosen ?? (systemDark ? "dark" : "light");
  const setTheme = setChosen;

  // Sections are collapsible, so the nav has to be able to reopen one. Without
  // this, following a link to a section a reviewer had folded away scrolls to
  // a closed summary and looks like the link is broken.
  useEffect(() => {
    const openTarget = () => {
      const id = window.location.hash.slice(1);
      if (!id) return;
      const section = document.getElementById(id);
      if (section instanceof HTMLDetailsElement) section.open = true;
    };
    openTarget();
    window.addEventListener("hashchange", openTarget);
    return () => window.removeEventListener("hashchange", openTarget);
  }, []);

  return (
    <main className="design-gallery" data-theme={theme} id="main-content" tabIndex={-1}>
      <header className="design-gallery-bar">
        <h1>Design gallery</h1>
        <p>
          Every component in <code>components/</code>, one live instance each,
          driven through its states from the strip above it. Colour and type
          values are resolved from <code>app/globals.css</code> at runtime, so
          they cannot drift from the stylesheet.
        </p>
        <div aria-label="Colour mode" className="design-gallery-modes" role="group">
          {(["light", "dark"] as const).map((mode) => (
            <button
              aria-pressed={theme === mode}
              className="design-gallery-control"
              key={mode}
              // Pressing the active mode returns to the system preference;
              // otherwise picking one is a trapdoor with no way back.
              onClick={() => setTheme(chosen === mode ? null : mode)}
              type="button"
            >
              {mode}
            </button>
          ))}
          <span className="design-state-strip-label">
            {chosen === null ? "following system" : "click again for system"}
          </span>
        </div>
      </header>

      <nav aria-label="Gallery sections" className="design-gallery-nav">
        {sectionGroups.map((group) => (
          <div className="design-gallery-nav-group" key={group.title}>
            <span className="design-gallery-nav-heading">{group.title}</span>
            {group.sections.map((section) => (
              <a className="design-gallery-control" href={`#${section.id}`} key={section.id}>
                {section.label}
              </a>
            ))}
          </div>
        ))}
      </nav>

      <GroupHeading group={sectionGroups[0]} />
      <TokenGallery />

      <GroupHeading group={sectionGroups[1]} />
      <CompositionSections />

      <GroupHeading group={sectionGroups[2]} />
      <CursorSection />

      <Section
        id="avatar"
        note="Three.js. Loaded and given a WebGL context only when mounted here."
        source="components/avatar/"
        title="Avatar"
      >
        <LazyFixture as={AvatarFixtures} label="the avatar fixtures" />
      </Section>

      <AnalyticsSection />

      <GroupHeading group={sectionGroups[3]} />
      <Section
        id="composition"
        note="The whole route as it ships: world, reader, chat, avatar and Brain Food. Selecting a node here also writes to this page's history entry."
        source="components/PortfolioExperience.tsx"
        title="Full composition"
      >
        <LazyFixture as={CompositionFixture} label="the full composition" />
      </Section>
    </main>
  );
}
