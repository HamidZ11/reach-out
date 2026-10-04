import type { Draft } from "./draft";
import { isPendingDraft } from "./draft";
import type { DraftId, InteractionId, NextActionId, OpportunityId, PersonId } from "./ids";
import type { Interaction } from "./interaction";
import type { NextAction, OpenNextAction } from "./next-action";
import type { Opportunity } from "./opportunity";
import { isPreApplication, priorityRank } from "./opportunity";
import { isOutreachClosed, latestExchange } from "./outreach";
import type { Person } from "./person";
import type { CalendarDate, Instant } from "./time";
import { daysBetween } from "./time";

/**
 * Today answers "what needs my attention today?". It is derived from domain
 * records on every read; nothing about Today is stored.
 *
 * Tiers, highest first (see DOMAIN.md for the full rules):
 *   1. overdue follow-up
 *   2. reply awaiting the user's response
 *   3. opportunity deadline within the window (pre-application only)
 *   4. draft awaiting approval, then approved draft not yet sent
 *   5. other open next actions due within the window (including overdue ones)
 *
 * Generated interpretations are not an input: Today rests on facts only.
 */
export const TODAY_RULES = {
  /** Deadlines from today up to this many days ahead are shown. */
  deadlineWindowDays: 7,
  /** Open next actions due up to this many days ahead are shown. */
  upcomingWindowDays: 3,
} as const;

export type TodayItem =
  | {
      kind: "overdue_follow_up";
      tier: 1;
      nextActionId: NextActionId;
      personId: PersonId;
      opportunityId?: OpportunityId;
      dueOn: CalendarDate;
      daysOverdue: number;
    }
  | {
      kind: "reply_awaiting_response";
      tier: 2;
      personId: PersonId;
      interactionId: InteractionId;
      opportunityId?: OpportunityId;
      receivedAt: Instant;
    }
  | {
      kind: "deadline_approaching";
      tier: 3;
      opportunityId: OpportunityId;
      deadline: CalendarDate;
      daysRemaining: number;
    }
  | {
      kind: "draft_awaiting_approval" | "draft_ready_to_send";
      tier: 4;
      draftId: DraftId;
      personId: PersonId;
      opportunityId?: OpportunityId;
    }
  | {
      kind: "upcoming_action";
      tier: 5;
      nextActionId: NextActionId;
      personId?: PersonId;
      opportunityId?: OpportunityId;
      dueOn: CalendarDate;
      daysUntilDue: number;
    };

export type TodayInput = {
  today: CalendarDate;
  people: readonly Person[];
  opportunities: readonly Opportunity[];
  interactions: readonly Interaction[];
  drafts: readonly Draft[];
  nextActions: readonly NextAction[];
};

type SortKey = readonly (string | number)[];
type Ranked = { item: TodayItem; key: SortKey };

export function deriveToday(input: TodayInput): TodayItem[] {
  const { today } = input;
  const ranked: Ranked[] = [];

  // Tier 2, and the per-person facts that suppress follow-ups.
  const awaitingResponse = new Set<PersonId>();
  const closed = new Set<PersonId>();
  for (const person of input.people) {
    const latest = latestExchange(person.id, input.interactions);
    const pending = input.drafts.filter((d) => d.personId === person.id && isPendingDraft(d));
    if (isOutreachClosed(person, latest, pending)) {
      closed.add(person.id);
    } else if (latest?.kind === "message_received") {
      awaitingResponse.add(person.id);
      ranked.push({
        item: {
          kind: "reply_awaiting_response",
          tier: 2,
          personId: person.id,
          interactionId: latest.id,
          opportunityId: latest.opportunityId,
          receivedAt: latest.occurredAt,
        },
        // Longest-waiting reply first.
        key: [2, Date.parse(latest.occurredAt), person.id],
      });
    }
  }

  // Tiers 1 and 5.
  const later: OpenNextAction[] = [];
  for (const action of input.nextActions) {
    if (action.status !== "open") continue;
    const followUpWith = action.kind === "follow_up" ? action.personId : undefined;
    // A reply supersedes a follow-up; a closed outreach needs none.
    if (
      followUpWith !== undefined &&
      (awaitingResponse.has(followUpWith) || closed.has(followUpWith))
    ) {
      continue;
    }
    const days = daysBetween(today, action.dueOn);
    if (followUpWith !== undefined && days < 0) {
      ranked.push({
        item: {
          kind: "overdue_follow_up",
          tier: 1,
          nextActionId: action.id,
          personId: followUpWith,
          opportunityId: action.opportunityId,
          dueOn: action.dueOn,
          daysOverdue: -days,
        },
        key: [1, action.dueOn, action.id],
      });
    } else if (days <= TODAY_RULES.upcomingWindowDays) {
      ranked.push({ item: upcoming(action, days), key: [5, action.dueOn, action.id] });
    } else {
      later.push(action);
    }
  }

  // Tier 3.
  for (const opportunity of input.opportunities) {
    if (!isPreApplication(opportunity) || opportunity.deadline === undefined) continue;
    const days = daysBetween(today, opportunity.deadline);
    if (days < 0 || days > TODAY_RULES.deadlineWindowDays) continue;
    ranked.push({
      item: {
        kind: "deadline_approaching",
        tier: 3,
        opportunityId: opportunity.id,
        deadline: opportunity.deadline,
        daysRemaining: days,
      },
      key: [3, opportunity.deadline, priorityRank(opportunity), opportunity.id],
    });
  }

  // Tier 4: review before send, oldest first.
  for (const draft of input.drafts) {
    if (draft.status !== "awaiting_approval" && draft.status !== "approved") continue;
    const awaiting = draft.status === "awaiting_approval";
    ranked.push({
      item: {
        kind: awaiting ? "draft_awaiting_approval" : "draft_ready_to_send",
        tier: 4,
        draftId: draft.id,
        personId: draft.personId,
        opportunityId: draft.opportunityId,
      },
      key: [4, awaiting ? 0 : 1, Date.parse(draft.updatedAt), draft.id],
    });
  }

  // Never leave Today empty while an open next action exists.
  if (ranked.length === 0) {
    const soonest = later.toSorted((a, b) => compareKeys([a.dueOn, a.id], [b.dueOn, b.id]))[0];
    if (soonest) {
      ranked.push({
        item: upcoming(soonest, daysBetween(today, soonest.dueOn)),
        key: [5, soonest.dueOn, soonest.id],
      });
    }
  }

  return ranked.toSorted((a, b) => compareKeys(a.key, b.key)).map((r) => r.item);
}

function upcoming(action: OpenNextAction, daysUntilDue: number): TodayItem {
  return {
    kind: "upcoming_action",
    tier: 5,
    nextActionId: action.id,
    personId: action.personId,
    opportunityId: action.opportunityId,
    dueOn: action.dueOn,
    daysUntilDue,
  };
}

function compareKeys(a: SortKey, b: SortKey): number {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined || y === undefined || x === y) continue;
    return x < y ? -1 : 1;
  }
  return a.length - b.length;
}
