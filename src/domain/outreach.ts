import type { Draft } from "./draft";
import { isPendingDraft } from "./draft";
import type { PersonId } from "./ids";
import type { Exchange, Interaction } from "./interaction";
import { isExchange } from "./interaction";
import type { NextAction } from "./next-action";
import type { Person } from "./person";
import type { CalendarDate } from "./time";
import { compareInstants } from "./time";

/**
 * Where outreach to a person currently stands. Derived, never stored, from
 * interactions, drafts, next actions and the person's closure marker.
 *
 * - not_started: no exchange and nothing drafted
 * - draft: a message is drafted (awaiting approval or approved) but not sent
 * - sent: the user's message is the latest exchange; no follow-up due yet
 * - follow_up_due: as sent, and an open follow-up is due today or earlier
 * - replied: the person's message, or a meeting, is the latest exchange
 * - closed: the user closed outreach and nothing has happened since
 */
export const OUTREACH_STATES = [
  "not_started",
  "draft",
  "sent",
  "follow_up_due",
  "replied",
  "closed",
] as const;
export type OutreachState = (typeof OUTREACH_STATES)[number];

export function latestExchange(
  personId: PersonId,
  interactions: readonly Interaction[],
): Exchange | undefined {
  let latest: Exchange | undefined;
  for (const interaction of interactions) {
    if (interaction.personId !== personId || !isExchange(interaction)) continue;
    if (!latest || compareInstants(interaction.occurredAt, latest.occurredAt) > 0) {
      latest = interaction;
    }
  }
  return latest;
}

/** Closed until something newer happens: an exchange, or a draft written after closing. */
export function isOutreachClosed(
  person: Person,
  latest: Exchange | undefined,
  pendingDrafts: readonly Draft[],
): boolean {
  const closure = person.outreachClosure;
  if (!closure) return false;
  const reopenedByExchange =
    latest !== undefined && compareInstants(latest.occurredAt, closure.closedAt) > 0;
  const reopenedByDraft = pendingDrafts.some(
    (draft) => compareInstants(draft.updatedAt, closure.closedAt) > 0,
  );
  return !reopenedByExchange && !reopenedByDraft;
}

export function deriveOutreachState(input: {
  person: Person;
  interactions: readonly Interaction[];
  drafts: readonly Draft[];
  nextActions: readonly NextAction[];
  today: CalendarDate;
}): OutreachState {
  const { person, today } = input;
  const latest = latestExchange(person.id, input.interactions);
  const pending = input.drafts.filter(
    (draft) => draft.personId === person.id && isPendingDraft(draft),
  );

  if (isOutreachClosed(person, latest, pending)) return "closed";
  if (latest && latest.kind !== "message_sent") return "replied";
  if (pending.length > 0) return "draft";
  if (!latest) return "not_started";

  const followUpDue = input.nextActions.some(
    (action) =>
      action.status === "open" &&
      action.kind === "follow_up" &&
      action.personId === person.id &&
      action.dueOn <= today,
  );
  return followUpDue ? "follow_up_due" : "sent";
}
