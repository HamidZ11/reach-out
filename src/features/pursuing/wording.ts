import { shortDay } from "@/components/dates";
import type {
  ClosedReason,
  Opportunity,
  OpportunityStatus,
  OpportunityType,
} from "@/domain/opportunity";
import type { CalendarDate } from "@/domain/time";
import { liveDeadline } from "@/features/today/date-tile";
import type { Tone } from "@/features/today/wording";
import type { ItemContext } from "@/features/workspace/records";
import { STAGE_LABEL } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import { contextFor } from "./groups";

/**
 * Pursuing's wording: what an opportunity is, where it stands and what it
 * needs from you, in words. Presentation only — stages, priority and deadlines
 * are the domain's (DOMAIN.md › Opportunity), and status comes from Today.
 */

type Day = Pick<WorkspaceState, "today" | "records" | "index" | "contexts">;

export const TYPE_LABEL: Record<OpportunityType, string> = {
  internship: "Internship",
  graduate_role: "Graduate role",
  startup_role: "Startup role",
  research: "Research",
  mentorship: "Mentorship",
  referral: "Referral",
  other: "Opportunity",
};

export const CLOSED_LABEL: Record<ClosedReason, string> = {
  accepted: "Accepted",
  declined: "You declined",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  no_response: "No response",
  expired: "Expired",
};

/** Where you are, as a sentence. */
export const STAGE_PHRASE: Record<OpportunityStatus, string> = {
  identified: "You've found it",
  researching: "You're researching it",
  reaching_out: "You're reaching out",
  applied: "You've applied",
  interviewing: "You're interviewing",
  offer: "You have an offer",
  closed: "Closed",
};

/** "no one yet", "1 person", "3 people" */
export function peopleCount(n: number): string {
  return n === 0 ? "no one yet" : n === 1 ? "1 person" : `${n} people`;
}

/** "Sat" from a date. */
const weekdayOf = (date: CalendarDate) => shortDay(date).split(" ")[0] ?? "";

/** What an item needs from you, in a word or two. */
export function itemState(ctx: ItemContext): { text: string; tone: Tone } {
  const { item } = ctx;
  switch (item.kind) {
    case "overdue_follow_up":
      return { text: "Overdue", tone: "late" };
    case "reply_awaiting_response":
      return { text: "Your turn", tone: "now" };
    case "deadline_approaching":
      return {
        text: item.daysRemaining === 0 ? "Closes today" : `Closes ${weekdayOf(item.deadline)}`,
        tone: item.daysRemaining <= 1 ? "late" : "now",
      };
    case "draft_awaiting_approval":
      return { text: "Draft", tone: "now" };
    case "draft_ready_to_send":
      return { text: "To send", tone: "good" };
    case "upcoming_action": {
      const d = item.daysUntilDue;
      return {
        text: d < 0 ? "Overdue" : d === 0 ? "Today" : d === 1 ? "Tomorrow" : weekdayOf(item.dueOn),
        tone: d < 0 ? "late" : undefined,
      };
    }
  }
}

/** A row's state: how a closed one ended, or what Today asks of an open one. */
export function rowState(o: Opportunity, day: Day): { text: string; tone: Tone } | undefined {
  if (o.status === "closed") {
    return { text: o.closedReason ? CLOSED_LABEL[o.closedReason] : "Closed", tone: undefined };
  }
  const ctx = contextFor(o, day);
  return ctx ? itemState(ctx) : undefined;
}

/** "Ledgerline · Reaching out · 3 people" */
export function rowMeta(o: Opportunity, day: Day): string {
  return [
    day.index.company(o.companyId)?.name,
    o.status === "closed" ? (o.type ? TYPE_LABEL[o.type] : undefined) : STAGE_LABEL[o.status],
    peopleCount(o.personIds.length),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "5 active · Ledgerline closes Sat 10 Oct" */
export function summary(day: Day): string {
  const active = day.records.opportunities.filter((o) => o.status !== "closed");
  const soonest = active
    .flatMap((o) => {
      const deadline = liveDeadline(o, day.today);
      return deadline ? [{ o, deadline }] : [];
    })
    .toSorted((a, b) => a.deadline.localeCompare(b.deadline))[0];
  const where = soonest && day.index.company(soonest.o.companyId)?.name;
  return [
    `${active.length} active`,
    soonest && `${where ?? soonest.o.title} closes ${shortDay(soonest.deadline)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
