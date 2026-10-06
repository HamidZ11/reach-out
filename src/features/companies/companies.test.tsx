import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSeedDataset, SEED_USER_ID } from "@/data/seed/dataset";
import { createSeedRepository } from "@/data/seed/seed-repository";
import { calendarDate } from "@/domain/time";
import type { Workspace } from "@/features/workspace/records";
import { createLocalActions } from "@/features/workspace/local-actions";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { currentPath, syncSearchParamsWithHistory, visit } from "@/test/navigation";
import { Companies } from "./companies";

/**
 * Production Companies over the seed repository, through the same loader the
 * route uses. Both compositions render (CSS shows one), so queries are scoped
 * to the desktop or phone layout.
 */

vi.mock("next/navigation", () => import("@/test/navigation"));

let workspace: Workspace;
const companyId = (name: string) => {
  const c = workspace.companies.find((x) => x.name === name);
  if (!c) throw new Error(`No ${name} in the seed`);
  return c.id;
};
const personId = (name: string) => workspace.people.find((p) => p.name === name)?.id;
const opportunitiesAt = (name: string) =>
  workspace.opportunities.filter((o) => o.companyId === companyId(name));

beforeAll(async () => {
  const anchor = calendarDate("2026-10-05");
  const repository = createSeedRepository(createSeedDataset(anchor), SEED_USER_ID);
  workspace = await loadWorkspace(repository, new Date("2026-10-05T09:00:00Z"), {
    research: true,
  });
  // jsdom does not lay out, so it has no scrolling.
  Element.prototype.scrollIntoView = vi.fn();
  syncSearchParamsWithHistory();
});

beforeEach(() => {
  visit("/companies");
});

function renderCompanies() {
  const { container, unmount } = render(
    <Companies workspace={workspace} actions={createLocalActions(workspace)} />,
  );
  const layout = (name: "desktop" | "phone") => {
    const element = container.querySelector<HTMLElement>(`[data-layout="${name}"]`);
    if (!element) throw new Error(`No ${name} layout`);
    return { element, ...within(element) };
  };
  return { desktop: layout("desktop"), phone: layout("phone"), unmount };
}

const rowNames = (scope: HTMLElement) =>
  [...scope.querySelectorAll("button")].map(
    (b) => b.querySelector('[class*="rowName"], [class*="rowTitle"]')?.textContent,
  );

