import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { calendarDate, instant } from "@/domain/time";
import type { Workspace } from "@/features/workspace/records";
import { useWorkspace } from "@/features/workspace/use-workspace";
import {
  buildCompany,
  buildDraft,
  buildInteraction,
  buildOpportunity,
  buildPerson,
  buildUser,
} from "@/test/builders";
import { gather, orderedCompanies, whyLine } from "./aggregate";

function session(records: Partial<Workspace>) {
  const workspace: Workspace = {
    now: instant("2026-03-10T09:00:00.000Z"),
    today: calendarDate("2026-03-10"),
    user: buildUser(),
    companies: [],
    people: [],
    opportunities: [],
    interactions: [],
    drafts: [],
    nextActions: [],
    facts: [],
    interpretations: [],
    ...records,
  };
  return renderHook(() => useWorkspace(workspace)).result.current;
}

const halden = buildCompany({ id: "cmp_halden", name: "Halden Robotics" });
const orbis = buildCompany({ id: "cmp_orbis", name: "Orbis Health" });
const quiet = buildCompany({ id: "cmp_quiet", name: "Quill Analytics" });

const priya = buildPerson({
  id: "prs_priya",
  name: "Priya Natarajan",
  companyId: "cmp_halden",
  relationshipStatus: "warm",
});
const owen = buildPerson({
  id: "prs_owen",
  name: "Owen Gallagher",
  companyId: "cmp_halden",
  relationshipStatus: "contacted",
});
const mei = buildPerson({ id: "prs_mei", name: "Mei Tanaka", companyId: "cmp_orbis" });

const records: Partial<Workspace> = {
  companies: [quiet, orbis, halden],
  people: [priya, owen, mei],
  opportunities: [
    buildOpportunity({
      id: "opp_halden",
      title: "Robotics summer internship",
      companyId: "cmp_halden",
      status: "reaching_out",
      deadline: "2026-03-14",
      personIds: ["prs_priya"],
    }),
    buildOpportunity({
      id: "opp_halden_old",
      title: "Autumn insight day",
      companyId: "cmp_halden",
      status: "closed",
      closedReason: "rejected",
    }),
    buildOpportunity({
      id: "opp_orbis",
      title: "Data science placement",
      companyId: "cmp_orbis",
      status: "researching",
    }),
  ],
  interactions: [
    buildInteraction({
      id: "int_priya",
      personId: "prs_priya",
      occurredAt: "2026-03-05T10:00:00Z",
    }),
    // About Halden's opportunity, with someone who works elsewhere.
    buildInteraction({
      id: "int_about",
      personId: "prs_mei",
      opportunityId: "opp_halden",
      occurredAt: "2026-03-06T10:00:00Z",
    }),
    buildInteraction({ id: "int_mei", personId: "prs_mei", occurredAt: "2026-03-09T10:00:00Z" }),
  ],
  drafts: [
    buildDraft({ id: "drf_owen", personId: "prs_owen" }),
    buildDraft({
      id: "drf_owen_sent",
      personId: "prs_owen",
      status: "sent",
      approvedAt: "2026-03-01T09:00:00Z",
      sentAt: "2026-03-02T09:00:00Z",
      sentInteractionId: "int_priya",
    }),
  ],
};

describe("Companies, derived from the records", () => {
  it("gathers a company's opportunities, people, history and pending drafts", () => {
    const day = session(records);
    const view = gather(halden, day);
    expect(view.pursued.map((o) => o.title)).toEqual([
      "Robotics summer internship",
      "Autumn insight day",
    ]);
    expect(view.active.map((o) => o.id)).toEqual(["opp_halden"]);
    expect(view.people.map((p) => p.name)).toEqual(["Priya Natarajan", "Owen Gallagher"]);
    // Its people's exchanges, and exchanges about its opportunities.
    expect(view.interactions.map((i) => i.id)).toEqual(["int_priya", "int_about"]);
    expect(view.drafts.map((d) => d.id)).toEqual(["drf_owen"]);
    expect(view.deadline).toBe("2026-03-14");
  });

  it("orders companies by what closes first, then by recent activity", () => {
    const day = session(records);
    expect(orderedCompanies(day).map((v) => v.company.name)).toEqual([
      "Halden Robotics",
      "Orbis Health",
      "Quill Analytics",
    ]);
  });

  it("says why a company matters from the records, never a score", () => {
    const day = session(records);
    expect(whyLine(gather(halden, day), day)).toBe(
      "You're pursuing “Robotics summer internship” here, and know two people — you're on good terms with Priya.",
    );
    expect(whyLine(gather(quiet, day), day)).toBe(
      "Nothing is active here right now, but you don't know anyone there yet.",
    );
  });

  it("follows the records: a new person there shows up without anything to maintain", () => {
    const day = session({
      ...records,
      people: [
        ...(records.people ?? []),
        buildPerson({ id: "prs_ana", name: "Ana Ribeiro", companyId: "cmp_quiet" }),
      ],
    });
    expect(gather(quiet, day).people.map((p) => p.name)).toEqual(["Ana Ribeiro"]);
  });
});
