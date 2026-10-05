import { act, fireEvent, render, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSeedDataset, SEED_USER_ID } from "@/data/seed/dataset";
import { createSeedRepository } from "@/data/seed/seed-repository";
import { calendarDate } from "@/domain/time";
import type { Workspace } from "@/features/workspace/records";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { People } from "./people";

/**
 * Production People over the seed repository, through the same loader the
 * route uses. Both compositions render (CSS shows one), so queries are scoped
 * to the desktop or phone layout.
 */

// Next.js keeps useSearchParams in step with the native history methods and
// with Back. This stands in for that: the hook reads the jsdom URL.
vi.mock("next/navigation", async () => {
  const { useMemo, useSyncExternalStore } = await import("react");
  const subscribe = (onChange: () => void) => {
    window.addEventListener("popstate", onChange);
    window.addEventListener("navigated", onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener("navigated", onChange);
    };
  };
  return {
    useSearchParams() {
      const search = useSyncExternalStore(
        subscribe,
        () => window.location.search,
        () => "",
      );
      return useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

let workspace: Workspace;
const idOf = (name: string) => {
  const person = workspace.people.find((p) => p.name === name);
  if (!person) throw new Error(`No ${name} in the seed`);
  return person.id;
};
const at = () => `${window.location.pathname}${window.location.search}`;

beforeAll(async () => {
  const anchor = calendarDate("2026-10-05");
  const repository = createSeedRepository(createSeedDataset(anchor), SEED_USER_ID);
  workspace = await loadWorkspace(repository, new Date("2026-10-05T09:00:00Z"), {
    research: true,
  });
  // jsdom does not lay out, so it has no scrolling or resizing.
  Element.prototype.scrollIntoView = vi.fn();
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  for (const method of ["pushState", "replaceState"] as const) {
    const native = window.history[method].bind(window.history);
    window.history[method] = (...args: Parameters<History["pushState"]>) => {
      native(...args);
      window.dispatchEvent(new Event("navigated"));
    };
  }
});

beforeEach(() => {
  window.history.replaceState(null, "", "/people");
});

/** As if the browser had loaded or refreshed this address. */
function visit(path: string) {
  window.history.replaceState(null, "", path);
}

/** jsdom has no layout: give the why statement the height it would have when folded. */
function layOutWhy({ overflows }: { overflows: boolean }) {
  const scroll = vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(function (
    this: Element,
  ) {
    return this.id === "m-person-why-text" && overflows ? 96 : 72;
  });
  const client = vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(72);
  return () => {
    scroll.mockRestore();
    client.mockRestore();
  };
}

function renderPeople() {
  const { container, unmount } = render(<People workspace={workspace} />);
  const layout = (name: "desktop" | "phone") => {
    const element = container.querySelector<HTMLElement>(`[data-layout="${name}"]`);
    if (!element) throw new Error(`No ${name} layout`);
    return { element, ...within(element) };
  };
  return { desktop: layout("desktop"), phone: layout("phone"), unmount };
}

/** Each group's label and the names in it, in order. */
function groupsIn(scope: HTMLElement, nameSelector: string) {
  return within(scope)
    .getAllByRole("region")
    .map((g) => ({
      label: g.getAttribute("aria-label"),
      people: [...g.querySelectorAll(nameSelector)].map((n) => n.textContent),
    }));
}

const SEED_GROUPS = [
  {
    label: "Software Engineering Summer Internship 2027",
    people: ["Daniel Mensah", "Grace Whitfield", "James O'Connor"],
  },
  {
    label: "Summer research placement — Distributed Systems Group",
    people: ["Eleanor Marsh", "Ravi Kapoor"],
  },
  { label: "Spring Insight Programme 2027", people: ["Olivia Hartley"] },
  {
    label: "Summer engineering internship (not advertised)",
    people: ["Hannah Lindqvist", "Tom Achebe"],
  },
  { label: "Referral for the summer engineering internship", people: ["Sofia Petrova"] },
  { label: "From closed opportunities", people: ["Marcus Bell"] },
];

describe("production People — desktop", () => {
  it("lists everyone from the repository, grouped by opportunity, soonest deadline first", () => {
    const { desktop } = renderPeople();
    expect(desktop.getByRole("heading", { level: 1, name: "People" })).toBeInTheDocument();
    const list = desktop.getByRole("navigation", { name: "People by opportunity" });
    expect(groupsIn(list, '[class*="pName"]')).toEqual(SEED_GROUPS);
    expect(within(list).getByText("Ledgerline · closes Sat 10 Oct")).toBeInTheDocument();
  });

  it("shows each person's status from the domain, in words", () => {
    const { desktop } = renderPeople();
    const row = (name: string) => desktop.getByRole("button", { name: new RegExp(`^${name}`) });
    expect(row("Grace Whitfield")).toHaveTextContent(/Overdue$/);
    expect(row("Daniel Mensah")).toHaveTextContent(/Your turn$/);
    expect(row("Hannah Lindqvist")).toHaveTextContent(/Draft$/);
    expect(row("Sofia Petrova")).toHaveTextContent(/To send$/);
    expect(row("Marcus Bell")).toHaveTextContent(/Dormant$/);
  });

  it("opens on the most recent conversation, and selecting a row shows that person", () => {
    const { desktop } = renderPeople();
    const daniel = desktop.getByRole("button", { name: /^Daniel Mensah/ });
    expect(daniel).toHaveAttribute("aria-current", "true");
    expect(desktop.getByRole("heading", { level: 2, name: "Daniel Mensah" })).toBeInTheDocument();
    expect(desktop.getByText("In conversation")).toBeInTheDocument();
    expect(desktop.getByRole("link", { name: "Email Daniel" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^mailto:/),
    );

    fireEvent.click(desktop.getByRole("button", { name: /^Grace Whitfield/ }));
    expect(daniel).not.toHaveAttribute("aria-current");
    expect(desktop.getByRole("heading", { level: 2, name: "Grace Whitfield" })).toBeInTheDocument();
    expect(desktop.getByText("Follow-up due")).toBeInTheDocument();
  });

  it("has no arrow-key or single-key navigation: Enter and Space select", () => {
    const { desktop } = renderPeople();
    const daniel = desktop.getByRole("button", { name: /^Daniel Mensah/ });
    daniel.focus();
    for (const key of ["ArrowDown", "ArrowUp", "j", "k", "J", "K", "e", "s", "a"]) {
      fireEvent.keyDown(daniel, { key });
      fireEvent.keyDown(document, { key });
    }
    expect(daniel).toHaveAttribute("aria-current", "true");
    expect(daniel).toHaveFocus();
    expect(at()).toBe("/people");
    expect(document.querySelector("kbd")).toBeNull();
  });

  it("searches name, role and company", () => {
    const { desktop } = renderPeople();
    const search = desktop.getByRole("textbox", { name: "Find a person" });
    expect(search).toHaveAttribute("placeholder", "Find by name, role or company");
    const list = desktop.getByRole("navigation", { name: "People by opportunity" });

    fireEvent.change(search, { target: { value: "northlight" } });
    expect(groupsIn(list, '[class*="pName"]')).toEqual([
      {
        label: "Summer engineering internship (not advertised)",
        people: ["Hannah Lindqvist", "Tom Achebe"],
      },
    ]);

    fireEvent.change(search, { target: { value: "recruiter" } });
    expect(groupsIn(list, '[class*="pName"]')).toEqual([
      { label: "Software Engineering Summer Internship 2027", people: ["Grace Whitfield"] },
    ]);

    fireEvent.change(search, { target: { value: "astronaut" } });
    expect(within(list).queryAllByRole("region")).toEqual([]);
    expect(within(list).getByText("No one matches “astronaut”.")).toBeInTheDocument();
  });

  it("leads with why they matter, then the next step, with Today's actions", () => {
    const { desktop } = renderPeople();
    const why = desktop.getByRole("region", { name: "Why Daniel matters" });
    const daniel = workspace.people.find((p) => p.name === "Daniel Mensah");
    expect(why).toHaveTextContent(daniel?.whyRelevant ?? "missing");

    expect(desktop.getByText("Daniel Mensah replied")).toBeInTheDocument();
    fireEvent.click(desktop.getByRole("button", { name: "Write your reply" }));
    expect(desktop.getByRole("textbox", { name: "Message to Daniel Mensah" })).toBeInTheDocument();
    expect(desktop.getByRole("button", { name: "Hide draft" })).toBeInTheDocument();

    // Someone with nothing written yet, and a step planned beyond Today's window.
    fireEvent.click(desktop.getByRole("button", { name: /^Eleanor Marsh/ }));
    expect(desktop.getByText("Follow up with Dr Marsh about placements")).toBeInTheDocument();
    expect(
      desktop.getByText(/Due in 4 days · Fri 9 Oct · appears in Today nearer the time/),
    ).toBeInTheDocument();
    fireEvent.click(desktop.getByRole("button", { name: "Mark done" }));
    expect(desktop.getByRole("status")).toHaveTextContent(
      "Done: Follow up with Dr Marsh about placements.",
    );
    expect(desktop.getByText("Nothing planned yet.")).toBeInTheDocument();

    fireEvent.click(desktop.getByRole("button", { name: /^Grace Whitfield/ }));
    expect(
      desktop.getByText(
        "Not written yet. One sentence here makes every message to Grace easier to write.",
      ),
    ).toBeInTheDocument();
  });

  it("a draft waiting on People is the same draft Today shows, approved the same way", () => {
    const { desktop } = renderPeople();
    fireEvent.click(desktop.getByRole("button", { name: /^Hannah Lindqvist/ }));
    expect(desktop.getByText("Approve your email to Hannah")).toBeInTheDocument();
    fireEvent.click(desktop.getByRole("button", { name: "Approve" }));
    expect(desktop.getByText("Send your email to Hannah")).toBeInTheDocument();
    expect(desktop.getByRole("status")).toHaveTextContent(/^Approved/);
    expect(desktop.getByRole("button", { name: /^Hannah Lindqvist/ })).toHaveTextContent(
      /To send$/,
    );
  });

  it("tells the story between you, newest first, ending with how you found them", () => {
    const { desktop } = renderPeople();
    const history = desktop.getByRole("region", { name: /^Between you/ });
    expect(history).toHaveAccessibleName("Between you 2 moments");
    const moments = within(history).getAllByRole("listitem");
    expect(moments).toHaveLength(3);
    const head = (i: number) => moments[i]?.querySelector("p");
    expect(head(0)).toHaveTextContent(/^Daniel replied/);
    expect(head(1)).toHaveTextContent(/^You wrote/);
    expect(head(2)).toHaveTextContent(/^You found Daniel/);
    // A typographic date column and the channel, never a date tile.
    expect(moments[0]).toHaveTextContent(/^3Oct/);
    expect(head(0)).toHaveTextContent("LinkedIn · 13:15");
    expect(moments[0]?.querySelector('[class*="tile"]')).toBeNull();
  });

  it("keeps facts, your notes and generated interpretation apart", () => {
    const { desktop } = renderPeople();
    fireEvent.click(desktop.getByRole("button", { name: /^Hannah Lindqvist/ }));
    const known = within(
      desktop.getByRole("complementary", { name: "What you know about Hannah" }),
    );

    const facts = known.getByRole("region", { name: /^What you know/ });
    expect(within(facts).getByLabelText("Fact 1")).toBeInTheDocument();
    expect(within(facts).getAllByRole("listitem").length).toBeGreaterThan(0);

    const notes = known.getByRole("region", { name: /^Your notes/ });
    expect(notes.querySelector('[class*="note"]')).toHaveTextContent(
      workspace.people.find((p) => p.name === "Hannah Lindqvist")?.notes ?? "",
    );

    const generated = known.getByRole("region", { name: "Suggested angle generated, not fact" });
    expect(generated).toHaveTextContent(/Inferred from/);
    expect(within(generated).getByLabelText("fact 1")).toBeInTheDocument();
    // The interpretation is never listed among the facts.
    const reading = workspace.interpretations.find((i) => i.subject.type === "person")?.text;
    expect(reading).toBeDefined();
    expect(facts).not.toHaveTextContent(reading ?? "");

    expect(known.getByRole("region", { name: "For" })).toHaveTextContent(
      "Summer engineering internship (not advertised)",
    );
  });
});

describe("production People — phone", () => {
  it("lists people by opportunity with a count of who needs you", () => {
    const { phone } = renderPeople();
    expect(phone.getByRole("heading", { level: 1, name: "People" })).toBeInTheDocument();
    expect(phone.getByText("10 people · six need you")).toBeInTheDocument();
    expect(groupsIn(phone.element, '[class*="rowTitle"]')).toEqual(SEED_GROUPS);
    expect(phone.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("each row reads as one line of name and status, with the role beneath", () => {
    const { phone } = renderPeople();
    const row = phone.getByRole("button", { name: /^Grace Whitfield/ });
    const [line, role] = [...(row.querySelector('[class*="rowText"]')?.children ?? [])];
    expect(line?.children[0]).toHaveTextContent("Grace Whitfield");
    expect(line?.children[1]).toHaveTextContent("Overdue");
    expect(role).toHaveTextContent("Early Careers Recruiter · Ledgerline");
  });

  it("searches with the approved placeholder", () => {
    const { phone } = renderPeople();
    const search = phone.getByRole("searchbox", { name: "Find a person" });
    expect(search).toHaveAttribute("placeholder", "Name, role or company");
    fireEvent.change(search, { target: { value: "Calder" } });
    expect(groupsIn(phone.element, '[class*="rowTitle"]')).toEqual([
      { label: "Spring Insight Programme 2027", people: ["Olivia Hartley"] },
    ]);
  });

  it("opens one person at a time, and Back returns to the row you came from", async () => {
    const { phone } = renderPeople();
    fireEvent.click(phone.getByRole("button", { name: /^Daniel Mensah/ }));
    expect(at()).toBe(`/people?person=${idOf("Daniel Mensah")}`);

    const title = phone.getByRole("heading", { level: 1, name: "Daniel Mensah" });
    expect(title).toHaveFocus();
    expect(
      phone.getByText("Graduate Software Engineer, Payments · Ledgerline"),
    ).toBeInTheDocument();
    expect(phone.queryByRole("searchbox")).toBeNull();
    // Compact header: standing sits beneath, with the contact actions beside the name.
    expect(phone.getByText("In conversation")).toBeInTheDocument();
    expect(phone.getByRole("link", { name: "Email Daniel" })).toBeInTheDocument();
    expect(phone.getByRole("link", { name: "Open Daniel's LinkedIn profile" })).toHaveAttribute(
      "target",
      "_blank",
    );

    // Opened from the list, so Back is the browser's Back: no extra history entry.
    await act(async () => {
      fireEvent.click(phone.getByRole("button", { name: "Back to People" }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(at()).toBe("/people");
    expect(phone.getByRole("heading", { level: 1, name: "People" })).toBeInTheDocument();
    expect(phone.getByRole("button", { name: /^Daniel Mensah/ })).toHaveFocus();
  });

  it("reads why first, folded to three lines, with Read all when it runs past the fold", () => {
    const restore = layOutWhy({ overflows: true });
    const { phone } = renderPeople();
    fireEvent.click(phone.getByRole("button", { name: /^Daniel Mensah/ }));
    const why = phone.getByRole("region", { name: "Why Daniel matters" });
    const sections = [...phone.element.querySelectorAll("section")].map(
      (s) => s.querySelector("h2")?.textContent,
    );
    expect(sections).toEqual(["Why Daniel matters", "Next", "For", "Between you", "What you know"]);

    const statement = why.querySelector("p");
    expect(statement?.className).toMatch(/clamp3/);
    const readAll = within(why).getByRole("button", { name: "Read all" });
    expect(readAll).toHaveAttribute("aria-expanded", "false");
    expect(readAll).toHaveAttribute("aria-controls", statement?.id);
    fireEvent.click(readAll);
    expect(statement?.className).not.toMatch(/clamp3/);
    expect(within(why).queryByRole("button", { name: "Read all" })).toBeNull();
    expect(statement).toHaveFocus();
    restore();
  });

  it("offers no Read all when the why already fits, however long it is", () => {
    const restore = layOutWhy({ overflows: false });
    const { phone } = renderPeople();
    // Daniel's why is long in characters; what matters is whether it is cut off.
    fireEvent.click(phone.getByRole("button", { name: /^Daniel Mensah/ }));
    const why = phone.getByRole("region", { name: "Why Daniel matters" });
    expect(why).toHaveTextContent(
      workspace.people.find((p) => p.id === idOf("Daniel Mensah"))?.whyRelevant ?? "missing",
    );
    expect(within(why).queryByRole("button", { name: "Read all" })).toBeNull();
    restore();
  });

  it("says plainly when nothing is planned", () => {
    const { desktop, phone } = renderPeople();
    fireEvent.click(desktop.getByRole("button", { name: /^Tom Achebe/ }));
    expect(desktop.getByText("Nothing planned yet.")).toBeInTheDocument();
    expect(phone.getByRole("region", { name: "Next" })).toHaveTextContent(
      /^NextNothing planned yet\.$/,
    );
    expect(document.body).not.toHaveTextContent(/add a next step/i);
  });

  it("acts on the next step in a compact card, with Today's verbs", () => {
    const { phone } = renderPeople();
    fireEvent.click(phone.getByRole("button", { name: /^Daniel Mensah/ }));
    const next = within(phone.getByRole("region", { name: "Next" }));
    expect(next.getByRole("article", { name: "Daniel Mensah replied" })).toBeInTheDocument();
    fireEvent.click(next.getByRole("button", { name: "Write your reply" }));
    expect(next.getByRole("textbox", { name: "Message to Daniel Mensah" })).toBeInTheDocument();
  });

  it("history shows the newest moments first, with Show earlier for the rest", () => {
    const { phone } = renderPeople();
    fireEvent.click(phone.getByRole("button", { name: /^Olivia Hartley/ }));
    const history = phone.getByRole("region", { name: /^Between you/ });
    expect(history).toHaveTextContent("four moments");
    expect(within(history).getAllByRole("listitem")).toHaveLength(3);
    expect(within(history).queryByText("You found Olivia")).toBeNull();

    fireEvent.click(within(history).getByRole("button", { name: /Show 1 earlier moment/ }));
    expect(within(history).getAllByRole("listitem")).toHaveLength(5);
    expect(within(history).getByText("You found Olivia")).toBeInTheDocument();
    // LinkedIn only: no email action is offered.
    expect(phone.queryByRole("link", { name: "Email Olivia" })).toBeNull();
    expect(phone.getByRole("link", { name: "Open Olivia's LinkedIn profile" })).toBeInTheDocument();
  });

  it("notes stay open; sourced facts and the generated angle open on request", () => {
    const { phone } = renderPeople();
    fireEvent.click(phone.getByRole("button", { name: /^Hannah Lindqvist/ }));
    const known = phone.getByRole("region", { name: "What you know" });
    expect(within(known).getByText("Your note")).toBeVisible();

    const folds = [...known.querySelectorAll("details")];
    expect(folds.map((d) => d.querySelector("summary")?.textContent)).toEqual([
      "Sourced facts2 with where they came from",
      "Suggested anglegenerated, not fact",
    ]);
    expect(folds.every((d) => !d.open)).toBe(true);
  });
});

describe("production People — the person in the URL", () => {
  it("desktop: selecting someone puts their id in the URL, replacing the entry", () => {
    const { desktop } = renderPeople();
    const entries = window.history.length;
    fireEvent.click(desktop.getByRole("button", { name: /^Grace Whitfield/ }));
    expect(at()).toBe(`/people?person=${idOf("Grace Whitfield")}`);
    expect(window.history.length).toBe(entries);
    // An id, never a name.
    expect(window.location.search).not.toMatch(/Grace|Whitfield/);
  });

  it("a deep link or refresh opens that exact person, on desktop and phone", () => {
    visit(`/people?person=${idOf("Hannah Lindqvist")}`);
    const { desktop, phone } = renderPeople();
    expect(desktop.getByRole("button", { name: /^Hannah Lindqvist/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      desktop.getByRole("heading", { level: 2, name: "Hannah Lindqvist" }),
    ).toBeInTheDocument();
    const title = phone.getByRole("heading", { level: 1, name: "Hannah Lindqvist" });
    // A fresh load does not move focus; opening from the list does.
    expect(title).not.toHaveFocus();
  });

  it("an unknown or malformed id falls back safely to the default person", () => {
    for (const search of ["?person=prs_does_not_exist", "?person=", "?person=Hannah%20Lindqvist"]) {
      visit(`/people${search}`);
      const { desktop, phone, unmount } = renderPeople();
      expect(desktop.getByRole("button", { name: /^Daniel Mensah/ })).toHaveAttribute(
        "aria-current",
        "true",
      );
      expect(phone.getByRole("heading", { level: 1, name: "People" })).toBeInTheDocument();
      unmount();
    }
  });

  it("phone: Back from a person you arrived at by link goes to the list, not away", () => {
    visit(`/people?person=${idOf("Olivia Hartley")}`);
    const { phone } = renderPeople();
    const entries = window.history.length;
    fireEvent.click(phone.getByRole("button", { name: "Back to People" }));
    expect(at()).toBe("/people");
    expect(window.history.length).toBe(entries);
    expect(phone.getByRole("heading", { level: 1, name: "People" })).toBeInTheDocument();
  });

  it("phone: the browser's Back from a person returns to the list", async () => {
    const { phone } = renderPeople();
    fireEvent.click(phone.getByRole("button", { name: /^Ravi Kapoor/ }));
    expect(phone.getByRole("heading", { level: 1, name: "Ravi Kapoor" })).toBeInTheDocument();
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(at()).toBe("/people");
    expect(phone.getByRole("heading", { level: 1, name: "People" })).toBeInTheDocument();
  });

  it("phone: tapping the People tab from a person returns to the list", () => {
    const { phone } = renderPeople();
    fireEvent.click(phone.getByRole("button", { name: /^Sofia Petrova/ }));
    expect(phone.getByRole("heading", { level: 1, name: "Sofia Petrova" })).toBeInTheDocument();
    // The tab is a link to /people: Next.js navigates there without the person.
    act(() => window.history.pushState(null, "", "/people"));
    expect(phone.getByRole("heading", { level: 1, name: "People" })).toBeInTheDocument();
    expect(phone.getByRole("button", { name: /^Sofia Petrova/ })).toBeInTheDocument();
  });

  it("the session survives moving between people: an approval stays approved", () => {
    const { desktop } = renderPeople();
    fireEvent.click(desktop.getByRole("button", { name: /^Hannah Lindqvist/ }));
    fireEvent.click(desktop.getByRole("button", { name: "Approve" }));
    fireEvent.click(desktop.getByRole("button", { name: /^Grace Whitfield/ }));
    fireEvent.click(desktop.getByRole("button", { name: /^Hannah Lindqvist/ }));
    expect(desktop.getByText("Send your email to Hannah")).toBeInTheDocument();
  });
});
