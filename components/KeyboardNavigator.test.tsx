// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeyboardNavigator } from "./KeyboardNavigator";

afterEach(cleanup);

describe("keyboard navigator", () => {
  it("uses visible controls and arrow keys to select map nodes", () => {
    const onNodeFocus = vi.fn();
    const onNodeSelect = vi.fn();
    render(
      <KeyboardNavigator
        onNodeFocus={onNodeFocus}
        onNodeSelect={onNodeSelect}
        selectedNodeId={null}
      />,
    );

    fireEvent.focus(screen.getByRole("button", { name: "Explore by keyboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Next node" }));
    expect(onNodeSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "kickoff-intake:system" }),
    );

    fireEvent.keyDown(screen.getByRole("toolbar", { name: "Keyboard map controls" }), {
      key: "ArrowLeft",
    });
    expect(onNodeSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "kickoff-intake:spec" }),
    );
  });
});
