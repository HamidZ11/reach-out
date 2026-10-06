import { fireEvent, render, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeedDataset, SEED_USER_ID } from "@/data/seed/dataset";
import { createSeedRepository } from "@/data/seed/seed-repository";
import { calendarDate } from "@/domain/time";
import type { Workspace } from "@/features/workspace/records";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { Settings } from "./settings";

/**
 * Production Settings over the seed repository, through the same loader the
 * route uses. Both compositions render (CSS shows one), so queries are scoped
 * to the desktop or phone layout.
 */

let workspace: Workspace;

beforeAll(async () => {
  const anchor = calendarDate("2026-10-05");
  const repository = createSeedRepository(createSeedDataset(anchor), SEED_USER_ID);
  workspace = await loadWorkspace(repository, new Date("2026-10-05T09:00:00Z"));
});

function renderSettings(w: Workspace = workspace) {
  const { container, unmount } = render(<Settings workspace={w} />);
  const layout = (name: "desktop" | "phone") => {
    const element = container.querySelector<HTMLElement>(`[data-layout="${name}"]`);
    if (!element) throw new Error(`No ${name} layout`);
    return { element, ...within(element) };
  };
  return { desktop: layout("desktop"), phone: layout("phone"), unmount, container };
}

describe("production Settings", () => {
  it("shows the approved sections in order", () => {
    const { desktop } = renderSettings();
    expect(desktop.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(desktop.getByText("Your profile and what you're aiming for")).toBeInTheDocument();
    expect(desktop.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Profile",
      "What you're aiming for",
      "NotificationsNot available yet",
      "Connected accounts",
      "Your data",
    ]);
  });

  it("the profile comes from the signed-in user's record", () => {
    const { desktop } = renderSettings();
    expect(desktop.getByLabelText("Name")).toHaveValue("Aisha Rahman");
    expect(desktop.getByLabelText("Email")).toHaveValue("aisha.rahman@student.example");
    expect(desktop.getByLabelText("University")).toHaveValue("University of Manchester");
    expect(desktop.getByLabelText("Course")).toHaveValue("BSc Computer Science");
    expect(desktop.getByLabelText("Graduating")).toHaveValue("2028");
    expect(desktop.getByLabelText("Time zone")).toHaveValue(workspace.user.timeZone);
    // Nothing to save until something changes.
    expect(desktop.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  it("validates on the field, as help, and saves for this session only", () => {
    const { desktop } = renderSettings();
    fireEvent.change(desktop.getByLabelText("Email"), { target: { value: "not an email" } });
    fireEvent.click(desktop.getByRole("button", { name: "Save changes" }));
    const email = desktop.getByLabelText("Email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("That doesn't look like an email address.");

    fireEvent.change(email, { target: { value: "aisha.r@student.example" } });
    fireEvent.click(desktop.getByRole("button", { name: "Save changes" }));
    expect(desktop.getByRole("status")).toHaveTextContent("Saved for this session.");
    expect(desktop.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(desktop.getByLabelText("Email")).toHaveValue("aisha.r@student.example");
  });

  it("what you're aiming for, from onboarding, changes in place", () => {
    const { desktop } = renderSettings();
    const goals = within(desktop.getByRole("region", { name: "What you're aiming for" }));
    expect(goals.getByText("Internship")).toBeInTheDocument();
    expect(goals.getByText("London · Manchester · Remote (UK)")).toBeInTheDocument();

    fireEvent.click(goals.getByRole("button", { name: "Change places" }));
    fireEvent.change(goals.getByRole("textbox", { name: "Add a place" }), {
      target: { value: "Edinburgh" },
    });
    fireEvent.click(goals.getByRole("button", { name: "Add" }));
    fireEvent.click(goals.getByRole("button", { name: "Remove Remote (UK)" }));
    fireEvent.click(goals.getByRole("button", { name: "Done" }));
    // Saving resets both layouts' forms to what was saved, so read the section afresh.
    const saved = within(desktop.getByRole("region", { name: "What you're aiming for" }));
    expect(saved.getByText("London · Manchester · Edinburgh")).toBeInTheDocument();
    expect(desktop.getByRole("status")).toHaveTextContent("Saved for this session.");
  });

  it("keeps at least one of each target", () => {
    const { desktop } = renderSettings();
    const goals = within(desktop.getByRole("region", { name: "What you're aiming for" }));
    fireEvent.click(goals.getByRole("button", { name: "Change industries" }));
    for (const v of ["Fintech", "Developer tools", "Research"]) {
      fireEvent.click(goals.getByRole("button", { name: `Remove ${v}` }));
    }
    fireEvent.click(goals.getByRole("button", { name: "Done" }));
    expect(goals.getByText("Keep at least one.")).toBeInTheDocument();
  });

  it("says plainly what isn't built: no controls that pretend to work", () => {
    const { desktop } = renderSettings();
    const accounts = within(desktop.getByRole("region", { name: "Connected accounts" }));
    expect(accounts.getByText("Later")).toBeInTheDocument();
    expect(accounts.getByText(/It will only ever send what you have approved/)).toBeInTheDocument();
    expect(accounts.getByText(/Never connected/)).toBeInTheDocument();
    expect(accounts.queryByRole("button")).toBeNull();
    expect(accounts.queryByRole("link")).toBeNull();

    const notifications = within(desktop.getByRole("region", { name: /^Notifications/ }));
    expect(notifications.getByText("Not available yet")).toBeInTheDocument();
    expect(notifications.queryByRole("button")).toBeNull();
    expect(notifications.queryByRole("checkbox")).toBeNull();

    const data = within(desktop.getByRole("region", { name: "Your data" }));
    expect(data.getByText("Arrives with accounts")).toBeInTheDocument();
    expect(data.queryByRole("button")).toBeNull();
  });

  it("before onboarding, goals say so instead of showing empty fields", () => {
    const { goals: _goals, onboardingCompletedAt: _done, ...user } = workspace.user;
    const { desktop } = renderSettings({ ...workspace, user });
    expect(
      within(desktop.getByRole("region", { name: "What you're aiming for" })).getByText(
        "You haven't set this yet. Onboarding asks for it first.",
      ),
    ).toBeInTheDocument();
  });

  it("phone: opened from your avatar, with Back to Today and no tab of its own", () => {
    const { phone } = renderSettings();
    expect(phone.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(phone.getByRole("link", { name: "Back to Today" })).toHaveAttribute("href", "/today");
    expect(phone.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(phone.getByLabelText("Name")).toHaveValue("Aisha Rahman");
  });

  it("both layouts render, with unique ids, and share what was saved", () => {
    const { container, desktop, phone } = renderSettings();
    const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);

    fireEvent.change(desktop.getByLabelText("Name"), { target: { value: "Aisha K. Rahman" } });
    fireEvent.click(desktop.getByRole("button", { name: "Save changes" }));
    expect(phone.getByLabelText("Name")).toHaveValue("Aisha K. Rahman");
  });

  it("has no single-key shortcuts", () => {
    const { desktop } = renderSettings();
    const before = desktop.element.innerHTML;
    for (const key of ["s", "e", "a", "j", "k", "ArrowDown"]) {
      fireEvent.keyDown(document, { key });
    }
    expect(desktop.element.innerHTML).toBe(before);
  });
});
