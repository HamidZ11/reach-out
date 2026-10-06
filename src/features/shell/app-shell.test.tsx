import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

const location = vi.hoisted(() => ({ pathname: "/today", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => location.pathname,
  useSearchParams: () => new URLSearchParams(location.search),
}));

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

  it("phone tabs: a company opened from an opportunity keeps Pursuing marked", () => {
    const current = () => {
      const [, tabs] = screen.getAllByRole("navigation", { name: "Sections" });
      return within(tabs!)
        .getAllByRole("link")
        .filter((a) => a.getAttribute("aria-current") === "page")
        .map((a) => a.textContent);
    };
    Object.assign(location, { pathname: "/companies", search: "company=cmp_01&from=opp_01" });
    const { unmount } = render(
      <AppShell userName="Aisha Rahman" attention={false}>
        <p>Page</p>
      </AppShell>,
    );
    expect(current()).toEqual(["Pursuing"]);
    unmount();

    // Opened any other way, Companies marks no tab: it is never one of the four.
    Object.assign(location, { pathname: "/companies", search: "company=cmp_01" });
    render(
      <AppShell userName="Aisha Rahman" attention={false}>
        <p>Page</p>
      </AppShell>,
    );
    expect(current()).toEqual([]);
    Object.assign(location, { pathname: "/today", search: "" });
  });
});
