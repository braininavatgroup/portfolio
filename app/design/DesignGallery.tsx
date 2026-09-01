"use client";

import { lazy, useEffect, useState, useSyncExternalStore } from "react";
import { ComponentGallery } from "./ComponentGallery";
import { LazyFixture, Section, Stage } from "./gallery-ui";
import { TokenGallery } from "./TokenGallery";

// Three.js and the whole composition are code-split. Nothing below is fetched
// until a reviewer mounts it, so the route's first paint never waits on WebGL.
const AvatarFixtures = lazy(() =>
  import("./three-fixtures").then((module) => ({ default: module.AvatarFixtures })),
);
const AvatarToyboxFixture = lazy(() =>
  import("./three-fixtures").then((module) => ({
    default: module.AvatarToyboxFixture,
  })),
);
const PortfolioExperience = lazy(() =>
  import("../../components/PortfolioExperience").then((module) => ({
    default: module.PortfolioExperience,
  })),
);

function CompositionFixture() {
  return (
    <Stage size="viewport">
      <PortfolioExperience />
    </Stage>
  );
}

const sections = [
  { id: "tokens-color", label: "Color" },
  { id: "tokens-type", label: "Type" },
  { id: "tokens-spacing", label: "Spacing" },
  { id: "marks", label: "Marks" },
  { id: "header", label: "Header" },
  { id: "reader", label: "Reader" },
  { id: "world", label: "World" },
  { id: "chat", label: "Chat" },
  { id: "cursor", label: "Cursor" },
  { id: "analytics", label: "Analytics" },
  { id: "avatar", label: "Avatar" },
  { id: "toybox", label: "Toybox" },
  { id: "composition", label: "Composition" },
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

  // The toybox portals to a host outside this subtree, so the gallery mirrors
  // its mode onto that host too.
  useEffect(() => {
    const host = document.getElementById("avatar-toybox-root");
    host?.setAttribute("data-theme", theme);
    return () => {
      host?.removeAttribute("data-theme");
    };
  }, [theme]);

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
        {sections.map((section) => (
          <a className="design-gallery-control" href={`#${section.id}`} key={section.id}>
            {section.label}
          </a>
        ))}
      </nav>

      <TokenGallery />
      <ComponentGallery />

      <Section
        id="avatar"
        note="Three.js. Loaded and given a WebGL context only when mounted here. The Director console is compiled into development builds only."
        source="components/avatar/"
        title="Avatar"
      >
        <LazyFixture as={AvatarFixtures} label="the avatar fixtures" />
      </Section>

      <Section
        id="toybox"
        note="A full-screen modal that portals out of this page, exactly as it does on the live site."
        source="components/avatar-toybox/AvatarToyboxOverlay.tsx"
        title="Avatar toybox"
      >
        <LazyFixture as={AvatarToyboxFixture} label="the toybox" />
      </Section>

      <Section
        id="composition"
        note="The whole route as it ships: world, reader, chat, avatar and toybox. The header is present but hidden, as on the live site. Selecting a node here also writes to this page's history entry."
        source="components/PortfolioExperience.tsx"
        title="Full composition"
      >
        <LazyFixture as={CompositionFixture} label="the full composition" />
      </Section>
    </main>
  );
}
