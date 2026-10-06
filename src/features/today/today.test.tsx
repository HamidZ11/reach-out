import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeedDataset, SEED_USER_ID } from "@/data/seed/dataset";
import { createSeedRepository } from "@/data/seed/seed-repository";
import { calendarDate } from "@/domain/time";
import type { Workspace } from "@/features/workspace/records";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { createLocalActions } from "@/features/workspace/local-actions";
import { Today } from "./today";

/**
 * Production Today over the seed repository, through the same loader the
 * route uses. Both compositions render (CSS shows one), so queries are scoped
 * to the desktop or phone layout.
 */

let workspace: Workspace;

beforeAll(async () => {
  const anchor = calendarDate("2026-10-05");
  const repository = createSeedRepository(createSeedDataset(anchor), SEED_USER_ID);
  workspace = await loadWorkspace(repository, new Date("2026-10-05T09:00:00Z"));
});

function renderToday() {
  const { container } = render(
    <Today workspace={workspace} actions={createLocalActions(workspace)} />,
  );
  const layout = (name: "desktop" | "phone") => {
    const element = container.querySelector<HTMLElement>(`[data-layout="${name}"]`);
    if (!element) throw new Error(`No ${name} layout`);
    return within(element);
  };
  return { desktop: layout("desktop"), phone: layout("phone") };
}