describe("production Companies — desktop", () => {
  it("lists every company from the records: closing soon first, then what needs you", () => {
    const { desktop } = renderCompanies();
    expect(desktop.getByRole("heading", { level: 1, name: "Companies" })).toBeInTheDocument();
    const list = desktop.getByRole("navigation", { name: "Companies" });
    expect(
      within(list).getByText("Gathered from your people and opportunities."),
    ).toBeInTheDocument();
    expect(rowNames(list)).toEqual([
      "Ledgerline",
      "University of Manchester",
      "Northlight Labs",
      "Tessellate",
      "Calder Partners",
    ]);
    const row = (name: string) =>
      within(list).getByRole("button", { name: new RegExp(`^${name}`) });
    expect(row("Ledgerline")).toHaveTextContent("1 active · 3 people");
    expect(row("Ledgerline")).toHaveTextContent(/Overdue$/);
    expect(row("Northlight Labs")).toHaveTextContent(/Draft$/);
    // Nothing Today asks of you there: no state, never a score.
    expect(row("Calder Partners")).toHaveTextContent(/1 active · 1 person$/);
  });

  it("opens on the first company, with why it matters said from the records", () => {
    const { desktop } = renderCompanies();
    expect(desktop.getByRole("button", { name: /^Ledgerline/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(desktop.getByRole("heading", { level: 2, name: "Ledgerline" })).toBeInTheDocument();
    const standing = desktop.getByText("1 active opportunity").parentElement;
    expect(standing).toHaveTextContent(/^1 active opportunity3 peoplelast contact 2 days ago$/);
    const why = desktop.getByRole("region", { name: "Why Ledgerline matters" });
    expect(why).toHaveTextContent(
      "You're pursuing “Software Engineering Summer Internship 2027” here, and know three people — Daniel has replied.",
    );
    expect(why).toHaveTextContent("From what you're pursuing and who you know there.");
    expect(desktop.getByRole("link", { name: "Open Ledgerline's website" })).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  it("what you're pursuing there and who you know there link by id", () => {
    const { desktop } = renderCompanies();
    const pursuing = within(desktop.getByRole("region", { name: /^What you're pursuing here/ }));
    const [opportunity] = opportunitiesAt("Ledgerline");
    expect(
      pursuing.getByRole("link", { name: /Software Engineering Summer Internship 2027/ }),
    ).toHaveAttribute("href", `/opportunities?opportunity=${opportunity?.id}`);

    const people = within(desktop.getByRole("region", { name: /^Who you know here/ }));
    for (const name of ["Daniel Mensah", "Grace Whitfield", "James O'Connor"]) {
      expect(people.getByRole("link", { name })).toHaveAttribute(
        "href",
        `/people?person=${personId(name)}`,
      );
    }
  });

  it("what's happened there, your notes and what you know stay apart", () => {
    const { desktop } = renderCompanies();
    expect(desktop.getByRole("region", { name: /^What's happened/ })).toHaveAccessibleName(
      "What's happened 4 moments",
    );
    const known = within(
      desktop.getByRole("complementary", { name: "What you know about Ledgerline" }),
    );
    expect(known.getByRole("region", { name: /^Your notes/ })).toHaveTextContent(
      workspace.companies.find((c) => c.name === "Ledgerline")?.notes ?? "missing",
    );
    expect(known.getByText("No sourced facts yet.")).toBeInTheDocument();

    fireEvent.click(desktop.getByRole("button", { name: /^Northlight Labs/ }));
    const northlight = within(
      desktop.getByRole("complementary", { name: "What you know about Northlight Labs" }),
    );
    expect(northlight.getByLabelText("Fact 1")).toBeInTheDocument();
    expect(northlight.getByText("Nothing written yet.")).toBeInTheDocument();
  });

  it("a closed opportunity there still shows, after the active ones", () => {
    const { desktop } = renderCompanies();
    fireEvent.click(desktop.getByRole("button", { name: /^Tessellate/ }));
    const links = within(
      desktop.getByRole("region", { name: /^What you're pursuing here/ }),
    ).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("data-closed"))).toEqual([null, "true"]);
    expect(links[1]).toHaveTextContent(/Rejected$/);
  });

  it("has no arrow-key or single-key navigation", () => {
    const { desktop } = renderCompanies();
    const first = desktop.getByRole("button", { name: /^Ledgerline/ });
    first.focus();
    for (const key of ["ArrowDown", "ArrowUp", "j", "k"]) {
      fireEvent.keyDown(first, { key });
      fireEvent.keyDown(document, { key });
    }
    expect(first).toHaveAttribute("aria-current", "true");
    expect(currentPath()).toBe("/companies");
  });
});

describe("production Companies — the company in the URL", () => {
  it("selecting a company puts its id in the URL, replacing the entry", () => {
    const { desktop } = renderCompanies();
    const entries = window.history.length;
    fireEvent.click(desktop.getByRole("button", { name: /^Calder Partners/ }));
    expect(currentPath()).toBe(`/companies?company=${companyId("Calder Partners")}`);
    expect(window.history.length).toBe(entries);
    expect(desktop.getByRole("heading", { level: 2, name: "Calder Partners" })).toBeInTheDocument();
  });

  it("a deep link or refresh opens that exact company, on desktop and phone", () => {
    visit(`/companies?company=${companyId("Tessellate")}`);
    const { desktop, phone } = renderCompanies();
    expect(desktop.getByRole("button", { name: /^Tessellate/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(phone.getByRole("heading", { level: 1, name: "Tessellate" })).toBeInTheDocument();
  });

  it("an unknown or malformed id falls back safely", () => {
    for (const search of ["?company=cmp_nope", "?company=", "?company=Ledgerline"]) {
      visit(`/companies${search}`);
      const { desktop, phone, unmount } = renderCompanies();
      expect(desktop.getByRole("button", { name: /^Ledgerline/ })).toHaveAttribute(
        "aria-current",
        "true",
      );
      expect(phone.getByRole("heading", { level: 1, name: "Companies" })).toBeInTheDocument();
      unmount();
    }
  });
});

describe("production Companies — return context", () => {
  it("opened from an opportunity there, Back returns to that exact opportunity", () => {
    const [opportunity] = opportunitiesAt("Ledgerline");
    visit(`/companies?company=${companyId("Ledgerline")}&from=${opportunity?.id}`);
    const { phone } = renderCompanies();
    expect(phone.getByRole("link", { name: "Back to Pursuing" })).toHaveAttribute(
      "href",
      `/opportunities?opportunity=${opportunity?.id}`,
    );
    expect(phone.queryByRole("button", { name: "Back to Companies" })).toBeNull();
  });

  it("an opportunity that isn't there, or doesn't exist, is ignored", () => {
    const [elsewhere] = opportunitiesAt("Calder Partners");
    for (const from of [elsewhere?.id, "opp_nope", ""]) {
      visit(`/companies?company=${companyId("Ledgerline")}&from=${from}`);
      const { phone, unmount } = renderCompanies();
      expect(phone.getByRole("heading", { level: 1, name: "Ledgerline" })).toBeInTheDocument();
      expect(phone.queryByRole("link", { name: "Back to Pursuing" })).toBeNull();
      expect(phone.getByRole("button", { name: "Back to Companies" })).toBeInTheDocument();
      unmount();
    }
  });
});

describe("production Companies — phone", () => {
  it("lists companies, then opens one at a time; Back returns to the list", async () => {
    const { phone } = renderCompanies();
    expect(phone.getByRole("heading", { level: 1, name: "Companies" })).toBeInTheDocument();
    expect(phone.getByText("Gathered from your people and opportunities")).toBeInTheDocument();
    expect(rowNames(phone.getByRole("region", { name: "Companies" }))).toEqual([
      "Ledgerline",
      "University of Manchester",
      "Northlight Labs",
      "Tessellate",
      "Calder Partners",
    ]);

    fireEvent.click(phone.getByRole("button", { name: /^Northlight Labs/ }));
    expect(currentPath()).toBe(`/companies?company=${companyId("Northlight Labs")}`);
    expect(phone.getByRole("heading", { level: 1, name: "Northlight Labs" })).toHaveFocus();
    const sections = [...phone.element.querySelectorAll("section")].map(
      (s) => s.querySelector("h2")?.textContent,
    );
    expect(sections).toEqual([
      "Why Northlight Labs matters",
      "Pursuing here",
      "Who you know here",
      "Latest",
      "What you know",
    ]);
    const pursuing = within(phone.getByRole("region", { name: "Pursuing here" }));
    expect(pursuing.getByRole("link")).toHaveAttribute(
      "href",
      `/opportunities?opportunity=${opportunitiesAt("Northlight Labs")[0]?.id}`,
    );

    await act(async () => {
      fireEvent.click(phone.getByRole("button", { name: "Back to Companies" }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(currentPath()).toBe("/companies");
    expect(phone.getByRole("button", { name: /^Northlight Labs/ })).toHaveFocus();
  });

  it("people there open in the person sheet, so you keep your place", () => {
    visit(`/companies?company=${companyId("Northlight Labs")}`);
    const { phone } = renderCompanies();
    const people = within(phone.getByRole("region", { name: "Who you know here" }));
    expect(people.getByRole("button", { name: /^Hannah Lindqvist/ })).toHaveTextContent(
      "Co-founder & CTO · Draft ready",
    );
    fireEvent.click(people.getByRole("button", { name: /^Hannah Lindqvist/ }));
    expect(
      within(screen.getByRole("dialog")).getByRole("heading", { name: "Hannah Lindqvist" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the latest history shows the newest, with Show earlier for the rest", () => {
    visit(`/companies?company=${companyId("Ledgerline")}`);
    const { phone } = renderCompanies();
    const latest = phone.getByRole("region", { name: "Latest" });
    expect(within(latest).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(within(latest).getByRole("button", { name: /Show 2 earlier moments/ }));
    expect(within(latest).getAllByRole("listitem")).toHaveLength(4);
  });
});
