import { delta } from "@/components/dates";
import { isPendingDraft } from "@/domain/draft";
import type { NextAction } from "@/domain/next-action";
import type { Opportunity } from "@/domain/opportunity";
import { priorityRank } from "@/domain/opportunity";
import { compareInstants } from "@/domain/time";
import { TODAY_RULES } from "@/domain/today";
import { liveDeadline } from "@/features/today/date-tile";
import type { ItemContext } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";

/**
 * How Pursuing arranges opportunities: by timing, never by funnel stage. This
 * is presentation over the records; the deadline window is Today's own rule.
 */

type Day = Pick<WorkspaceState, "today" | "records" | "index" | "contexts">;

export type OpportunityGroup = {
  key: "soon" | "progress" | "closed";
  label: string;
  items: Opportunity[];
};

/**
 * Closing soon: a live deadline inside Today's window, soonest first. In
 * progress: everything else still open, by priority, then deadline, then most
 * recently touched. Closed: last, and collapsed where it is shown.
 */
export function opportunityGroups(day: Day): OpportunityGroup[] {
  const { today } = day;
  const all = day.records.opportunities;
  const soon = all
    .filter((o) => {
      const deadline = liveDeadline(o, today);
      return deadline !== undefined && delta(today, deadline) <= TODAY_RULES.deadlineWindowDays;
    })
    .toSorted((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
  const rest = all
    .filter((o) => o.status !== "closed" && !soon.includes(o))
    .toSorted(
      (a, b) =>
        priorityRank(a) - priorityRank(b) ||
        (liveDeadline(a, today) ?? "9999").localeCompare(liveDeadline(b, today) ?? "9999") ||
        compareInstants(b.updatedAt, a.updatedAt),
    );
  const closed = all.filter((o) => o.status === "closed");
  const groups: OpportunityGroup[] = [
    { key: "soon", label: "Closing soon", items: soon },
    { key: "progress", label: "In progress", items: rest },
    { key: "closed", label: "Closed", items: closed },
  ];
  return groups.filter((g) => g.items.length > 0);
}

/** The first thing Today asks of you about this opportunity, if anything. */
export function contextFor(o: Opportunity, day: Pick<Day, "contexts">): ItemContext | undefined {
  return day.contexts.find((c) => c.opportunity?.id === o.id);
}

/** Open next actions for an opportunity, soonest first. */
export function openActionsOf(o: Opportunity, day: Pick<Day, "records">): NextAction[] {
  return day.records.nextActions
    .filter((a) => a.status === "open" && a.opportunityId === o.id)
    .toSorted((a, b) => a.dueOn.localeCompare(b.dueOn));
}

/**
 * What has happened on an opportunity, across everyone involved: exchanges
 * about it, exchanges with its people that name no opportunity, and drafts
 * for it that are still waiting to be approved or sent.
 */
export function activityOf(o: Opportunity, day: Pick<Day, "records">) {
  return {
    interactions: day.records.interactions.filter(
      (i) => i.opportunityId === o.id || (!i.opportunityId && o.personIds.includes(i.personId)),
    ),
    drafts: day.records.drafts.filter((d) => d.opportunityId === o.id && isPendingDraft(d)),
  };
}
