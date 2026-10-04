import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { findIntegrityViolations } from "@/domain/records";
import { deriveToday } from "@/domain/today";
import * as Briefing from "./_briefing/briefing";
import * as Focus from "./_focus/focus";
import { buildWorkspace } from "./_focus/workspace";
import { loadSnapshot } from "./_shared/load-snapshot";
import type { Answers } from "./_shared/onboarding";
import { deviceId, surfaceId } from "./_shared/options";
import type { Snapshot } from "./_shared/snapshot";
import * as Triage from "./_triage/triage";

/**
 * Disposable with the prototypes. Proves every direction renders every surface
 * from repository data, and that the key interactions run the domain rules.
 */

const DIRECTIONS = { briefing: Briefing, triage: Triage, focus: Focus };
const SURFACES = ["Today", "People", "Onboarding", "TodayMobile"] as const;
const CASES = Object.keys(DIRECTIONS).flatMap((d) =>
  SURFACES.map((surface) => [d as keyof typeof DIRECTIONS, surface] as const),
);
const navigate = () => {};

let snapshot: Snapshot;

beforeAll(async () => {
  snapshot = await loadSnapshot();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("design exploration", () => {
  it.each(CASES)("%s renders %s from repository data", (direction, surface) => {
    const View = DIRECTIONS[direction][surface];
    render(<View snapshot={snapshot} navigate={navigate} />);
    expect(screen.getAllByRole("heading").length).toBeGreaterThan(0);
  });

  it("Briefing: approving a draft moves it to approved, and marking it sent clears it", () => {
    render(<Briefing.Today snapshot={snapshot} navigate={navigate} />);
    const before = screen.getAllByText(/is approved\./).length;
    fireEvent.click(screen.getByRole("button", { name: /Read and approve/ }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getAllByText(/is approved\./)).toHaveLength(before + 1);

    fireEvent.click(screen.getAllByRole("button", { name: /Mark as sent/ })[0]!);
    expect(screen.getAllByText(/is approved\./)).toHaveLength(before);
    expect(screen.getByRole("list", { name: "Done today" })).toHaveTextContent(/^Sent/);
  });

  it("Triage: J moves the selection and E completes the selected action", () => {
    render(<Triage.Today snapshot={snapshot} navigate={navigate} />);
    const options = () => screen.getAllByRole("option");
    expect(options()[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(document, { key: "j" });
    expect(options()[1]).toHaveAttribute("aria-selected", "true");

    const count = options().length;
    fireEvent.click(options()[0]!); // an overdue follow-up: a next action
    fireEvent.keyDown(document, { key: "e" });
    expect(options()).toHaveLength(count - 1);
  });

  it("Focus: skipping brings the next item into focus", () => {
    render(<Focus.Today snapshot={snapshot} navigate={navigate} />);
    const total = screen.getByText(/^1 of \d+$/).textContent?.split(" of ")[1];
    fireEvent.click(screen.getByRole("button", { name: /Skip for now/ }));
    expect(screen.getByText(`2 of ${total}`)).toBeInTheDocument();
  });

  it("Focus: approving keeps your place, and Undo restores the draft", () => {
    render(<Focus.Today snapshot={snapshot} navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: /Hannah Lindqvist.*Draft waiting/ }));
    expect(
      screen.getByRole("heading", { level: 2, name: /^Approve your email to Hannah/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(
      screen.getByRole("heading", { level: 2, name: /^Send your email to Hannah/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Approved/);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(
      screen.getByRole("heading", { level: 2, name: /^Approve your email to Hannah/ }),
    ).toBeInTheDocument();
  });

  it("Focus People: search narrows the list and history reads as a ledger", () => {
    render(<Focus.People snapshot={snapshot} navigate={navigate} />);
    fireEvent.change(screen.getByLabelText("Find a person"), { target: { value: "ravi" } });
    const rows = screen.getAllByRole("button", { name: /Ravi Kapoor/ });
    expect(rows.length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Grace Whitfield/ })).toBeNull();

    fireEvent.click(rows[0]!);
    expect(screen.getByRole("heading", { level: 2, name: "Ravi Kapoor" })).toBeInTheDocument();
    expect(screen.getByText("You met Ravi")).toBeInTheDocument();
  });

  it("Focus mobile: the person behind the current item opens in a sheet", () => {
    render(<Focus.TodayMobile snapshot={snapshot} navigate={navigate} />);
    const focusCard = screen.getByRole("article");
    const person = focusCard.querySelector("button");
    expect(person).not.toBeNull();
    fireEvent.click(person!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Focus mobile: Skip for now brings the next item into focus", () => {
    render(<Focus.TodayMobile snapshot={snapshot} navigate={navigate} />);
    const current = () => screen.getByRole("article").querySelector("h2")?.textContent;
    const first = current();
    fireEvent.click(screen.getByRole("button", { name: /Skip for now/ }));
    expect(current()).not.toBe(first);
  });

  it("Focus onboarding: a single choice advances on its own", () => {
    vi.useFakeTimers();
    render(<Focus.Onboarding snapshot={snapshot} navigate={navigate} />);
    fireEvent.click(screen.getByLabelText(/Internship/));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(
      screen.getByRole("heading", { name: "Which roles are you aiming for?" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["desktop", Focus.Onboarding],
    ["mobile", Focus.OnboardingMobile],
  ])("Focus onboarding (%s): finishing opens Today on the records just created", (_, View) => {
    render(<View snapshot={snapshot} navigate={navigate} />);
    const next = () =>
      fireEvent.click(screen.getByRole("button", { name: /^(Continue|Open Today)$/ }));

    fireEvent.click(screen.getByLabelText(/Graduate role/));
    next();
    fireEvent.click(screen.getByRole("button", { name: "Software engineering" }));
    next();
    fireEvent.click(screen.getByRole("button", { name: "Fintech" }));
    next();
    fireEvent.click(screen.getByRole("button", { name: "London" }));
    next();

    // Continuing without the essentials explains what's missing, on the field.
    next();
    expect(screen.getByText("Give it a name, even a rough one.")).toBeInTheDocument();
    expect(screen.getByLabelText("Role or programme")).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(screen.getByLabelText("Role or programme"), {
      target: { value: "Graduate Engineering Programme" },
    });
    fireEvent.change(screen.getByLabelText("Who it's with"), {
      target: { value: "Ashbury Systems" },
    });
    next();

    fireEvent.change(screen.getByLabelText("Their name"), { target: { value: "Nadia Brooks" } });
    fireEvent.click(screen.getByLabelText("An event"));
    fireEvent.change(screen.getByLabelText(/Why Nadia matters/), {
      target: {
        value: "Joined Ashbury from the same course and offered to explain the interviews.",
      },
    });
    next();
    fireEvent.click(screen.getByLabelText(/Send Nadia a message/));
    next();

    expect(
      screen.getByRole("heading", { level: 2, name: "Send Nadia a message" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("You're set up.");
  });

  it("Focus onboarding: the new person is waiting in People", () => {
    render(<Focus.Onboarding snapshot={snapshot} navigate={navigate} />);
    const next = () =>
      fireEvent.click(screen.getByRole("button", { name: /^(Continue|Open Today)$/ }));
    fireEvent.click(screen.getByLabelText(/Internship/));
    next();
    for (const option of ["Data science", "Fintech", "Manchester"]) {
      fireEvent.click(screen.getByRole("button", { name: option }));
      next();
    }
    fireEvent.change(screen.getByLabelText("Role or programme"), {
      target: { value: "Data Science Summer Internship" },
    });
    fireEvent.change(screen.getByLabelText("Who it's with"), { target: { value: "Fernhill" } });
    next();
    fireEvent.change(screen.getByLabelText("Their name"), { target: { value: "Callum Reid" } });
    fireEvent.click(screen.getByLabelText("Alumni network"));
    next();
    fireEvent.click(screen.getByLabelText(/Read up on Callum first/));
    next();

    fireEvent.click(screen.getByRole("button", { name: "People" }));
    expect(screen.getByRole("heading", { level: 2, name: "Callum Reid" })).toBeInTheDocument();
    expect(screen.getByText("You found Callum")).toBeInTheDocument();
  });

  it("Focus onboarding's records are consistent, and Today starts from them", () => {
    const answers: Answers = {
      objective: "internship",
      roles: ["Software engineering"],
      sectors: ["Fintech"],
      locations: ["London"],
      opportunityTitle: "Software Engineering Summer Internship",
      organisation: "Ledgerline",
      deadline: "",
      opportunityUrl: "ledgerline.com/careers",
      personName: "Tom Okafor",
      personRole: "Software engineer",
      personCompany: " ledgerline",
      source: "alumni_network",
      whyRelevant: "Did the same internship last year.",
      action: 0,
      due: 1,
    };
    const w = buildWorkspace(answers, snapshot);
    const violations = findIntegrityViolations({
      users: [w.user],
      companies: w.companies,
      people: w.people,
      opportunities: w.opportunities,
      interactions: w.interactions,
      drafts: w.drafts,
      nextActions: w.nextActions,
      sourceFacts: w.facts,
      interpretations: w.interpretations,
    });
    expect(violations).toEqual([]);
    expect(w.companies).toHaveLength(1);
    expect(w.opportunities[0]?.url).toBe("https://ledgerline.com/careers");

    const items = deriveToday({ ...w, interactions: [], drafts: [] });
    expect(items[0]).toMatchObject({ kind: "upcoming_action", daysUntilDue: 1 });
  });

  it.each([
    "Opportunities",
    "OpportunitiesMobile",
    "Outreach",
    "OutreachMobile",
    "Companies",
    "CompaniesMobile",
    "Settings",
    "SettingsMobile",
  ] as const)("Focus renders %s from repository data", (surface) => {
    const View = Focus[surface];
    render(<View snapshot={snapshot} navigate={navigate} />);
    expect(screen.getAllByRole("heading").length).toBeGreaterThan(0);
  });

  it("Pursuing opens on what closes first, and shows who you know there", () => {
    render(<Focus.Opportunities snapshot={snapshot} navigate={navigate} />);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Software Engineering Summer Internship 2027",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Summer research placement/ }));
    expect(
      screen.getByRole("heading", { level: 2, name: /^Summer research placement/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /Reaching out · step 3 of 6/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eleanor Marsh" })).toBeInTheDocument();
  });

  it("Pursuing: acting on the next step runs the domain rule and offers Undo", () => {
    render(<Focus.Opportunities snapshot={snapshot} navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: /^Summer engineering internship/ }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("status")).toHaveTextContent(/^Approved/);
    expect(screen.getByRole("button", { name: "Mark as sent" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("Outreach groups people by where their outreach stands, and approving moves a draft on", () => {
    render(<Focus.Outreach snapshot={snapshot} navigate={navigate} />);
    const section = (name: RegExp) => screen.getByRole("region", { name });
    const write = within(section(/^To write/));
    for (const name of ["Daniel Mensah", "Grace Whitfield", "James O'Connor"]) {
      expect(write.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(
      within(section(/^Sent, waiting to hear/)).getByText("Eleanor Marsh"),
    ).toBeInTheDocument();

    fireEvent.click(
      within(section(/^Waiting for your approval/)).getByRole("button", { name: "Approve" }),
    );
    expect(screen.queryByRole("region", { name: /^Waiting for your approval/ })).toBeNull();
    expect(
      within(section(/^Approved, ready to send/)).getByRole("button", { name: "Hannah Lindqvist" }),
    ).toBeInTheDocument();
  });

  it("Companies explains why a company matters from the records, and hands an opportunity to Pursuing", () => {
    const go = vi.fn();
    render(<Focus.Companies snapshot={snapshot} navigate={go} />);
    expect(screen.getByRole("heading", { level: 2, name: "Ledgerline" })).toBeInTheDocument();
    expect(screen.getByText(/Daniel has replied\.$/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^University of Manchester/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Summer research placement/ }));
    expect(go).toHaveBeenCalledWith("opportunities");
    cleanup();

    render(<Focus.Opportunities snapshot={snapshot} navigate={navigate} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /^Summer research placement/ }),
    ).toBeInTheDocument();
  });

  it("Settings explains a problem on the field and saves a valid change for the session", () => {
    render(<Focus.Settings snapshot={snapshot} navigate={navigate} />);
    const email = screen.getByLabelText("Email");
    fireEvent.change(email, { target: { value: "not an email" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("That doesn't look like an email address.")).toBeInTheDocument();
    expect(email).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(email, { target: { value: "aisha.r@student.example" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved for this session.");

    fireEvent.click(screen.getByRole("button", { name: "Change places" }));
    for (const remove of screen.getAllByRole("button", { name: /^Remove / }))
      fireEvent.click(remove);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText("Keep at least one.")).toBeInTheDocument();
  });

  it("Focus mobile Pursuing opens one opportunity at a time, with a way back", () => {
    render(<Focus.OpportunitiesMobile snapshot={snapshot} navigate={navigate} />);
    fireEvent.click(
      screen.getByRole("button", { name: /^Software Engineering Summer Internship 2027/ }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Software Engineering Summer Internship 2027",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to Pursuing" }));
    expect(screen.getByRole("heading", { level: 1, name: "Pursuing" })).toBeInTheDocument();
  });

  it("Focus mobile People: search, open a person, and reveal earlier history", () => {
    render(<Focus.PeopleMobile snapshot={snapshot} navigate={navigate} />);
    fireEvent.change(screen.getByLabelText("Find a person"), { target: { value: "olivia" } });
    expect(screen.queryByRole("button", { name: /Daniel Mensah/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Olivia Hartley/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Olivia Hartley" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why Olivia matters" })).toBeInTheDocument();
    expect(screen.queryByText("You found Olivia")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Show 1 earlier moment/ }));
    expect(screen.getByText("You found Olivia")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to People" }));
    expect(screen.getByRole("heading", { level: 1, name: "People" })).toBeInTheDocument();
  });

  it("Focus mobile Outreach: one person at a time, and approving moves the draft on", () => {
    render(<Focus.OutreachMobile snapshot={snapshot} navigate={navigate} />);
    const approval = screen.getByRole("region", { name: "Waiting for your approval" });
    fireEvent.click(within(approval).getByRole("button", { name: /^Hannah Lindqvist/ }));
    expect(
      screen.getByRole("heading", { level: 2, name: /^Approve your email to Hannah/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("button", { name: "Mark as sent" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Outreach" }));
    const ready = screen.getByRole("region", { name: "Approved, ready to send" });
    expect(within(ready).getByRole("button", { name: /^Hannah Lindqvist/ })).toBeInTheDocument();
  });

  it("Focus mobile tabs: People, Pursuing and Outreach are real destinations", () => {
    const go = vi.fn();
    render(<Focus.TodayMobile snapshot={snapshot} navigate={go} />);
    const tabs = within(screen.getByRole("navigation", { name: "Sections" }));
    fireEvent.click(tabs.getByRole("button", { name: "People" }));
    fireEvent.click(tabs.getByRole("button", { name: "Pursuing" }));
    fireEvent.click(tabs.getByRole("button", { name: "Outreach" }));
    expect(go.mock.calls.map(([surface]) => surface)).toEqual([
      "people",
      "opportunities",
      "outreach",
    ]);
  });

  it("Harness links: old phone surfaces still open on a phone", () => {
    expect([surfaceId("mobile"), deviceId(undefined, "mobile")]).toEqual(["today", "phone"]);
    expect([surfaceId("onboardingMobile"), deviceId(undefined, "onboardingMobile")]).toEqual([
      "onboarding",
      "phone",
    ]);
    expect([surfaceId("outreach"), deviceId("phone", "outreach")]).toEqual(["outreach", "phone"]);
    expect(deviceId(undefined, "outreach")).toBe("desktop");
  });

  it("Briefing onboarding: the answers build a Today that starts with the chosen step", () => {
    render(<Briefing.Onboarding snapshot={snapshot} navigate={navigate} />);
    const next = () =>
      fireEvent.click(screen.getByRole("button", { name: /Continue|Build my Today/ }));

    fireEvent.click(screen.getByLabelText(/Graduate role/));
    next();
    fireEvent.click(screen.getByRole("button", { name: "Software engineering" }));
    next();
    fireEvent.click(screen.getByRole("button", { name: "Fintech" }));
    next();
    fireEvent.click(screen.getByRole("button", { name: "London" }));
    next();
    fireEvent.change(screen.getByLabelText("Opportunity"), {
      target: { value: "Graduate Engineer Programme" },
    });
    fireEvent.change(screen.getByLabelText("Organisation"), {
      target: { value: "Ashbury Systems" },
    });
    next();
    fireEvent.change(screen.getByLabelText("Their name"), { target: { value: "Nadia Brooks" } });
    fireEvent.change(screen.getByLabelText("Where you found them"), { target: { value: "event" } });
    next();
    fireEvent.click(screen.getByLabelText(/Introduce yourself to Nadia/));
    next();

    expect(
      screen.getByRole("heading", { name: "Your first briefing is ready." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Introduce yourself to Nadia")).toBeInTheDocument();
  });
});
