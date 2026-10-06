import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { calendarDate, instant } from "@/domain/time";
import type { Workspace } from "@/features/workspace/records";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { READ_ONLY_ACTIONS } from "@/test/actions";
import {
  buildDraft,
  buildInteraction,
  buildNextAction,
  buildPerson,
  buildUser,
} from "@/test/builders";
import type { TrackKey } from "./tracks";
import { tracksOf } from "./tracks";

/** Each person's group, from the domain's outreach state over these records. */
function groups(records: Partial<Workspace>) {
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
  const { result } = renderHook(() => useWorkspace(workspace, READ_ONLY_ACTIONS));
  const tracks = tracksOf(result.current);
  return Object.fromEntries(
    (Object.entries(tracks) as [TrackKey, { person: { name: string } }[]][])
      .filter(([, list]) => list.length > 0)
      .map(([key, list]) => [key, list.map((tr) => tr.person.name)]),
  );
}

const nia = buildPerson({ id: "prs_nia", name: "Nia Campbell", relationshipStatus: "contacted" });
const omar = buildPerson({ id: "prs_omar", name: "Omar Haddad", relationshipStatus: "replied" });
const lena = buildPerson({ id: "prs_lena", name: "Lena Vogt" });
const theo = buildPerson({ id: "prs_theo", name: "Theo Grant", relationshipStatus: "dormant" });

describe("Outreach tracks", () => {
  it("groups each person by the domain's outreach state", () => {
    expect(
      groups({
        people: [nia, omar, lena, theo],
        interactions: [
          buildInteraction({
            id: "int_nia",
            personId: "prs_nia",
            occurredAt: "2026-03-02T10:00:00Z",
          }),
          // A meeting was the latest exchange: in conversation, nothing to write.
          buildInteraction({
            id: "int_omar_sent",
            personId: "prs_omar",
            occurredAt: "2026-03-01T10:00:00Z",
          }),
          buildInteraction({
            id: "int_omar_met",
            personId: "prs_omar",
            kind: "meeting",
            format: "video",
            occurredAt: "2026-03-08T10:00:00Z",
          }),
        ],
        drafts: [buildDraft({ id: "drf_lena", personId: "prs_lena" })],
      }),
    ).toEqual({
      approve: ["Lena Vogt"],
      conversation: ["Omar Haddad"],
      waiting: ["Nia Campbell"],
      quiet: ["Theo Grant"],
    });
  });

  it("a follow-up that falls due moves the person up to To write", () => {
    expect(
      groups({
        people: [nia],
        interactions: [
          buildInteraction({
            id: "int_nia",
            personId: "prs_nia",
            occurredAt: "2026-03-02T10:00:00Z",
          }),
        ],
        nextActions: [
          buildNextAction({
            id: "act_nia",
            personId: "prs_nia",
            kind: "follow_up",
            dueOn: "2026-03-09",
          }),
        ],
      }),
    ).toEqual({ write: ["Nia Campbell"] });
  });

  it("an approved draft is ready to send; a planned first message is To write", () => {
    expect(
      groups({
        people: [lena, theo],
        drafts: [
          buildDraft({
            id: "drf_lena",
            personId: "prs_lena",
            status: "approved",
            approvedAt: "2026-03-09T10:00:00Z",
          }),
        ],
        nextActions: [
          buildNextAction({
            id: "act_theo",
            personId: "prs_theo",
            kind: "reach_out",
            dueOn: "2026-03-11",
          }),
        ],
      }),
    ).toEqual({ send: ["Lena Vogt"], write: ["Theo Grant"] });
  });
});
