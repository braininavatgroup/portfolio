"use client";

import Link from "next/link";
import { KeyboardEvent, useRef } from "react";
import { portfolioNodes } from "../lib/portfolio";
import { keyboardNodeRoutes } from "../lib/reachability";

const routes = keyboardNodeRoutes(portfolioNodes);

export function KeyboardNavigator() {
  const links = useRef<Array<HTMLAnchorElement | null>>([]);

  function moveFocus(event: KeyboardEvent<HTMLAnchorElement>, current: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = (current + direction + routes.length) % routes.length;
    links.current[next]?.focus();
  }

  return (
    <nav
      className="keyboard-navigator"
      aria-label="Keyboard artifact navigation"
    >
      <p>Keyboard map <span>Tab or use arrow keys</span></p>
      <ol>
        {portfolioNodes.map((node, index) => (
          <li key={node.id}>
            <Link
              href={routes[index]}
              onKeyDown={(event) => moveFocus(event, index)}
              ref={(element) => {
                links.current[index] = element;
              }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {node.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
