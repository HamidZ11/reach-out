import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/today" }));

describe("app shell", () => {
  it("desktop rail: every app destination, with Today marked as current", () => {
    render(
      <AppShell userName="Aisha Rahman" attention>
        <p>Page</p>
      </AppShell>,
    );
    const [rail] = screen.getAllByRole("navigation", { name: "Sections" });
    const links = within(rail!).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/today",
      "/people",
      "/opportunities",
      "/outreach",
      "/companies",
      "/settings",
    ]);
    expect(within(rail!).getByRole("link", { name: /^Today/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(rail!).getByRole("link", { name: /^Today/ })).toHaveTextContent(
      "something needs you",
    );
    expect(screen.getByRole("main")).toHaveTextContent("Page");
  });

  it("phone tabs: the four daily places; Companies and Settings stay out of the bar", () => {
    render(
      <AppShell userName="Aisha Rahman" attention={false}>
        <p>Page</p>
      </AppShell>,
    );
    const [, tabs] = screen.getAllByRole("navigation", { name: "Sections" });
    const links = within(tabs!).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["Today", "People", "Pursuing", "Outreach"]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/today",
      "/people",
      "/opportunities",
      "/outreach",
    ]);
  });
});