describe("production Today", () => {
  it("desktop: the current item leads, and Your day follows the domain's order", () => {
    const { desktop } = renderToday();
    expect(desktop.getByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
    expect(
      desktop.getByRole("heading", {
        level: 2,
        name: "Follow up with Grace about interview timing",
      }),
    ).toBeInTheDocument();
    expect(desktop.getByText("1 of 9")).toBeInTheDocument();

    const panel = within(desktop.getByRole("complementary", { name: "Your day" }));
    const groups = panel.getAllByRole("region").map((g) => ({
      label: g.getAttribute("aria-label"),
      rows: within(g)
        .getAllByRole("button")
        .map((b) => b.querySelector('[class*="rowTitle"]')?.textContent),
    }));
    expect(groups).toEqual([
      {
        label: "Needs you",
        rows: ["Grace Whitfield", "Daniel Mensah", "Software Engineering Summer Internship 2027"],
      },
      { label: "Approve and send", rows: ["Hannah Lindqvist", "Sofia Petrova"] },
      {
        label: "Coming up",
        rows: [
          "Ravi Kapoor",
          "Hannah Lindqvist",
          "James O'Connor",
          "Software Engineering Summer Internship 2027",
        ],
      },
    ]);
    // The person links to People with them selected: by id, never by name.
    const grace = workspace.people.find((p) => p.name === "Grace Whitfield");
    expect(desktop.getByRole("link", { name: "Grace Whitfield" })).toHaveAttribute(
      "href",
      `/people?person=${grace?.id}`,
    );
  });

  it("phone: focus first, then up next, then the rest of the day", () => {
    const { phone } = renderToday();
    expect(phone.getByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
    expect(
      phone.getByRole("heading", {
        level: 2,
        name: "Follow up with Grace about interview timing",
      }),
    ).toBeInTheDocument();
    const upNext = within(phone.getByRole("region", { name: "Up next" }));
    expect(upNext.getByText("Daniel Mensah replied")).toBeInTheDocument();
    expect(
      within(phone.getByRole("region", { name: "Then" })).getAllByRole("listitem"),
    ).toHaveLength(7);
    expect(phone.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("phone: the person opens in a sheet that Escape closes", () => {
    const { phone } = renderToday();
    fireEvent.click(phone.getByRole("button", { name: /^Grace Whitfield/ }));
    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByRole("heading", { name: "Grace Whitfield" })).toBeInTheDocument();
    expect(sheet.getByText("You found Grace")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("complete: once saved, the item leaves Today in both layouts, with an answer and Undo", async () => {
    const { desktop, phone } = renderToday();
    fireEvent.click(desktop.getByRole("button", { name: "Already done" }));

    await waitFor(() =>
      expect(desktop.getByRole("status")).toHaveTextContent(
        "Done: Follow up with Grace about interview timing.",
      ),
    );
    expect(
      desktop.getByRole("heading", { level: 2, name: "Daniel Mensah replied" }),
    ).toBeInTheDocument();
    expect(
      phone.getByRole("heading", { level: 2, name: "Daniel Mensah replied" }),
    ).toBeInTheDocument();
    expect(desktop.getByText("1 of 8")).toBeInTheDocument();

    fireEvent.click(desktop.getByRole("button", { name: "Undo" }));
    expect(
      await desktop.findByRole("heading", {
        level: 2,
        name: "Follow up with Grace about interview timing",
      }),
    ).toBeInTheDocument();
    expect(desktop.getByRole("status")).toHaveTextContent("Undone.");
  });

  it("a change that can't be saved says so, and nothing moves", async () => {
    const failing = createLocalActions(workspace);
    failing.completeNextAction = () => Promise.resolve({ ok: false, problem: "unavailable" });
    const { container } = render(<Today workspace={workspace} actions={failing} />);
    const desktop = within(container.querySelector<HTMLElement>('[data-layout="desktop"]')!);
    fireEvent.click(desktop.getByRole("button", { name: "Already done" }));
    await waitFor(() =>
      expect(desktop.getByRole("status")).toHaveTextContent(
        "Couldn't save. Check your connection and try again.",
      ),
    );
    expect(
      desktop.getByRole("heading", {
        level: 2,
        name: "Follow up with Grace about interview timing",
      }),
    ).toBeInTheDocument();
    // A failure has nothing to undo.
    expect(desktop.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("snooze: the domain rule moves the follow-up out of first place", async () => {
    const { desktop } = renderToday();
    fireEvent.click(desktop.getByRole("button", { name: /^Snooze to / }));
    await waitFor(() =>
      expect(desktop.getByRole("status")).toHaveTextContent(/^Snoozed to Tue 6 Oct\./),
    );
    expect(
      desktop.getByRole("heading", { level: 2, name: "Daniel Mensah replied" }),
    ).toBeInTheDocument();
  });

  it("has no keyboard shortcuts: J, K, E, S and A change nothing, and no legend shows", () => {
    const { desktop } = renderToday();
    const press = () => {
      for (const key of ["j", "k", "e", "s", "a", "J", "K", "E", "S", "A"]) {
        fireEvent.keyDown(document, { key });
      }
    };

    press();
    expect(
      desktop.getByRole("heading", {
        level: 2,
        name: "Follow up with Grace about interview timing",
      }),
    ).toBeInTheDocument();
    expect(desktop.getByText("1 of 9")).toBeInTheDocument();
    expect(desktop.getByRole("status")).toBeEmptyDOMElement();

    // Not even with a draft in focus: approving takes a click.
    const panel = within(desktop.getByRole("complementary", { name: "Your day" }));
    fireEvent.click(panel.getByRole("button", { name: /Hannah Lindqvist.*Draft waiting/ }));
    press();
    expect(
      desktop.getByRole("heading", { level: 2, name: "Approve your email to Hannah" }),
    ).toBeInTheDocument();

    expect(document.querySelector("kbd")).toBeNull();
    expect(desktop.queryByText(/move ·|snooze ·/)).toBeNull();
  });

  it("approve: a draft waiting for approval becomes ready to send", async () => {
    const { desktop } = renderToday();
    const panel = within(desktop.getByRole("complementary", { name: "Your day" }));
    fireEvent.click(panel.getByRole("button", { name: /Hannah Lindqvist.*Draft waiting/ }));
    expect(
      desktop.getByRole("heading", { level: 2, name: "Approve your email to Hannah" }),
    ).toBeInTheDocument();

    fireEvent.click(desktop.getByRole("button", { name: "Approve" }));
    expect(
      await desktop.findByRole("heading", { level: 2, name: "Send your email to Hannah" }),
    ).toBeInTheDocument();
    expect(desktop.getByRole("status")).toHaveTextContent(/^Approved/);
  });
});
