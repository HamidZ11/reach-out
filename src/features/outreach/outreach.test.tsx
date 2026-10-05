import { act, fireEvent, render, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSeedDataset, SEED_USER_ID } from "@/data/seed/dataset";
import { createSeedRepository } from "@/data/seed/seed-repository";
import { calendarDate } from "@/domain/time";
import type { Workspace } from "@/features/workspace/records";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { currentPath, syncSearchParamsWithHistory, visit } from "@/test/navigation";
import { Outreach } from "./outreach";

/**
 * Production Outreach over the seed repository, through the same loader the
 * route uses. Both compositions render (CSS shows one), so queries are scoped
 * to the desktop or phone layout.
 */

vi.mock("next/navigation", () => import("@/test/navigation"));

let workspace: Workspace;
const personId = (name: string) => {
  const p = workspace.people.find((x) => x.name === name);
  if (!p) throw new Error(`No ${name} in the seed`);
  return p.id;
};
const opportunityOf = (name: string) =>
  workspace.opportunities.find((o) => o.personIds.includes(personId(name)));

beforeAll(async () => {
  const anchor = calendarDate("2026-10-05");
  const repository = createSeedRepository(createSeedDataset(anchor), SEED_USER_ID);
  workspace = await loadWorkspace(repository, new Date("2026-10-05T09:00:00Z"));
  // jsdom does not lay out, so it has no scrolling.
  Element.prototype.scrollIntoView = vi.fn();
  syncSearchParamsWithHistory();
});

beforeEach(() => {
  visit("/outreach");
});

function renderOutreach() {
  const { container, unmount } = render(<Outreach workspace={workspace} />);
  const layout = (name: "desktop" | "phone") => {
    const element = container.querySelector<HTMLElement>(`[data-layout="${name}"]`);
    if (!element) throw new Error(`No ${name} layout`);
    return { element, ...within(element) };
  };
  return { desktop: layout("desktop"), phone: layout("phone"), unmount };
}

/** A desktop state section and the people in it. */
function section(desktop: ReturnType<typeof renderOutreach>["desktop"], title: RegExp) {
  return within(desktop.getByRole("region", { name: title }));
}

const names = (scope: HTMLElement) =>
  [...scope.querySelectorAll("li[data-track]")].map(
    (li) => li.querySelector('[class*="trackName"], [class*="quietName"]')?.textContent,
  );

