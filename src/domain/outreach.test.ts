import { describe, expect, it } from "vitest";
import { buildDraft, buildInteraction, buildNextAction, buildPerson } from "@/test/builders";
import type { Draft } from "./draft";
import type { Interaction } from "./interaction";
import type { NextAction } from "./next-action";
import { deriveOutreachState } from "./outreach";
import type { Person } from "./person";
import { calendarDate } from "./time";

const TODAY = calendarDate("2026-03-10");

function stateOf({
  person = buildPerson(),
  interactions = [],
  drafts = [],
  nextActions = [],
}: {
  person?: Person;
  interactions?: Interaction[];
  drafts?: Draft[];
  nextActions?: NextAction[];
}) {
  return deriveOutreachState({ person, interactions, drafts, nextActions, today: TODAY });
}

const sent = buildInteraction({ id: "int_sent", occurredAt: "2026-03-01T09:00:00Z" });
const received = buildInteraction({
  id: "int_received",
  kind: "message_received",
  occurredAt: "2026-03-03T09:00:00Z",
});

describe("deriveOutreachState", () => {
  it("is not started with no exchanges and nothing drafted", () => {
    expect(stateOf({})).toBe("not_started");
  });

  it("is draft while a message is drafted but unsent", () => {
    expect(stateOf({ drafts: [buildDraft()] })).toBe("draft");
  });

  it("is sent, then follow-up due once an open follow-up falls due", () => {
    const followUp = (dueOn: string) => buildNextAction({ dueOn });
    expect(stateOf({ interactions: [sent], nextActions: [followUp("2026-03-11")] })).toBe("sent");
    expect(stateOf({ interactions: [sent], nextActions: [followUp("2026-03-10")] })).toBe(
      "follow_up_due",
    );
  });

  it("is replied when the person's message or a meeting is the latest exchange", () => {
    expect(stateOf({ interactions: [sent, received], drafts: [buildDraft()] })).toBe("replied");
    const meeting = buildInteraction({
      id: "int_meeting",
      kind: "meeting",
      format: "in_person",
      occurredAt: "2026-03-04T09:00:00Z",
    });
    expect(stateOf({ interactions: [sent, meeting] })).toBe("replied");
  });

  it("ignores notes when deciding who spoke last", () => {
    const note = buildInteraction({
      id: "int_note",
      kind: "note",
      occurredAt: "2026-03-05T09:00:00Z",
    });
    expect(stateOf({ interactions: [sent, note] })).toBe("sent");
  });

  it("is closed after the user closes it, until something newer happens", () => {
    const person = buildPerson({
      outreachClosure: { closedAt: "2026-03-05T09:00:00Z", reason: "no_response" },
    });
    expect(stateOf({ person, interactions: [sent] })).toBe("closed");

    const lateReply = buildInteraction({
      id: "int_late",
      kind: "message_received",
      occurredAt: "2026-03-08T09:00:00Z",
    });
    expect(stateOf({ person, interactions: [sent, lateReply] })).toBe("replied");

    const newDraft = buildDraft({ updatedAt: "2026-03-09T09:00:00Z" });
    expect(stateOf({ person, interactions: [sent], drafts: [newDraft] })).toBe("draft");
  });
});
