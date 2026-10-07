import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Landing } from "./landing";

/**
 * The public landing page: what Reachout is, how outreach works in it, and
 * two ways in. It reads nothing about the visitor.
 */

function renderLanding() {
  const enterDemo = vi.fn(() => Promise.resolve());
  render(<Landing enterDemo={enterDemo} />);
  return { enterDemo };
}

describe("the landing page", () => {
  it("says what Reachout is", () => {
    renderLanding();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "A personal outreach workspace for students and new grads.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Track the people, opportunities and conversations behind your job search."),
    ).toBeInTheDocument();
  });

  it("Try the demo enters the demo workspace", async () => {
    const { enterDemo } = renderLanding();
    const buttons = screen.getAllByRole("button", { name: /Try the demo/ });
    // Once in the hero and once at the end.
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]!);
    await waitFor(() => expect(enterDemo).toHaveBeenCalledOnce());
  });

  it("Sign in goes to the real sign-in", () => {
    renderLanding();
    const links = screen.getAllByRole("link", { name: "Sign in" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute("href", "/sign-in");
  });

  it("explains the workflow, with approving and sending in the user's hands", () => {
    renderLanding();
    const flow = within(screen.getByRole("list"));
    expect(
      flow
        .getAllByRole("listitem")
        .map((li) => li.querySelector('[class*="stepName"]')?.textContent),
    ).toEqual(["Find", "Research", "Understand", "Draft", "Approve", "Send", "Follow up"]);
    expect(screen.getByText(/Reachout never sends anything/)).toBeInTheDocument();
  });

  it("covers the three things Reachout does, and nothing it can't show", () => {
    renderLanding();
    for (const title of [
      "Know who matters",
      "Know what to do next",
      "Keep the relationship history",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\bAI\b/);
    expect(text).not.toMatch(/pricing|testimonial|trusted by|customers/i);
  });

  it("has no single-key shortcuts", () => {
    renderLanding();
    const before = document.body.innerHTML;
    for (const key of ["j", "k", "e", "s", "a", "d"]) fireEvent.keyDown(document.body, { key });
    expect(document.body.innerHTML).toBe(before);
  });
});

describe("the landing route", () => {
  it("is public: it reads no session and no records", () => {
    const source = readFileSync(join(process.cwd(), "src", "app", "page.tsx"), "utf8");
    for (const call of ["getRepository", "getSession", "requireSession", "redirect("]) {
      expect(source).not.toContain(call);
    }
    expect(source).toContain("await connection()");
    expect(source).toContain("enterDemo");
  });
});