describe("production Outreach — desktop", () => {
  it("groups every person's track by action state, in the approved order", () => {
    const { desktop } = renderOutreach();
    expect(desktop.getByRole("heading", { level: 1, name: "Outreach" })).toBeInTheDocument();
    expect(desktop.getByText("3 to write · 1 to approve · 1 to send")).toBeInTheDocument();
    const sections = [...desktop.element.querySelectorAll("section[id^='outreach-']")].map((s) => ({
      title: s.querySelector("h2")?.firstChild?.textContent?.trim(),
      people: names(s as HTMLElement),
    }));
    expect(sections).toEqual([
      { title: "To write", people: ["Grace Whitfield", "Daniel Mensah", "James O'Connor"] },
      { title: "Waiting for your approval", people: ["Hannah Lindqvist"] },
      { title: "Approved, ready to send", people: ["Sofia Petrova"] },
      {
        title: "Sent, waiting to hear",
        people: ["Eleanor Marsh", "Ravi Kapoor", "Olivia Hartley"],
      },
    ]);
    // Not contacted yet and Closed sit apart, folded.
    const folds = [...desktop.element.querySelectorAll("details")];
    expect(folds.map((d) => [d.querySelector("summary")?.textContent, d.open])).toEqual([
      ["Not contacted yet 1", false],
      ["Closed 1", false],
    ]);
  });

  it("explains how a message moves, with how many are at each step", () => {
    const { desktop } = renderOutreach();
    const path = within(desktop.getByRole("complementary", { name: "How a message moves" }));
    const steps = path.getAllByRole("button").map((b) => b.textContent);
    expect(steps).toEqual([
      "1DraftWritten by you, waiting for your approval.",
      "1ApprovedSend it yourself, then mark it as sent.",
      "3SentWaiting to hear back.",
      "2Replied or follow-up dueYour turn to write.",
      "1ClosedStopped for now. Anything new reopens it.",
    ]);
    expect(path.getByText(/Reachout never sends anything on its own/)).toBeInTheDocument();
  });

  it("each track shows who, what it responds to, and Today's verbs in place", () => {
    const { desktop } = renderOutreach();
    const write = section(desktop, /^To write/);
    const grace = within(write.getByText("Grace Whitfield").closest("li") as HTMLElement);
    expect(grace.getByText("Early Careers Recruiter · Ledgerline")).toBeInTheDocument();
    expect(grace.getByText("What you sent")).toBeInTheDocument();
    expect(grace.getByRole("button", { name: "Write the follow-up" })).toBeInTheDocument();
    expect(grace.getByRole("button", { name: "Already done" })).toBeInTheDocument();

    const daniel = within(write.getByText("Daniel Mensah").closest("li") as HTMLElement);
    expect(daniel.getByText("Daniel's reply")).toBeInTheDocument();
    fireEvent.click(daniel.getByRole("button", { name: "Write your reply" }));
    expect(daniel.getByRole("textbox", { name: "Message to Daniel Mensah" })).toBeInTheDocument();
  });

  it("links people and opportunities by id", () => {
    const { desktop } = renderOutreach();
    expect(desktop.getByRole("link", { name: "Hannah Lindqvist" })).toHaveAttribute(
      "href",
      `/people?person=${personId("Hannah Lindqvist")}`,
    );
    expect(desktop.getByRole("link", { name: "Eleanor Marsh" })).toHaveAttribute(
      "href",
      `/people?person=${personId("Eleanor Marsh")}`,
    );
    const hannah = within(desktop.getByText("Hannah Lindqvist").closest("li") as HTMLElement);
    expect(
      hannah.getByRole("link", { name: "Summer engineering internship (not advertised)" }),
    ).toHaveAttribute(
      "href",
      `/opportunities?opportunity=${opportunityOf("Hannah Lindqvist")?.id}`,
    );
  });

  it("sent, waiting: one line each, newest first, with the follow-up plan", () => {
    const { desktop } = renderOutreach();
    const waiting = section(desktop, /^Sent, waiting to hear/);
    const eleanor = waiting.getByText("Eleanor Marsh").closest("li") as HTMLElement;
    expect(eleanor).toHaveTextContent(/^EMEleanor MarshEmailed 3 days ago · /);
    expect(eleanor).toHaveTextContent(/Follow-up Fri 9 Oct$/);
  });
});

