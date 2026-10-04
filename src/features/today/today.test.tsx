import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { createSeedDataset, SEED_USER_ID } from "@/data/seed/dataset";
import { createSeedRepository } from "@/data/seed/seed-repository";
import { calendarDate } from "@/domain/time";
import type { Workspace } from "@/features/workspace/records";
import { loadWorkspace } from "@/features/workspace/load-workspace";
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
  const { container } = render(<Today workspace={workspace} />);
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
    expect(desktop.getByRole("link", { name: "Grace Whitfield" })).toHaveAttribute(
      "href",
      "/people",
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

  it("complete: the item leaves Today in both layouts, with an answer and Undo", () => {
    const { desktop, phone } = renderToday();
    fireEvent.click(desktop.getByRole("button", { name: "Already done" }));

    expect(desktop.getByRole("status")).toHaveTextContent(
      "Done: Follow up with Grace about interview timing.",
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
      desktop.getByRole("heading", {
        level: 2,
        name: "Follow up with Grace about interview timing",
      }),
    ).toBeInTheDocument();
  });

  it("snooze: the domain rule moves the follow-up out of first place", () => {
    const { desktop } = renderToday();
    fireEvent.click(desktop.getByRole("button", { name: /^Snooze to / }));
    expect(desktop.getByRole("status")).toHaveTextContent(/^Snoozed to Tue 6 Oct\./);
    expect(
      desktop.getByRole("heading", { level: 2, name: "Daniel Mensah replied" }),
    ).toBeInTheDocument();
  });

  it("approve: a draft waiting for approval becomes ready to send", () => {
    const { desktop } = renderToday();
    const panel = within(desktop.getByRole("complementary", { name: "Your day" }));
    fireEvent.click(panel.getByRole("button", { name: /Hannah Lindqvist.*Draft waiting/ }));
    expect(
      desktop.getByRole("heading", { level: 2, name: "Approve your email to Hannah" }),
    ).toBeInTheDocument();

    fireEvent.click(desktop.getByRole("button", { name: "Approve" }));
    expect(
      desktop.getByRole("heading", { level: 2, name: "Send your email to Hannah" }),
    ).toBeInTheDocument();
    expect(desktop.getByRole("status")).toHaveTextContent(/^Approved/);
  });
});
