import { describe, expect, it } from "vitest";
import { calendarDate } from "@/domain/time";
import type { Records } from "@/features/workspace/records";
import { indexRecords } from "@/features/workspace/records";
import {
  buildCompany,
  buildDraft,
  buildInteraction,
  buildOpportunity,
  buildPerson,
} from "@/test/builders";
import { activityOf, opportunityGroups } from "./groups";
import { rowMeta, rowState } from "./wording";

const today = calendarDate("2026-03-10");

const people = [
  buildPerson({ id: "prs_amara", name: "Amara Osei", companyId: "cmp_halden" }),
  buildPerson({ id: "prs_jonas", name: "Jonas Berg", companyId: "cmp_halden" }),
];

function day(opportunities: Records["opportunities"], overrides: Partial<Records> = {}) {
  const records: Records = {
    companies: [buildCompany({ id: "cmp_halden", name: "Halden Robotics" })],
    people,
    opportunities,
    interactions: [],
    drafts: [],
    nextActions: [],
    facts: [],
    interpretations: [],
    ...overrides,
  };
  return {
    today,
    records,
    index: indexRecords(records, today, "Europe/London"),
    contexts: [],
  };
}

const opportunity = (overrides: Parameters<typeof buildOpportunity>[0]) =>
  buildOpportunity({ companyId: "cmp_halden", ...overrides });

const titles = (d: ReturnType<typeof day>) =>
  opportunityGroups(d).map((g) => [g.label, g.items.map((o) => o.title)]);

describe("Pursuing groups", () => {
  it("groups by timing: closing soon by deadline, then in progress by priority, then closed", () => {
    const d = day([
      opportunity({
        id: "opp_a",
        title: "Firmware internship",
        status: "researching",
        deadline: "2026-03-16",
      }),
      opportunity({
        id: "opp_b",
        title: "Graduate scheme",
        status: "identified",
        deadline: "2026-03-12",
      }),
      opportunity({ id: "opp_c", title: "Lab placement", status: "reaching_out", priority: "low" }),
      opportunity({ id: "opp_d", title: "Startup role", status: "interviewing", priority: "high" }),
      opportunity({ id: "opp_e", title: "Insight day", status: "closed", closedReason: "expired" }),
    ]);
    expect(titles(d)).toEqual([
      ["Closing soon", ["Graduate scheme", "Firmware internship"]],
      ["In progress", ["Startup role", "Lab placement"]],
      ["Closed", ["Insight day"]],
    ]);
  });

  it("only a live, pre-application deadline inside Today's window is closing soon", () => {
    const d = day([
      // Beyond the 7-day window.
      opportunity({
        id: "opp_a",
        title: "Later deadline",
        status: "researching",
        deadline: "2026-03-30",
      }),
      // Already applied: the deadline no longer asks anything of you.
      opportunity({ id: "opp_b", title: "Applied", status: "applied", deadline: "2026-03-12" }),
      // Passed.
      opportunity({ id: "opp_c", title: "Missed", status: "identified", deadline: "2026-03-01" }),
    ]);
    expect(titles(d)).toEqual([["In progress", ["Later deadline", "Applied", "Missed"]]]);
  });

  it("drops empty groups", () => {
    expect(titles(day([opportunity({ id: "opp_a", title: "Lab placement" })]))).toEqual([
      ["In progress", ["Lab placement"]],
    ]);
    expect(opportunityGroups(day([]))).toEqual([]);
  });

  it("a row reads company, stage and people, or how a closed one ended", () => {
    const open = opportunity({
      id: "opp_a",
      title: "Firmware internship",
      status: "reaching_out",
      personIds: ["prs_amara", "prs_jonas"],
    });
    const closed = opportunity({
      id: "opp_b",
      title: "Insight day",
      status: "closed",
      closedReason: "rejected",
      type: "internship",
      personIds: ["prs_amara"],
    });
    const d = day([open, closed]);
    expect(rowMeta(open, d)).toBe("Halden Robotics · Reaching out · 2 people");
    expect(rowState(open, d)).toBeUndefined();
    expect(rowMeta(closed, d)).toBe("Halden Robotics · Internship · 1 person");
    expect(rowState(closed, d)).toEqual({ text: "Rejected", tone: undefined });
  });

  it("activity: exchanges about it, its people's unattributed ones, and pending drafts", () => {
    const o = opportunity({ id: "opp_a", title: "Firmware internship", personIds: ["prs_amara"] });
    const d = day([o, opportunity({ id: "opp_b", title: "Other" })], {
      interactions: [
        buildInteraction({ id: "int_about", personId: "prs_jonas", opportunityId: "opp_a" }),
        buildInteraction({ id: "int_unattributed", personId: "prs_amara" }),
        buildInteraction({ id: "int_other", personId: "prs_amara", opportunityId: "opp_b" }),
        buildInteraction({ id: "int_stranger", personId: "prs_jonas" }),
      ],
      drafts: [
        buildDraft({ id: "drf_waiting", personId: "prs_amara", opportunityId: "opp_a" }),
        buildDraft({
          id: "drf_sent",
          personId: "prs_amara",
          opportunityId: "opp_a",
          status: "sent",
          approvedAt: "2026-03-01T09:00:00Z",
          sentAt: "2026-03-02T09:00:00Z",
          sentInteractionId: "int_about",
        }),
      ],
    });
    const { interactions, drafts } = activityOf(o, d);
    expect(interactions.map((i) => i.id)).toEqual(["int_about", "int_unattributed"]);
    expect(drafts.map((x) => x.id)).toEqual(["drf_waiting"]);
  });
});