describe("production Outreach — approval workflow", () => {
  it("a draft waiting for approval cannot be marked as sent", () => {
    const { desktop } = renderOutreach();
    const approve = section(desktop, /^Waiting for your approval/);
    const hannah = within(approve.getByText("Hannah Lindqvist").closest("li") as HTMLElement);
    // The draft in full, with its subject.
    expect(
      hannah.getByText("Your Manchester Tech Meetup talk on local-first tools"),
    ).toBeInTheDocument();
    expect(hannah.getByText("Waiting for your approval")).toBeInTheDocument();
    expect(hannah.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(hannah.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(hannah.queryByRole("button", { name: "Mark as sent" })).toBeNull();
  });

  it("approving moves it to ready to send; editing it sends it back for approval", () => {
    const { desktop } = renderOutreach();
    const hannahIn = (title: RegExp) =>
      within(section(desktop, title).getByText("Hannah Lindqvist").closest("li") as HTMLElement);

    fireEvent.click(
      hannahIn(/^Waiting for your approval/).getByRole("button", { name: "Approve" }),
    );
    expect(desktop.getByRole("status")).toHaveTextContent(
      "Approved. Send it yourself, then mark it as sent.",
    );
    const ready = hannahIn(/^Approved, ready to send/);
    // The track moved groups; focus follows Hannah instead of falling to the page.
    expect(ready.getByRole("link", { name: "Hannah Lindqvist" })).toHaveFocus();
    expect(ready.getByText("Approved, not sent yet")).toBeInTheDocument();
    expect(ready.getByRole("button", { name: "Mark as sent" })).toBeInTheDocument();
    // Settled text folds until you ask for it.
    expect(ready.getByRole("button", { name: /Read the whole message/ })).toBeInTheDocument();

    fireEvent.click(ready.getByRole("button", { name: "Edit" }));
    fireEvent.change(ready.getByRole("textbox", { name: "Message to Hannah Lindqvist" }), {
      target: { value: "Hi Hannah — a shorter note about your talk on local-first tools." },
    });
    fireEvent.click(ready.getByRole("button", { name: "Save changes" }));
    expect(desktop.getByRole("status")).toHaveTextContent(
      "Draft updated. It needs your approval again.",
    );
    const again = hannahIn(/^Waiting for your approval/);
    expect(again.getByText(/a shorter note about your talk/)).toBeInTheDocument();
    expect(again.queryByRole("button", { name: "Mark as sent" })).toBeNull();
  });

  it("mark as sent records what you sent yourself, for this session only", () => {
    const { desktop, unmount } = renderOutreach();
    const ready = section(desktop, /^Approved, ready to send/);
    const sofia = within(ready.getByText("Sofia Petrova").closest("li") as HTMLElement);
    fireEvent.click(sofia.getByRole("button", { name: "Mark as sent" }));
    expect(desktop.getByRole("status")).toHaveTextContent(
      "Marked as sent to Sofia Petrova. It's in your history.",
    );
    expect(desktop.queryByRole("region", { name: /^Approved, ready to send/ })).toBeNull();
    expect(names(desktop.getByRole("region", { name: /^Sent, waiting to hear/ }))).toContain(
      "Sofia Petrova",
    );

    // Nothing was saved or sent: a fresh page has the approved draft again.
    unmount();
    const again = renderOutreach().desktop;
    expect(names(again.getByRole("region", { name: /^Approved, ready to send/ }))).toEqual([
      "Sofia Petrova",
    ]);
  });
});

describe("production Outreach — the track in the URL", () => {
  it("a link to someone's track brings it into view and marks it", () => {
    visit(`/outreach?person=${personId("Hannah Lindqvist")}`);
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();
    const { desktop } = renderOutreach();
    const marked = desktop.element.querySelector('li[aria-current="true"]');
    expect(marked).toHaveAttribute("data-track", personId("Hannah Lindqvist"));
    expect(scroll.mock.contexts).toContain(marked);
  });

  it("a link to a closed track unfolds Closed", () => {
    visit(`/outreach?person=${personId("Marcus Bell")}`);
    const { desktop } = renderOutreach();
    const closed = [...desktop.element.querySelectorAll("details")].find((d) =>
      d.querySelector("summary")?.textContent?.startsWith("Closed"),
    );
    expect(closed?.open).toBe(true);
  });

  it("an unknown or malformed id falls back safely to the list", () => {
    for (const search of ["?person=prs_nope", "?person=", "?person=Hannah%20Lindqvist"]) {
      visit(`/outreach${search}`);
      const { desktop, phone, unmount } = renderOutreach();
      expect(desktop.element.querySelector('li[aria-current="true"]')).toBeNull();
      expect(phone.getByRole("heading", { level: 1, name: "Outreach" })).toBeInTheDocument();
      unmount();
    }
  });
});

describe("production Outreach — phone", () => {
  it("lists who needs what by action state, with the rest folded", () => {
    const { phone } = renderOutreach();
    expect(phone.getByRole("heading", { level: 1, name: "Outreach" })).toBeInTheDocument();
    expect(phone.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "To write",
      "Waiting for your approval",
      "Approved, ready to send",
      "Sent, waiting to hear",
    ]);
    expect(phone.getByRole("button", { name: /^Grace Whitfield/ })).toHaveTextContent(
      /2 days overdue$/,
    );
    expect(phone.getByRole("button", { name: /^Eleanor Marsh/ })).toHaveTextContent(
      /Emailed 3 days ago$/,
    );
    expect(phone.element.querySelectorAll("details")).toHaveLength(2);
    expect(phone.getByText("Reachout never sends anything on its own.")).toBeInTheDocument();
  });

  it("opens one person at a time, the draft first, and Back returns to the list", async () => {
    const { phone } = renderOutreach();
    fireEvent.click(phone.getByRole("button", { name: /^Hannah Lindqvist/ }));
    expect(currentPath()).toBe(`/outreach?person=${personId("Hannah Lindqvist")}`);
    expect(phone.getByRole("heading", { level: 1, name: "Hannah Lindqvist" })).toHaveFocus();

    const todo = within(phone.getByRole("region", { name: "What to do" }));
    const card = todo.getByRole("article", { name: "Approve your email to Hannah" });
    // The whole page is this item: the draft shows in full.
    expect(card.querySelector('[class*="mClamp"]')).toBeNull();
    expect(within(card).getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Mark as sent" })).toBeNull();

    const forLink = within(phone.getByRole("region", { name: "What it's for" })).getByRole("link");
    expect(forLink).toHaveAttribute(
      "href",
      `/opportunities?opportunity=${opportunityOf("Hannah Lindqvist")?.id}`,
    );
    expect(phone.getByRole("link", { name: /Everything about Hannah/ })).toHaveAttribute(
      "href",
      `/people?person=${personId("Hannah Lindqvist")}`,
    );

    await act(async () => {
      fireEvent.click(phone.getByRole("button", { name: "Back to Outreach" }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(currentPath()).toBe("/outreach");
    expect(phone.getByRole("button", { name: /^Hannah Lindqvist/ })).toHaveFocus();
  });

  it("approving on a phone enables Mark as sent, in the same card", () => {
    visit(`/outreach?person=${personId("Hannah Lindqvist")}`);
    const { phone } = renderOutreach();
    const todo = () => within(phone.getByRole("region", { name: "What to do" }));
    fireEvent.click(todo().getByRole("button", { name: "Approve" }));
    expect(todo().getByRole("article", { name: "Send your email to Hannah" })).toBeInTheDocument();
    expect(todo().getByRole("button", { name: "Mark as sent" })).toBeInTheDocument();
  });

  it("shows what it responds to, and the history between you, newest first", () => {
    visit(`/outreach?person=${personId("Olivia Hartley")}`);
    const { phone } = renderOutreach();
    expect(
      phone.getByRole("heading", { level: 2, name: "Waiting to hear from Olivia" }),
    ).toBeInTheDocument();
    const history = phone.getByRole("region", { name: /^Between you/ });
    expect(within(history).getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(within(history).getByRole("button", { name: /Show 1 earlier moment/ }));
    expect(within(history).getByText("You found Olivia")).toBeInTheDocument();
  });

  it("someone not contacted yet opens from the folded group", () => {
    const { phone } = renderOutreach();
    fireEvent.click(phone.getByRole("button", { name: /^Tom Achebe/ }));
    expect(
      phone.getByRole("heading", { level: 2, name: "You haven't written to Tom yet" }),
    ).toBeInTheDocument();
  });
});

describe("production Outreach — no shortcuts", () => {
  it("letter and arrow keys change nothing", () => {
    const { desktop } = renderOutreach();
    const before = desktop.element.textContent;
    for (const key of ["j", "k", "e", "s", "a", "ArrowDown", "ArrowUp"]) {
      fireEvent.keyDown(document, { key });
    }
    expect(desktop.element.textContent).toBe(before);
    expect(desktop.getByRole("status")).toBeEmptyDOMElement();
    expect(currentPath()).toBe("/outreach");
  });
});
