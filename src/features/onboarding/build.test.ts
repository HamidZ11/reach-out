import { describe, expect, it } from "vitest";
import { createSeedDataset, SEED_USER_ID } from "@/data/seed/dataset";
import { createSeedRepository } from "@/data/seed/seed-repository";
import { calendarDate, instant } from "@/domain/time";
import { deriveToday } from "@/domain/today";
import { buildUser } from "@/test/builders";
import type { OnboardingBase } from "./build";
import { buildWorkspace } from "./build";
import { loadOnboarding } from "./load-onboarding";
import type { Answers } from "./questions";
import { EMPTY } from "./questions";

const base: OnboardingBase = {
  now: instant("2026-03-10T09:00:00.000Z"),
  today: calendarDate("2026-03-10"),
  user: buildUser({ name: "Kofi Asante", email: "kofi.asante@student.example" }),
};

const answers: Answers = {
  ...EMPTY,
  objective: "internship",
  roles: ["Software engineering"],
  sectors: ["Fintech"],
  locations: ["London", "Remote (UK)"],
  opportunityTitle: "Platform Engineering Summer Internship",
  organisation: "Halden Robotics",
  deadline: "2026-03-14",
  opportunityUrl: "halden.example/careers",
  personName: "Priya Natarajan",
  personRole: "Graduate engineer",
  source: "alumni_network",
  whyRelevant: "Did this internship last year and knows the interviews.",
  action: 0,
  due: 0,
};

describe("onboarding's outcome", () => {
  it("becomes real domain records: goals, a company, an opportunity, a person and a step", () => {
    const w = buildWorkspace(answers, base);
    expect(w.user.goals).toEqual({
      objective: "internship",
      targetRoles: ["Software engineering"],
      targetSectors: ["Fintech"],
      targetLocations: ["London", "Remote (UK)"],
    });
    expect(w.user.onboardingCompletedAt).toBe(base.now);
    expect(w.companies.map((c) => c.name)).toEqual(["Halden Robotics"]);
    const [opportunity] = w.opportunities;
    expect(opportunity).toMatchObject({
      title: "Platform Engineering Summer Internship",
      status: "identified",
      type: "internship",
      deadline: "2026-03-14",
      url: "https://halden.example/careers",
      personIds: ["onboarding_person"],
    });
    expect(w.people[0]).toMatchObject({
      name: "Priya Natarajan",
      role: "Graduate engineer",
      companyId: w.companies[0]?.id,
      source: { kind: "alumni_network" },
      relationshipStatus: "new",
    });
    expect(w.nextActions[0]).toMatchObject({
      kind: "reach_out",
      title: "Send Priya a message",
      dueOn: "2026-03-10",
      personId: "onboarding_person",
    });
  });

  it("lands on a Today that already holds the first step and the deadline", () => {
    const w = buildWorkspace(answers, base);
    expect(deriveToday(w).map((item) => item.kind)).toEqual([
      "deadline_approaching",
      "upcoming_action",
    ]);
  });

  it("matches the person's company by name; a different one is its own company", () => {
    const same = buildWorkspace({ ...answers, personCompany: "  halden ROBOTICS " }, base);
    expect(same.companies).toHaveLength(1);
    const other = buildWorkspace({ ...answers, personCompany: "Orbis Health" }, base);
    expect(other.companies.map((c) => c.name)).toEqual(["Halden Robotics", "Orbis Health"]);
  });

  it("a step without the person stays with the opportunity", () => {
    const w = buildWorkspace({ ...answers, action: 3, due: 3 }, base);
    expect(w.nextActions[0]).toMatchObject({ kind: "apply", dueOn: "2026-03-13" });
    expect(w.nextActions[0]?.personId).toBeUndefined();
  });

  it("refuses an unfinished flow rather than inventing anything", () => {
    expect(() => buildWorkspace({ ...answers, source: undefined }, base)).toThrow(
      "Onboarding is incomplete",
    );
  });

  it("starts from the signed-in user, through the Repository", async () => {
    const repository = createSeedRepository(
      createSeedDataset(calendarDate("2026-10-05")),
      SEED_USER_ID,
    );
    // 23:30 in UTC is already the next day in London.
    const loaded = await loadOnboarding(repository, new Date("2026-10-04T23:30:00Z"));
    expect(loaded.user.id).toBe(SEED_USER_ID);
    expect(loaded.today).toBe("2026-10-05");
    expect(loaded.now).toBe("2026-10-04T23:30:00.000Z");
  });
});
