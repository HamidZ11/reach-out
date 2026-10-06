import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createMemoryRepository } from "@/data/memory/memory-repository";
import { calendarDate, instant } from "@/domain/time";
import { actionsFor } from "@/features/workspace/local-actions";
import { buildUser } from "@/test/builders";
import { syncSearchParamsWithHistory, visit } from "@/test/navigation";
import type { OnboardingBase } from "./build";
import type { CompleteOnboarding } from "./complete";
import { completeOnboardingStep, OnboardingInput } from "./complete";
import { Onboarding } from "./onboarding";

vi.mock("next/navigation", () => import("@/test/navigation"));

const base: OnboardingBase = {
  now: instant("2026-03-10T09:00:00.000Z"),
  today: calendarDate("2026-03-10"),
  user: buildUser({ name: "Kofi Asante", email: "kofi.asante@student.example" }),
};

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  syncSearchParamsWithHistory();
  visit("/onboarding");
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Onboarding over an in-memory repository holding one fresh account, through
 * the same completion step the Server Action runs.
 */
function renderOnboarding(complete?: CompleteOnboarding) {
  const repository = createMemoryRepository(
    {
      users: [base.user],
      companies: [],
      people: [],
      opportunities: [],
      interactions: [],
      drafts: [],
      nextActions: [],
      sourceFacts: [],
      interpretations: [],
    },
    base.user.id,
  );
  const now = () => new Date(base.now);
  const save: CompleteOnboarding = (input) =>
    completeOnboardingStep(repository, OnboardingInput.parse(input), now());
  const view = render(
    <Onboarding base={base} complete={complete ?? save} actions={actionsFor(repository, now)} />,
  );
  return { repository, ...view };
}

const question = () => screen.getByRole("heading", { level: 1 }).textContent;
const progress = () => screen.getByRole("progressbar", { name: "Setup" });
const continueButton = () => screen.getByRole("button", { name: /^(Continue|Open Today)/ });

/** Answer the first four steps: goal, roles, industries, places. */
function answerGoals() {
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("radio", { name: /^Internship/ }));
  act(() => vi.advanceTimersByTime(300));
  vi.useRealTimers();
  fireEvent.click(screen.getByRole("button", { name: "Software engineering" }));
  fireEvent.click(continueButton());
  fireEvent.click(screen.getByRole("button", { name: "Fintech" }));
  fireEvent.click(continueButton());
  fireEvent.click(screen.getByRole("button", { name: "London" }));
  fireEvent.click(continueButton());
}

function answerOpportunityAndPerson() {
  fireEvent.change(screen.getByLabelText("Role or programme"), {
    target: { value: "Platform Engineering Summer Internship" },
  });
  fireEvent.change(screen.getByLabelText("Who it's with"), {
    target: { value: "Halden Robotics" },
  });
  fireEvent.click(continueButton());
  fireEvent.change(screen.getByLabelText("Their name"), { target: { value: "Priya Natarajan" } });
  fireEvent.click(screen.getByRole("radio", { name: "Alumni network" }));
  fireEvent.click(continueButton());
}

