import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSeedDataset, SEED_USER_ID } from "@/data/seed/dataset";
import { createSeedRepository } from "@/data/seed/seed-repository";
import { calendarDate } from "@/domain/time";
import type { Workspace } from "@/features/workspace/records";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { currentPath, syncSearchParamsWithHistory, visit } from "@/test/navigation";
import { Pursuing } from "./pursuing";

/**
 * Production Pursuing over the seed repository, through the same loader the
 * route uses. Both compositions render (CSS shows one), so queries are scoped
 * to the desktop or phone layout.
 */

vi.mock("next/navigation", () => import("@/test/navigation"));

let workspace: Workspace;
const opportunityId = (title: string) => {
  const o = workspace.opportunities.find((x) => x.title === title);
  if (!o) throw new Error(`No ${title} in the seed`);
  return o.id;
};
const personId = (name: string) => {
  const p = workspace.people.find((x) => x.name === name);
  if (!p) throw new Error(`No ${name} in the seed`);
  return p.id;
};

/** A button whose accessible name starts with this text. */
const startsWith = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

const LEDGERLINE = "Software Engineering Summer Internship 2027";
const RESEARCH = "Summer research placement — Distributed Systems Group";
const NORTHLIGHT = "Summer engineering internship (not advertised)";
const REFERRAL = "Referral for the summer engineering internship";
const CALDER = "Spring Insight Programme 2027";
const CLOSED = "Data Engineering Summer Internship 2027";

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
  visit("/opportunities");
});

function renderPursuing() {
  const { container, unmount } = render(<Pursuing workspace={workspace} />);
  const layout = (name: "desktop" | "phone") => {
    const element = container.querySelector<HTMLElement>(`[data-layout="${name}"]`);
    if (!element) throw new Error(`No ${name} layout`);
    return { element, ...within(element) };
  };
  return { desktop: layout("desktop"), phone: layout("phone"), unmount };
}

/** The titles in each group of the desktop list, in order. */
function desktopGroups(list: HTMLElement) {
  return [...list.querySelectorAll("section, details")].map((g) => ({
    label: (g.querySelector("h2, summary")?.firstChild?.textContent ?? "").trim(),
    titles: [...g.querySelectorAll('[class*="oppRowTitle"]')].map((t) => t.textContent),
  }));
}

