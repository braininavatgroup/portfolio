// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { portfolioData } from "../lib/portfolio-data";
import type { ProjectRecord } from "../lib/portfolio-model";
import { ProjectIndex } from "./ProjectIndex";

afterEach(cleanup);

describe("ProjectIndex", () => {
  it("links a stage-model project to its canonical case study with grounded stage and evidence context", () => {
    const project = portfolioData.projects[0];

    render(<ProjectIndex projects={[project]} />);

    const card = screen.getByRole("listitem");
    expect(
      within(card).getByRole("link", { name: new RegExp(project.title, "i") }),
    ).toHaveAttribute("href", `/work/${project.slug}`);
    expect(within(card).getByText(project.summary)).toBeInTheDocument();
    expect(within(card).getByText("Partial evidence")).toBeInTheDocument();
    for (const role of ["Instinct", "Approach", "Output"]) {
      expect(within(card).getByText(role)).toBeInTheDocument();
    }
  });

  it("keeps the map and first case study in a predictable keyboard focus order", async () => {
    const user = userEvent.setup();
    const project = portfolioData.projects[0];

    render(<ProjectIndex projects={[project]} />);

    await user.tab();
    expect(
      screen.getByRole("link", { name: "Portfolio map" }),
    ).toHaveFocus();

    await user.tab();
    expect(
      screen.getByRole("link", { name: new RegExp(project.title, "i") }),
    ).toHaveFocus();
  });

  it("qualifies absent evidence and projection data instead of inventing it", () => {
    const unprojectedProject: ProjectRecord = {
      id: "project:unprojected",
      slug: "unprojected",
      title: "Unprojected project",
      summary: "A project without a published projection.",
      entityIds: [],
    };

    render(<ProjectIndex projects={[unprojectedProject]} />);

    expect(screen.getByText("Evidence state not published")).toBeInTheDocument();
    expect(screen.getByText("Stage details not published")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Unprojected project/i }),
    ).toHaveAttribute("href", "/work/unprojected");
  });

  it("renders a useful empty state when the selected data has no projects", () => {
    render(<ProjectIndex projects={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "No portfolio projects are published in this view yet.",
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
