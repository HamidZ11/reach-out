import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Repository } from "@/data/repository";
import { createSeedDataset, SEED_USER_ID } from "@/data/seed/dataset";
import { createSeedRepository } from "@/data/seed/seed-repository";
import { calendarDate } from "@/domain/time";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import type { Workspace } from "@/features/workspace/records";
import type { GmailActions, GmailSettings } from "./gmail";
import type { SettingsActions } from "./operations";
import { GoalsInput, ProfileInput, saveGoalsStep, saveProfileStep } from "./operations";
import type { Account } from "./settings";
import { Settings } from "./settings";

/**
 * Production Settings over the seed repository, through the same loader the
 * route uses. Both compositions render (CSS shows one), so queries are scoped
 * to the desktop or phone layout.
 */

let workspace: Workspace;
const ANCHOR = calendarDate("2026-10-05");
const NOW = new Date("2026-10-05T09:00:00Z");

beforeAll(async () => {
  const repository = createSeedRepository(createSeedDataset(ANCHOR), SEED_USER_ID);
  workspace = await loadWorkspace(repository, NOW);
});

/** Settings' saves, through the same steps the Server Actions run. */
function actionsFor(repository: Repository): SettingsActions {
  return {
    saveProfile: (input) => saveProfileStep(repository, ProfileInput.parse(input), NOW),
    saveGoals: (input) => saveGoalsStep(repository, GoalsInput.parse(input), NOW),
  };
}

const NO_GMAIL: GmailSettings = { available: false, connection: null };

function gmailActionsFake(overrides: Partial<GmailActions> = {}): GmailActions {
  return {
    connect: vi.fn(() => Promise.resolve()),
    check: vi.fn(() => Promise.resolve({ ok: false as const, message: "unused" })),
    disconnect: vi.fn(() => Promise.resolve({ ok: false as const, message: "unused" })),
    ...overrides,
  };
}