describe("production onboarding", () => {
  it("asks one question per step, seven in all, starting with the goal", () => {
    renderOnboarding();
    expect(question()).toBe("What are you trying to break into?");
    expect(progress()).toHaveAttribute("aria-valuetext", "Step 1 of 7: Goal");
    // Only the top-bar Back shows on the first step, and it can't go anywhere yet.
    expect(screen.getAllByRole("button", { name: "Back" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(
      within(screen.getByRole("complementary", { name: "Your workspace so far" })).getByText(
        "Your goal",
      ),
    ).toBeInTheDocument();
  });

  it("shows problems only after Continue, on the field, as help", () => {
    renderOnboarding();
    expect(screen.queryByText("Choose the one you're aiming for first.")).toBeNull();
    fireEvent.click(continueButton());
    expect(screen.getByText("Choose the one you're aiming for first.")).toBeInTheDocument();
    expect(question()).toBe("What are you trying to break into?");
  });

  it("the single-choice first step moves on by itself; the rest wait for Continue", () => {
    renderOnboarding();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("radio", { name: /^Internship/ }));
    act(() => vi.advanceTimersByTime(300));
    expect(question()).toBe("Which roles are you aiming for?");
    expect(progress()).toHaveAttribute("aria-valuetext", "Step 2 of 7: Roles");

    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "Software engineering" }));
    expect(screen.getByRole("button", { name: "Software engineering" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(question()).toBe("Which roles are you aiming for?");
  });

  it("adds your own choice, and Back keeps what you answered", () => {
    renderOnboarding();
    answerGoals();
    expect(question()).toBe("What's one opportunity you're already looking at?");

    // Back is in the top bar on a phone and in the footer on desktop; CSS shows one.
    const [topBack, footBack] = screen.getAllByRole("button", { name: "Back" });
    expect(topBack).toBeEnabled();
    fireEvent.click(footBack as HTMLElement);
    expect(question()).toBe("Where would you like to work?");
    expect(screen.getByRole("button", { name: "London" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Add a place/ }));
    const add = screen.getByRole("textbox", { name: "Add a place" });
    fireEvent.change(add, { target: { value: "Dublin" } });
    fireEvent.keyDown(add, { key: "Enter" });
    expect(screen.getByRole("button", { name: "Dublin" })).toHaveAttribute("aria-pressed", "true");
    expect(
      within(screen.getByRole("complementary", { name: "Your workspace so far" })).getByText(
        "London, Dublin",
      ),
    ).toBeInTheDocument();
  });

  it("the opportunity and the person: required fields named, the rest optional", () => {
    renderOnboarding();
    answerGoals();
    fireEvent.click(continueButton());
    expect(screen.getByLabelText("Role or programme")).toHaveAccessibleDescription(
      "Give it a name, even a rough one.",
    );
    expect(screen.getByLabelText("Who it's with")).toHaveAccessibleDescription(
      "Add who it's with.",
    );

    answerOpportunityAndPerson();
    expect(question()).toBe("What should you do next?");
    expect(screen.getByRole("radio", { name: /^Send Priya a message/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Open Today/ })).toBeInTheDocument();
  });

  it("finishing saves the records, then opens the approved Today on what was saved", async () => {
    const { repository } = renderOnboarding();
    answerGoals();
    answerOpportunityAndPerson();
    fireEvent.click(screen.getByRole("radio", { name: /^Send Priya a message/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Open Today/ }));

    const [desktop] = await waitFor(() => {
      const found = document.querySelectorAll<HTMLElement>('[data-layout="desktop"]');
      expect(found).toHaveLength(1);
      return found;
    });
    const today = within(desktop as HTMLElement);
    expect(today.getByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
    expect(
      today.getByRole("heading", { level: 2, name: "Send Priya a message" }),
    ).toBeInTheDocument();
    expect(today.getByRole("status")).toHaveTextContent("You're set up. This is your Today.");
    // Inside the app shell, with Today marked.
    const [rail] = screen.getAllByRole("navigation", { name: "Sections" });
    expect(within(rail as HTMLElement).getByRole("link", { name: /^Today/ })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // Saved, not just shown: the repository holds the account's first records.
    const user = await repository.user.get();
    expect(user.onboardingCompletedAt).toBe(base.now);
    expect(user.goals?.targetLocations).toEqual(["London"]);
    expect((await repository.people.list()).map((p) => p.name)).toEqual(["Priya Natarajan"]);
    expect((await repository.nextActions.list()).map((a) => a.title)).toEqual([
      "Send Priya a message",
    ]);
  });

  it("if saving fails, you stay on the last step, with your answers, and it says so", async () => {
    renderOnboarding(() => Promise.resolve({ ok: false, problem: "unavailable" }));
    answerGoals();
    answerOpportunityAndPerson();
    fireEvent.click(screen.getByRole("radio", { name: /^Send Priya a message/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Open Today/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't save your setup. Check your connection and try again.",
    );
    expect(question()).toBe("What should you do next?");
    expect(screen.getByRole("radio", { name: /^Send Priya a message/ })).toBeChecked();
    expect(screen.queryByRole("heading", { level: 1, name: "Today" })).toBeNull();
  });

  it("leaving before the end saves nothing: a fresh start begins at the first question", async () => {
    const { unmount, repository } = renderOnboarding();
    answerGoals();
    unmount();
    expect((await repository.user.get()).goals).toBeUndefined();
    renderOnboarding();
    expect(question()).toBe("What are you trying to break into?");
  });

  it("has no single-key shortcuts", () => {
    renderOnboarding();
    for (const key of ["j", "k", "n", "b", "ArrowRight", "ArrowLeft"]) {
      fireEvent.keyDown(document, { key });
    }
    expect(question()).toBe("What are you trying to break into?");
  });
});
