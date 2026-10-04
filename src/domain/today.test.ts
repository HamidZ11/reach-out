import { describe, expect, it } from "vitest";
import {
  buildDraft,
  buildInteraction,
  buildNextAction,
  buildOpportunity,
  buildPerson,
} from "@/test/builders";
import { calendarDate } from "./time";
import type { TodayInput, TodayItem } from "./today";
import { deriveToday, TODAY_RULES } from "./today";

const TODAY = calendarDate("2026-03-10");

function input(overrides: Partial<Omit<TodayInput, "today">> = {}): TodayInput {
  return {
    today: TODAY,
    people: [],
    opportunities: [],
    interactions: [],
    drafts: [],
    nextActions: [],
    ...overrides,
  };
}

const kinds = (items: TodayItem[]) => items.map((item) => item.kind);

describe("deriveToday", () => {
  it("is empty when there is nothing to attend to", () => {
    expect(deriveToday(input())).toEqual([]);
  });

  describe("follow-ups", () => {
    it("ranks an overdue follow-up first; one due today is merely upcoming", () => {
      const items = deriveToday(
        input({
          people: [buildPerson({ id: "prs_a" }), buildPerson({ id: "prs_b" })],
          nextActions: [
            buildNextAction({ id: "act_today", personId: "prs_a", dueOn: "2026-03-10" }),
            buildNextAction({ id: "act_late", personId: "prs_b", dueOn: "2026-03-07" }),
          ],
        }),
      );
      expect(items).toEqual([
        expect.objectContaining({
          kind: "overdue_follow_up",
          nextActionId: "act_late",
          daysOverdue: 3,
        }),
        expect.objectContaining({
          kind: "upcoming_action",
          nextActionId: "act_today",
          daysUntilDue: 0,
        }),
      ]);
    });

    it("hides a follow-up once the person has replied", () => {
      const items = deriveToday(
        input({
          people: [buildPerson()],
          interactions: [
            buildInteraction({ id: "int_out", occurredAt: "2026-03-01T09:00:00Z" }),
            buildInteraction({
              id: "int_in",
              kind: "message_received",
              occurredAt: "2026-03-09T09:00:00Z",
            }),
          ],
          nextActions: [buildNextAction({ dueOn: "2026-03-05" })],
        }),
      );
      expect(kinds(items)).toEqual(["reply_awaiting_response"]);
    });

    it("hides a follow-up when outreach to the person is closed", () => {
      const items = deriveToday(
        input({
          people: [
            buildPerson({
              outreachClosure: { closedAt: "2026-03-08T09:00:00Z", reason: "no_response" },
            }),
          ],
          interactions: [buildInteraction({ occurredAt: "2026-03-01T09:00:00Z" })],
          nextActions: [buildNextAction({ dueOn: "2026-03-05" })],
        }),
      );
      expect(items).toEqual([]);
    });
  });

  describe("replies", () => {
    const person = buildPerson();
    const received = buildInteraction({
      id: "int_in",
      kind: "message_received",
      occurredAt: "2026-03-08T12:00:00Z",
    });

    it("surfaces a reply when the person's message is the latest exchange", () => {
      expect(deriveToday(input({ people: [person], interactions: [received] }))).toEqual([
        expect.objectContaining({ kind: "reply_awaiting_response", interactionId: "int_in" }),
      ]);
    });

    it("drops it once the user has responded", () => {
      const response = buildInteraction({ id: "int_out", occurredAt: "2026-03-09T08:00:00Z" });
      expect(deriveToday(input({ people: [person], interactions: [received, response] }))).toEqual(
        [],
      );
    });

    it("does not treat a later meeting or note as needing a response", () => {
      const meeting = buildInteraction({
        id: "int_meet",
        kind: "meeting",
        format: "video",
        occurredAt: "2026-03-09T08:00:00Z",
      });
      expect(deriveToday(input({ people: [person], interactions: [received, meeting] }))).toEqual(
        [],
      );
      const note = buildInteraction({
        id: "int_note",
        kind: "note",
        occurredAt: "2026-03-09T08:00:00Z",
      });
      expect(
        kinds(deriveToday(input({ people: [person], interactions: [received, note] }))),
      ).toEqual(["reply_awaiting_response"]);
    });
  });

  describe("deadlines", () => {
    const window = TODAY_RULES.deadlineWindowDays;

    it(`shows pre-application deadlines from today to ${window} days ahead`, () => {
      const items = deriveToday(
        input({
          opportunities: [
            buildOpportunity({ id: "opp_today", deadline: "2026-03-10", status: "identified" }),
            buildOpportunity({ id: "opp_edge", deadline: "2026-03-17", status: "researching" }),
            buildOpportunity({ id: "opp_far", deadline: "2026-03-18", status: "reaching_out" }),
            buildOpportunity({ id: "opp_past", deadline: "2026-03-09", status: "reaching_out" }),
          ],
        }),
      );
      expect(items).toEqual([
        expect.objectContaining({ opportunityId: "opp_today", daysRemaining: 0 }),
        expect.objectContaining({ opportunityId: "opp_edge", daysRemaining: window }),
      ]);
    });

    it("ignores deadlines once the user has applied or the opportunity is closed", () => {
      const items = deriveToday(
        input({
          opportunities: [
            buildOpportunity({ id: "opp_applied", deadline: "2026-03-12", status: "applied" }),
            buildOpportunity({
              id: "opp_closed",
              deadline: "2026-03-12",
              status: "closed",
              closedReason: "withdrawn",
            }),
          ],
        }),
      );
      expect(items).toEqual([]);
    });

    it("breaks same-day deadlines by priority", () => {
      const items = deriveToday(
        input({
          opportunities: [
            buildOpportunity({ id: "opp_low", deadline: "2026-03-12", priority: "low" }),
            buildOpportunity({ id: "opp_high", deadline: "2026-03-12", priority: "high" }),
            buildOpportunity({ id: "opp_unset", deadline: "2026-03-12" }),
          ],
        }),
      );
      expect(
        items.map((i) => (i.kind === "deadline_approaching" ? i.opportunityId : null)),
      ).toEqual(["opp_high", "opp_unset", "opp_low"]);
    });
  });

  describe("drafts", () => {
    it("lists drafts awaiting approval before approved ones, and ignores sent or discarded drafts", () => {
      const items = deriveToday(
        input({
          drafts: [
            buildDraft({
              id: "drf_approved",
              status: "approved",
              approvedAt: "2026-03-01T09:00:00Z",
            }),
            buildDraft({ id: "drf_awaiting" }),
            buildDraft({
              id: "drf_sent",
              status: "sent",
              approvedAt: "2026-03-01T09:00:00Z",
              sentAt: "2026-03-01T10:00:00Z",
              sentInteractionId: "int_test",
            }),
            buildDraft({
              id: "drf_discarded",
              status: "discarded",
              discardedAt: "2026-03-01T09:00:00Z",
            }),
          ],
        }),
      );
      expect(items).toEqual([
        expect.objectContaining({ kind: "draft_awaiting_approval", draftId: "drf_awaiting" }),
        expect.objectContaining({ kind: "draft_ready_to_send", draftId: "drf_approved" }),
      ]);
    });
  });

  describe("upcoming actions", () => {
    const window = TODAY_RULES.upcomingWindowDays;

    it(`includes open actions up to ${window} days ahead, and overdue non-follow-ups`, () => {
      const items = deriveToday(
        input({
          nextActions: [
            buildNextAction({
              id: "act_edge",
              kind: "apply",
              opportunityId: "opp_test",
              dueOn: "2026-03-13",
            }),
            buildNextAction({
              id: "act_far",
              kind: "apply",
              opportunityId: "opp_test",
              dueOn: "2026-03-14",
            }),
            buildNextAction({ id: "act_late", kind: "prepare", dueOn: "2026-03-01" }),
            buildNextAction({
              id: "act_done",
              dueOn: "2026-03-10",
              status: "done",
              completedAt: "2026-03-10T08:00:00Z",
            }),
          ],
        }),
      );
      expect(items).toEqual([
        expect.objectContaining({
          kind: "upcoming_action",
          nextActionId: "act_late",
          daysUntilDue: -9,
        }),
        expect.objectContaining({
          kind: "upcoming_action",
          nextActionId: "act_edge",
          daysUntilDue: window,
        }),
      ]);
    });

    it("shows the soonest later action when Today would otherwise be empty", () => {
      const items = deriveToday(
        input({
          nextActions: [
            buildNextAction({ id: "act_later", kind: "research", dueOn: "2026-03-30" }),
            buildNextAction({ id: "act_soonest", kind: "research", dueOn: "2026-03-20" }),
          ],
        }),
      );
      expect(items).toEqual([
        expect.objectContaining({ nextActionId: "act_soonest", daysUntilDue: 10 }),
      ]);
    });

    it("does not fall back when anything else needs attention", () => {
      const items = deriveToday(
        input({
          drafts: [buildDraft()],
          nextActions: [buildNextAction({ kind: "research", dueOn: "2026-03-30" })],
        }),
      );
      expect(kinds(items)).toEqual(["draft_awaiting_approval"]);
    });
  });

  it("orders by tier and is independent of input order", () => {
    const records = input({
      people: [buildPerson({ id: "prs_a" }), buildPerson({ id: "prs_b" })],
      opportunities: [buildOpportunity({ deadline: "2026-03-12" })],
      interactions: [
        buildInteraction({ id: "int_in", personId: "prs_a", kind: "message_received" }),
      ],
      drafts: [buildDraft({ personId: "prs_b" })],
      nextActions: [
        buildNextAction({ id: "act_follow", personId: "prs_b", dueOn: "2026-03-01" }),
        buildNextAction({
          id: "act_prep",
          kind: "prepare",
          personId: "prs_b",
          dueOn: "2026-03-11",
        }),
      ],
    });
    const reversed: TodayInput = {
      ...records,
      people: records.people.toReversed(),
      opportunities: records.opportunities.toReversed(),
      interactions: records.interactions.toReversed(),
      drafts: records.drafts.toReversed(),
      nextActions: records.nextActions.toReversed(),
    };

    const items = deriveToday(records);
    expect(items.map((i) => i.tier)).toEqual([1, 2, 3, 4, 5]);
    expect(deriveToday(reversed)).toEqual(items);
  });
});