function renderSettings(
  w: Workspace = workspace,
  options: {
    actions?: SettingsActions;
    account?: Account;
    gmail?: GmailSettings;
    gmailActions?: GmailActions;
    notice?: string;
  } = {},
) {
  // A fresh account per render, holding exactly what the workspace shows.
  const repository = createSeedRepository(createSeedDataset(ANCHOR), SEED_USER_ID);
  const account = options.account ?? {
    email: w.user.email,
    signOut: vi.fn(() => Promise.resolve()),
  };
  const { container, unmount } = render(
    <Settings
      workspace={w}
      actions={options.actions ?? actionsFor(repository)}
      account={account}
      gmail={options.gmail ?? NO_GMAIL}
      gmailActions={options.gmailActions ?? gmailActionsFake()}
      notice={options.notice}
    />,
  );
  const layout = (name: "desktop" | "phone") => {
    const element = container.querySelector<HTMLElement>(`[data-layout="${name}"]`);
    if (!element) throw new Error(`No ${name} layout`);
    return { element, ...within(element) };
  };
  return {
    desktop: layout("desktop"),
    phone: layout("phone"),
    unmount,
    container,
    repository,
    account,
  };
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
      "Account",
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
    // The email is the sign-in address: shown, not edited here.
    expect(desktop.getByLabelText("Email")).toHaveAttribute("readonly");
    expect(desktop.getByLabelText("Email")).toHaveAccessibleDescription(
      "You sign in with this address.",
    );
    // Nothing to save until something changes.
    expect(desktop.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  it("validates on the field, as help, and saves to the account", async () => {
    const { desktop, repository } = renderSettings();
    fireEvent.change(desktop.getByLabelText("Graduating"), { target: { value: "20x8" } });
    fireEvent.click(desktop.getByRole("button", { name: "Save changes" }));
    const year = desktop.getByLabelText("Graduating");
    expect(year).toHaveAttribute("aria-invalid", "true");
    expect(year).toHaveAccessibleDescription("Use a year, like 2028.");

    fireEvent.change(year, { target: { value: "2029" } });
    fireEvent.change(desktop.getByLabelText("Name"), { target: { value: "Aisha K. Rahman" } });
    fireEvent.click(desktop.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(desktop.getByRole("status")).toHaveTextContent("Saved."));
    expect(desktop.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(desktop.getByLabelText("Graduating")).toHaveValue("2029");
    // Saved, not just shown.
    const saved = await repository.user.get();
    expect(saved.name).toBe("Aisha K. Rahman");
    expect(saved.education?.graduationYear).toBe(2029);
    expect(saved.email).toBe(workspace.user.email);
  });

  it("a save that fails says why, and keeps your edits", async () => {
    const { desktop } = renderSettings(workspace, {
      actions: {
        saveProfile: () => Promise.resolve({ ok: false, problem: "conflict" }),
        saveGoals: () => Promise.resolve({ ok: false, problem: "conflict" }),
      },
    });
    fireEvent.change(desktop.getByLabelText("Name"), { target: { value: "Aisha K. Rahman" } });
    fireEvent.click(desktop.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(desktop.getByRole("status")).toHaveTextContent(
        "That changed somewhere else. Reload to see the latest.",
      ),
    );
    expect(desktop.getByLabelText("Name")).toHaveValue("Aisha K. Rahman");
    expect(desktop.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("what you're aiming for, from onboarding, changes in place", async () => {
    const { desktop, repository } = renderSettings();
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
    await waitFor(() => expect(desktop.getByRole("status")).toHaveTextContent("Saved."));
    // Saving resets both layouts' forms to what was saved, so read the section afresh.
    const saved = within(desktop.getByRole("region", { name: "What you're aiming for" }));
    expect(saved.getByText("London · Manchester · Edinburgh")).toBeInTheDocument();
    expect((await repository.user.get()).goals?.targetLocations).toEqual([
      "London",
      "Manchester",
      "Edinburgh",
    ]);
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
    // Gmail not set up on this deployment: said, not offered.
    expect(accounts.getByText("Not available yet")).toBeInTheDocument();
    expect(accounts.getByText(/^Coming later\./)).toBeInTheDocument();
    expect(accounts.getByText(/will never send, change or delete mail/)).toBeInTheDocument();
    expect(accounts.getByText(/Never connected/)).toBeInTheDocument();
    expect(accounts.queryByRole("button")).toBeNull();
    expect(accounts.queryByRole("link")).toBeNull();

    const notifications = within(desktop.getByRole("region", { name: /^Notifications/ }));
    expect(notifications.getByText("Not available yet")).toBeInTheDocument();
    expect(notifications.queryByRole("button")).toBeNull();
    expect(notifications.queryByRole("checkbox")).toBeNull();

    const data = within(desktop.getByRole("region", { name: "Your data" }));
    expect(data.getByText("Not available yet")).toBeInTheDocument();
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

  it("both layouts render, with unique ids, and share what was saved", async () => {
    const { container, desktop, phone } = renderSettings();
    const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);

    fireEvent.change(desktop.getByLabelText("Name"), { target: { value: "Aisha K. Rahman" } });
    fireEvent.click(desktop.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(phone.getByLabelText("Name")).toHaveValue("Aisha K. Rahman"));
  });

  it("says who is signed in, and signs out from here", () => {
    const signOut = vi.fn(() => Promise.resolve());
    const { desktop } = renderSettings(workspace, {
      account: { email: workspace.user.email, signOut },
    });
    const section = within(desktop.getByRole("region", { name: "Account" }));
    expect(section.getByText(workspace.user.email)).toBeInTheDocument();
    fireEvent.click(section.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("the demo workspace says it is one, and can start again or be left (D-035)", async () => {
    const demo = { reset: vi.fn(() => Promise.resolve()), exit: vi.fn(() => Promise.resolve()) };
    const { desktop, phone } = renderSettings(workspace, { account: { demo } });
    for (const layout of [desktop, phone]) {
      const section = within(layout.getByRole("region", { name: "Account" }));
      expect(section.getByText("Demo workspace")).toBeInTheDocument();
      expect(
        section.getByText(/the people, companies and messages are invented/),
      ).toBeInTheDocument();
      expect(section.getByText(/nothing is ever sent/)).toBeInTheDocument();
      // No account to sign out of.
      expect(section.queryByRole("button", { name: "Sign out" })).toBeNull();
    }
    const section = within(desktop.getByRole("region", { name: "Account" }));
    fireEvent.click(section.getByRole("button", { name: "Reset demo" }));
    expect(demo.reset).toHaveBeenCalledOnce();
    await waitFor(() => expect(section.getByRole("button", { name: "Exit demo" })).toBeEnabled());
    fireEvent.click(section.getByRole("button", { name: "Exit demo" }));
    expect(demo.exit).toHaveBeenCalledOnce();
  });

  it("the development seed session has no sign-out, and says it isn't saved for good", () => {
    const { desktop } = renderSettings(workspace, { account: { email: workspace.user.email } });
    const section = within(desktop.getByRole("region", { name: "Account" }));
    expect(section.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(section.getByText(/development seed session/)).toBeInTheDocument();
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

describe("Settings › Gmail (D-031)", () => {
  const connected = {
    emailAddress: "kofi.asante@gmail.example",
    status: "connected" as const,
    connectedAt: workspace?.now ?? ("2026-10-05T08:00:00.000Z" as never),
    lastSyncedAt: "2026-10-05T08:32:00.000Z" as never,
  };
  const accounts = (desktop: ReturnType<typeof renderSettings>["desktop"]) =>
    within(desktop.getByRole("region", { name: "Connected accounts" }));

  it("not connected: says what it does and offers Connect", () => {
    const gmailActions = gmailActionsFake();
    const { desktop } = renderSettings(workspace, {
      gmail: { available: true, connection: null },
      gmailActions,
    });
    expect(accounts(desktop).getByText(/^Not connected\./)).toBeInTheDocument();
    fireEvent.click(accounts(desktop).getByRole("button", { name: "Connect" }));
    expect(gmailActions.connect).toHaveBeenCalledOnce();
  });

  it("connected: the address, when it last looked, Check now and Disconnect", async () => {
    const gmailActions = gmailActionsFake({
      check: vi.fn(() =>
        Promise.resolve({
          ok: true as const,
          connection: { ...connected, lastSyncedAt: "2026-10-05T08:40:00.000Z" as never },
          message: "Checked Gmail. One message added to your history.",
        }),
      ),
      disconnect: vi.fn(() =>
        Promise.resolve({
          ok: true as const,
          connection: null,
          message: "Gmail disconnected. What it added to your history stays.",
        }),
      ),
    });
    const { desktop } = renderSettings(workspace, {
      gmail: { available: true, connection: connected },
      gmailActions,
    });
    const gmail = accounts(desktop);
    expect(gmail.getByText("kofi.asante@gmail.example")).toBeInTheDocument();
    expect(gmail.getByText("Last checked 09:32, Mon 5 Oct")).toBeInTheDocument();

    fireEvent.click(gmail.getByRole("button", { name: "Check now" }));
    await waitFor(() =>
      expect(desktop.getByRole("status")).toHaveTextContent(
        "Checked Gmail. One message added to your history.",
      ),
    );
    expect(accounts(desktop).getByText("Last checked 09:40, Mon 5 Oct")).toBeInTheDocument();

    fireEvent.click(accounts(desktop).getByRole("button", { name: "Disconnect" }));
    await waitFor(() =>
      expect(accounts(desktop).getByText(/^Not connected\./)).toBeInTheDocument(),
    );
    expect(desktop.getByRole("status")).toHaveTextContent("What it added to your history stays.");
    // Nothing about Gmail is undoable.
    expect(within(desktop.getByRole("status")).queryByRole("button")).toBeNull();
  });

  it("revoked: says it needs reconnecting, and offers Reconnect", () => {
    const gmailActions = gmailActionsFake();
    const { desktop } = renderSettings(workspace, {
      gmail: {
        available: true,
        connection: { ...connected, status: "needs_reconnect", lastError: "revoked" },
      },
      gmailActions,
    });
    expect(accounts(desktop).getByText(/^Reconnect needed/)).toBeInTheDocument();
    fireEvent.click(accounts(desktop).getByRole("button", { name: "Reconnect" }));
    expect(gmailActions.connect).toHaveBeenCalledOnce();
  });

  it("says how connecting went, once, on arrival", () => {
    const { desktop } = renderSettings(workspace, {
      gmail: { available: true, connection: connected },
      notice: "Gmail connected. Reachout will notice what you send and receive from now on.",
    });
    expect(desktop.getByRole("status")).toHaveTextContent(/^Gmail connected\./);
  });

  it("the connection's credentials never reach the page", () => {
    const { container } = renderSettings(workspace, {
      gmail: { available: true, connection: connected },
    });
    expect(container.innerHTML).not.toMatch(/refresh|token|sealed|v1\./i);
  });
});