describe("production Pursuing — desktop", () => {
  it("groups what you're pursuing by timing: closing soon, in progress, closed", () => {
    const { desktop } = renderPursuing();
    expect(desktop.getByRole("heading", { level: 1, name: "Pursuing" })).toBeInTheDocument();
    const list = desktop.getByRole("navigation", { name: "What you're pursuing" });
    expect(within(list).getByText("5 active · Ledgerline closes Sat 10 Oct")).toBeInTheDocument();
    expect(desktopGroups(list)).toEqual([
      { label: "Closing soon", titles: [LEDGERLINE] },
      // Equal priority: the most recently touched first.
      { label: "In progress", titles: [RESEARCH, REFERRAL, NORTHLIGHT, CALDER] },
      { label: "Closed", titles: [CLOSED] },
    ]);
  });

  it("rows show company, stage, people and what needs you; a tile only where time matters", () => {
    const { desktop } = renderPursuing();
    const row = (title: string) => desktop.getByRole("button", { name: startsWith(title) });
    expect(row(LEDGERLINE)).toHaveTextContent("Ledgerline · Reaching out · 3 people");
    expect(row(LEDGERLINE)).toHaveTextContent(/Overdue$/);
    expect(row(LEDGERLINE).querySelector('[class*="tile"]')).not.toBeNull();
    expect(row(NORTHLIGHT)).toHaveTextContent(/Draft$/);
    expect(row(REFERRAL)).toHaveTextContent(/To send$/);
    // Applied: its deadline asks nothing of you, so no tile and no state.
    expect(row(CALDER).querySelector('[class*="tile"]')).toBeNull();
    expect(row(CALDER)).toHaveTextContent("Calder Partners · Applied · 1 person");
  });

  it("closed stays folded until you need it", () => {
    const { desktop } = renderPursuing();
    const closed = desktop.element.querySelector("details");
    expect(closed).not.toBeNull();
    expect(closed?.open).toBe(false);
    expect(closed?.querySelector("summary")).toHaveTextContent("Closed 1");
  });

  it("opens on what closes first, with where you are, as a sentence and a quiet path", () => {
    const { desktop } = renderPursuing();
    expect(desktop.getByRole("button", { name: startsWith(LEDGERLINE) })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(desktop.getByRole("heading", { level: 2, name: LEDGERLINE })).toBeInTheDocument();
    const company = workspace.opportunities.find((o) => o.title === LEDGERLINE)?.companyId;
    expect(desktop.getByRole("link", { name: "Ledgerline" })).toHaveAttribute(
      "href",
      `/companies?company=${company}`,
    );
    expect(desktop.getByText("Closes Sat 10 Oct")).toBeInTheDocument();
    expect(desktop.getByText("High priority")).toBeInTheDocument();
    expect(desktop.getByText("3 people involved")).toBeInTheDocument();
    expect(desktop.getByRole("link", { name: /Open the posting/ })).toHaveAttribute(
      "target",
      "_blank",
    );

    const stage = desktop.getByRole("region", { name: "Where you are" });
    expect(stage).toHaveTextContent("You're reaching out3 of 6");
    const path = within(stage).getByRole("list", { name: "Stage: Reaching out · step 3 of 6" });
    const steps = within(path).getAllByRole("listitem");
    expect(steps.map((s) => s.getAttribute("data-state"))).toEqual([
      "done",
      "done",
      "current",
      null,
      null,
      null,
    ]);
    expect(steps[2]).toHaveAttribute("aria-current", "step");
    // Never a progress bar or a funnel.
    expect(stage.querySelector('[role="progressbar"], progress')).toBeNull();
  });

  it("what happens next uses Today's verbs, with what comes after", () => {
    const { desktop } = renderPursuing();
    const next = desktop.getByRole("region", { name: "What happens next" });
    expect(
      within(next).getByText("Follow up with Grace about interview timing"),
    ).toBeInTheDocument();
    expect(within(next).getByText("After that")).toBeInTheDocument();
    expect(
      within(next)
        .getAllByRole("listitem")
        .map((li) => li.querySelector('[class*="afterTitle"]')?.textContent),
    ).toEqual([
      "Follow up with Daniel if no reply",
      "Introduce myself to James O'Connor, mentioning Daniel",
      "Submit the Ledgerline internship application",
    ]);
    fireEvent.click(within(next).getByRole("button", { name: "Write the follow-up" }));
    expect(
      within(next).getByRole("textbox", { name: "Message to Grace Whitfield" }),
    ).toBeInTheDocument();
  });

  it("who you know there: each person by name, standing and why, linked by id", () => {
    const { desktop } = renderPursuing();
    const people = desktop.getByRole("region", { name: "Who you know there 3 people" });
    for (const name of ["Daniel Mensah", "Grace Whitfield", "James O'Connor"]) {
      expect(within(people).getByRole("link", { name })).toHaveAttribute(
        "href",
        `/people?person=${personId(name)}`,
      );
    }
    expect(within(people).getByText("In conversation")).toBeInTheDocument();
    const daniel = workspace.people.find((p) => p.name === "Daniel Mensah");
    expect(within(people).getByText(daniel?.whyRelevant ?? "missing")).toBeInTheDocument();
  });

  it("what's happened: the real history across everyone, ending where it began", () => {
    const { desktop } = renderPursuing();
    const history = desktop.getByRole("region", { name: /^What's happened/ });
    expect(history).toHaveAccessibleName("What's happened 4 moments");
    const heads = within(history)
      .getAllByRole("listitem")
      .map((li) => li.querySelector("p")?.firstChild?.textContent);
    expect(heads).toHaveLength(5);
    expect(heads.at(-1)).toBe("You started pursuing this");
    // Each moment names who it was with.
    expect(heads.slice(0, -1).every((h) => /Daniel|Grace/.test(h ?? ""))).toBe(true);

    const known = desktop.getByRole("complementary", { name: "What you know" });
    expect(within(known).getByRole("region", { name: /^Your notes/ })).toHaveTextContent(
      workspace.opportunities.find((o) => o.title === LEDGERLINE)?.notes ?? "missing",
    );
    expect(within(known).getByLabelText("Fact 1")).toBeInTheDocument();
  });

  it("a closed opportunity says how it ended and asks nothing more of you", () => {
    visit(`/opportunities?opportunity=${opportunityId(CLOSED)}`);
    const { desktop } = renderPursuing();
    expect(desktop.element.querySelector("details")?.open).toBe(true);
    expect(desktop.getByRole("region", { name: "Where you are" })).toHaveTextContent(
      "Closed — rejected",
    );
    expect(desktop.queryByRole("region", { name: "What happens next" })).toBeNull();
  });

  it("actions run the real domain rules for this session only", () => {
    const { desktop, unmount } = renderPursuing();
    fireEvent.click(desktop.getByRole("button", { name: startsWith(RESEARCH) }));
    const next = () => desktop.getByRole("region", { name: "What happens next" });
    const task = "Finish the research statement draft and send it to Ravi for feedback";
    expect(within(next()).getByText(task)).toBeInTheDocument();
    fireEvent.click(within(next()).getByRole("button", { name: "Mark done" }));
    expect(desktop.getByRole("status")).toHaveTextContent(`Done: ${task}.`);
    // Today no longer asks anything here; the planned follow-up is next.
    expect(
      within(next()).getByText("Follow up with Dr Marsh about placements"),
    ).toBeInTheDocument();

    // Nothing was saved: a fresh page has the step open again.
    unmount();
    visit(`/opportunities?opportunity=${opportunityId(RESEARCH)}`);
    const again = renderPursuing().desktop;
    expect(
      within(again.getByRole("region", { name: "What happens next" })).getByText(task),
    ).toBeInTheDocument();
  });

  it("has no arrow-key or single-key navigation: Enter and Space select", () => {
    const { desktop } = renderPursuing();
    const first = desktop.getByRole("button", { name: startsWith(LEDGERLINE) });
    first.focus();
    for (const key of ["ArrowDown", "ArrowUp", "j", "k", "e", "s", "a"]) {
      fireEvent.keyDown(first, { key });
      fireEvent.keyDown(document, { key });
    }
    expect(first).toHaveAttribute("aria-current", "true");
    expect(first).toHaveFocus();
    expect(currentPath()).toBe("/opportunities");
  });
});

describe("production Pursuing — the opportunity in the URL", () => {
  it("selecting an opportunity puts its id in the URL, replacing the entry", () => {
    const { desktop } = renderPursuing();
    const entries = window.history.length;
    fireEvent.click(desktop.getByRole("button", { name: startsWith(NORTHLIGHT) }));
    expect(currentPath()).toBe(`/opportunities?opportunity=${opportunityId(NORTHLIGHT)}`);
    expect(window.history.length).toBe(entries);
    expect(desktop.getByRole("heading", { level: 2, name: NORTHLIGHT })).toBeInTheDocument();
  });

  it("a deep link or refresh opens that exact opportunity, on desktop and phone", () => {
    visit(`/opportunities?opportunity=${opportunityId(RESEARCH)}`);
    const { desktop, phone } = renderPursuing();
    expect(desktop.getByRole("button", { name: startsWith(RESEARCH) })).toHaveAttribute(
      "aria-current",
      "true",
    );
    const title = phone.getByRole("heading", { level: 1, name: RESEARCH });
    expect(title).not.toHaveFocus();
  });

  it("an unknown or malformed id falls back safely", () => {
    for (const search of ["?opportunity=opp_nope", "?opportunity=", `?opportunity=${LEDGERLINE}`]) {
      visit(`/opportunities${search}`);
      const { desktop, phone, unmount } = renderPursuing();
      expect(desktop.getByRole("button", { name: startsWith(LEDGERLINE) })).toHaveAttribute(
        "aria-current",
        "true",
      );
      expect(phone.getByRole("heading", { level: 1, name: "Pursuing" })).toBeInTheDocument();
      unmount();
    }
  });
});

describe("production Pursuing — phone", () => {
  it("lists opportunities by timing, with the closed ones folded", () => {
    const { phone } = renderPursuing();
    expect(phone.getByRole("heading", { level: 1, name: "Pursuing" })).toBeInTheDocument();
    expect(phone.getByText("5 active · Ledgerline closes Sat 10 Oct")).toBeInTheDocument();
    expect(phone.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Closing soon",
      "In progress",
    ]);
    const closed = phone.element.querySelector("details");
    expect(closed?.open).toBe(false);
    expect(closed?.querySelector("summary")).toHaveTextContent("Closed 1");
    const row = phone.getByRole("button", { name: startsWith(LEDGERLINE) });
    expect(row).toHaveTextContent(/Overdue$/);
    expect(phone.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("opens one opportunity at a time, next action first, and Back returns to the list", async () => {
    const { phone } = renderPursuing();
    fireEvent.click(phone.getByRole("button", { name: startsWith(LEDGERLINE) }));
    expect(currentPath()).toBe(`/opportunities?opportunity=${opportunityId(LEDGERLINE)}`);
    expect(phone.getByRole("heading", { level: 1, name: LEDGERLINE })).toHaveFocus();
    expect(phone.getByText(/Ledgerline · Internship/)).toHaveTextContent("Closes Sat 10 Oct");

    const sections = [...phone.element.querySelectorAll("section")].map(
      (s) => s.querySelector("h2")?.textContent ?? s.getAttribute("aria-label"),
    );
    expect(sections).toEqual([
      "What happens next",
      "Where you are",
      "Who you know there",
      "What's happened",
      "Your notes",
      "Company",
    ]);

    // Opened from the list, so Back is the browser's Back.
    await act(async () => {
      fireEvent.click(phone.getByRole("button", { name: "Back to Pursuing" }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(currentPath()).toBe("/opportunities");
    expect(phone.getByRole("heading", { level: 1, name: "Pursuing" })).toBeInTheDocument();
    expect(phone.getByRole("button", { name: startsWith(LEDGERLINE) })).toHaveFocus();
  });

  it("Back from an opportunity you arrived at by link goes to the list", () => {
    visit(`/opportunities?opportunity=${opportunityId(CALDER)}`);
    const { phone } = renderPursuing();
    fireEvent.click(phone.getByRole("button", { name: "Back to Pursuing" }));
    expect(currentPath()).toBe("/opportunities");
    expect(phone.getByRole("heading", { level: 1, name: "Pursuing" })).toBeInTheDocument();
  });

  it("the next action is a card with Today's verbs, and the stage stays compact", () => {
    visit(`/opportunities?opportunity=${opportunityId(LEDGERLINE)}`);
    const { phone } = renderPursuing();
    const next = within(phone.getByRole("region", { name: "What happens next" }));
    const card = next.getByRole("article", { name: "Follow up with Grace about interview timing" });
    expect(within(card).getByRole("button", { name: "Write the follow-up" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /^Snooze to \w+$/ })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Already done" })).toBeInTheDocument();

    const stage = phone.getByRole("region", { name: "Where you are" });
    expect(stage.querySelector('[class*="compact"]')).not.toBeNull();
    expect(stage).toHaveTextContent("You're reaching out3 of 6");
  });

  it("people open in the person sheet, so you keep your place", () => {
    visit(`/opportunities?opportunity=${opportunityId(LEDGERLINE)}`);
    const { phone } = renderPursuing();
    const people = within(phone.getByRole("region", { name: "Who you know there" }));
    fireEvent.click(people.getByRole("button", { name: /^Daniel Mensah/ }));
    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByRole("heading", { name: "Daniel Mensah" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(currentPath()).toBe(`/opportunities?opportunity=${opportunityId(LEDGERLINE)}`);
  });

  it("history shows the newest moments, with Show earlier for the rest", () => {
    visit(`/opportunities?opportunity=${opportunityId(LEDGERLINE)}`);
    const { phone } = renderPursuing();
    const history = phone.getByRole("region", { name: "What's happened" });
    expect(within(history).getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(within(history).getByRole("button", { name: /Show 1 earlier moment/ }));
    expect(within(history).getAllByRole("listitem")).toHaveLength(5);
    expect(within(history).getByText("You started pursuing this")).toBeInTheDocument();
  });

  it("the company opens Companies with the way back to this opportunity", () => {
    visit(`/opportunities?opportunity=${opportunityId(LEDGERLINE)}`);
    const { phone } = renderPursuing();
    const o = workspace.opportunities.find((x) => x.title === LEDGERLINE);
    expect(
      within(phone.getByRole("region", { name: "Company" })).getByRole("link", {
        name: /^Ledgerline/,
      }),
    ).toHaveAttribute("href", `/companies?company=${o?.companyId}&from=${o?.id}`);
  });

  it("the Pursuing tab from an opportunity returns to the list", () => {
    const { phone } = renderPursuing();
    fireEvent.click(phone.getByRole("button", { name: startsWith(REFERRAL) }));
    expect(phone.getByRole("heading", { level: 1, name: REFERRAL })).toBeInTheDocument();
    act(() => window.history.pushState(null, "", "/opportunities"));
    expect(phone.getByRole("heading", { level: 1, name: "Pursuing" })).toBeInTheDocument();
  });
});
