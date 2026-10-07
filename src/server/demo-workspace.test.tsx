import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { orderedCompanies } from "@/features/companies/aggregate";
import { tracksOf } from "@/features/outreach/tracks";
import { groupsOf } from "@/features/people/groups";
import { opportunityGroups } from "@/features/pursuing/groups";
import { loadToday } from "@/features/today/load-today";
import { loadWorkspace } from "@/features/workspace/load-workspace";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { READ_ONLY_ACTIONS } from "@/test/actions";
import { demoRepository } from "./demo";

/**
 * What a visitor sees on entering the demo (D-035): every surface already has
 * work in it, derived by the same rules and groupings the screens use.
 */

const NOW = new Date("2026-10-07T08:00:00Z");

async function demo() {
  const repository = demoRepository(crypto.randomUUID().replaceAll("-", ""), NOW);
  const workspace = await loadWorkspace(repository, NOW, { research: true });
  const { result } = renderHook(() => useWorkspace(workspace, READ_ONLY_ACTIONS));
  return { repository, workspace, day: result.current };
}

describe("the demo workspace, as each screen shows it", () => {
  it("is already set up: no onboarding", async () => {
    const { workspace } = await demo();
    expect(workspace.user.onboardingCompletedAt).toBeDefined();
  });

  it("Today has several things to do: an overdue follow-up, a reply, a deadline and a draft", async () => {
    const { repository, workspace } = await demo();
    const kinds = (await loadToday(repository, workspace.today)).map((item) => item.kind);
    expect(kinds.length).toBeGreaterThanOrEqual(4);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "overdue_follow_up",
        "reply_awaiting_response",
        "deadline_approaching",
        "draft_awaiting_approval",
      ]),
    );
  });

  it("People holds a recruiter, an engineer, a lecturer and a founder, in different states", async () => {
    const { workspace, day } = await demo();
    const grouped = groupsOf(day, "").flatMap((group) => group.people);
    expect(grouped.length).toBe(workspace.people.length);
    expect(workspace.people.length).toBeGreaterThanOrEqual(8);
    const roles = workspace.people.map((p) => p.role ?? "").join(" | ");
    for (const role of [/recruiter/i, /engineer/i, /lecturer/i, /founder/i]) {
      expect(roles).toMatch(role);
    }
    const statuses = new Set(workspace.people.map((p) => p.relationshipStatus));
    for (const status of ["new", "contacted", "replied", "warm"] as const) {
      expect(statuses).toContain(status);
    }
    // Why each matters, and a history to read.
    expect(workspace.people.filter((p) => p.whyRelevant).length).toBeGreaterThanOrEqual(5);
    const withHistory = new Set(workspace.interactions.map((i) => i.personId));
    expect(withHistory.size).toBeGreaterThanOrEqual(5);
  });

  it("Pursuing has opportunities at different stages, with deadlines and people", async () => {
    const { workspace, day } = await demo();
    expect(opportunityGroups(day).length).toBeGreaterThanOrEqual(2);
    expect(workspace.opportunities.length).toBeGreaterThanOrEqual(5);
    expect(new Set(workspace.opportunities.map((o) => o.status)).size).toBeGreaterThanOrEqual(4);
    expect(workspace.opportunities.filter((o) => o.deadline).length).toBeGreaterThanOrEqual(2);
    expect(workspace.opportunities.filter((o) => o.personIds.length > 0).length).toBeGreaterThan(2);
  });

  it("Outreach has something in every working track", async () => {
    const { day } = await demo();
    const tracks = tracksOf(day);
    for (const key of ["write", "approve", "send", "conversation", "waiting"] as const) {
      expect(tracks[key].length, key).toBeGreaterThan(0);
    }
  });

  it("Companies has several, with their people and opportunities", async () => {
    const { day } = await demo();
    const companies = orderedCompanies(day);
    expect(companies.length).toBeGreaterThanOrEqual(4);
    expect(companies.some((c) => c.people.length > 1 && c.opportunities.length > 0)).toBe(true);
  });
});
