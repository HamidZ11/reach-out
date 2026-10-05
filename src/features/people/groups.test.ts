import { describe, expect, it } from "vitest";
import { calendarDate } from "@/domain/time";
import type { Records } from "@/features/workspace/records";
import { indexRecords } from "@/features/workspace/records";
import { buildCompany, buildInteraction, buildOpportunity, buildPerson } from "@/test/builders";
import { groupsOf, matchesQuery, mostRecentlyActive } from "./groups";

const today = calendarDate("2026-03-10");

const halden = buildCompany({ id: "cmp_halden", name: "Halden Robotics" });
const orbis = buildCompany({ id: "cmp_orbis", name: "Orbis Health" });

const priya = buildPerson({
  id: "prs_priya",
  name: "Priya Natarajan",
  role: "Graduate Recruiter",
  companyId: "cmp_halden",
});
const owen = buildPerson({
  id: "prs_owen",
  name: "Owen Gallagher",
  role: "Firmware Engineer",
  companyId: "cmp_halden",
});
const mei = buildPerson({
  id: "prs_mei",
  name: "Mei Tanaka",
  role: "Data Scientist",
  companyId: "cmp_orbis",
});
const leon = buildPerson({ id: "prs_leon", name: "Leon Fischer", role: "Lecturer" });
const ada = buildPerson({ id: "prs_ada", name: "Ada Okafor", role: "Product Manager" });

function day(overrides: Partial<Records> = {}) {
  const records: Records = {
    companies: [halden, orbis],
    people: [priya, owen, mei, leon, ada],
    opportunities: [
      // No deadline: after anything with one.
      buildOpportunity({
        id: "opp_orbis",
        title: "Data science placement",
        companyId: "cmp_orbis",
        status: "researching",
        personIds: ["prs_mei", "prs_owen"],
      }),
      buildOpportunity({
        id: "opp_halden",
        title: "Robotics summer internship",
        companyId: "cmp_halden",
        status: "reaching_out",
        deadline: "2026-03-14",
        personIds: ["prs_priya", "prs_owen"],
      }),
      buildOpportunity({
        id: "opp_closed",
        title: "Autumn insight day",
        companyId: "cmp_halden",
        status: "closed",
        closedReason: "rejected",
        personIds: ["prs_leon"],
      }),
    ],
    interactions: [],
    drafts: [],
    nextActions: [],
    facts: [],
    interpretations: [],
    ...overrides,
  };
  return { today, records, index: indexRecords(records, today, "Europe/London") };
}

const shape = (query = "", d = day()) =>
  groupsOf(d, query).map((g) => [g.title, g.meta, g.people.map((p) => p.name)]);

describe("People groups", () => {
  it("groups by active opportunity, soonest deadline first, then closed, then unlinked", () => {
    expect(shape()).toEqual([
      [
        "Robotics summer internship",
        "Halden Robotics · closes Sat 14 Mar",
        ["Priya Natarajan", "Owen Gallagher"],
      ],
      ["Data science placement", "Orbis Health · researching", ["Mei Tanaka", "Owen Gallagher"]],
      ["From closed opportunities", undefined, ["Leon Fischer"]],
      ["Not linked yet", undefined, ["Ada Okafor"]],
    ]);
  });

  it("searches name, role and company, ignoring case and spaces, and drops empty groups", () => {
    expect(shape("  orbis ")).toEqual([
      ["Data science placement", "Orbis Health · researching", ["Mei Tanaka"]],
    ]);
    expect(shape("ENGINEER")).toEqual([
      ["Robotics summer internship", "Halden Robotics · closes Sat 14 Mar", ["Owen Gallagher"]],
      ["Data science placement", "Orbis Health · researching", ["Owen Gallagher"]],
    ]);
    expect(shape("leon")).toEqual([["From closed opportunities", undefined, ["Leon Fischer"]]]);
    expect(shape("nobody by this name")).toEqual([]);
    expect(matchesQuery(ada, "", day())).toBe(true);
  });

  it("a passed deadline reads as the stage, not as an upcoming date", () => {
    const d = day();
    const passed = {
      ...d.records,
      opportunities: d.records.opportunities.map((o) =>
        o.id === "opp_halden" ? { ...o, deadline: calendarDate("2026-03-01") } : o,
      ),
    };
    const groups = groupsOf(
      { today, records: passed, index: indexRecords(passed, today, "UTC") },
      "",
    );
    expect(groups.map((g) => g.meta)).toContain("Halden Robotics · reaching out");
  });

  it("opens on whoever you were most recently in touch with", () => {
    const d = day({
      interactions: [
        buildInteraction({ id: "int_1", personId: "prs_mei", occurredAt: "2026-03-08T10:00:00Z" }),
        buildInteraction({
          id: "int_2",
          personId: "prs_priya",
          occurredAt: "2026-03-09T16:30:00Z",
        }),
        buildInteraction({ id: "int_3", personId: "prs_owen", occurredAt: "2026-03-02T09:00:00Z" }),
      ],
    });
    expect(mostRecentlyActive(d)).toBe("prs_priya");
    expect(mostRecentlyActive(day())).toBeUndefined();
  });
});
