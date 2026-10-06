import type { Draft } from "@/domain/draft";
import type { DomainErrorCode } from "@/domain/errors";
import type { DraftId, InteractionId, NextActionId, OpportunityId, PersonId } from "@/domain/ids";
import type { Interaction } from "@/domain/interaction";
import type { NextAction } from "@/domain/next-action";
import type { Person } from "@/domain/person";
import type { Instant } from "@/domain/time";

/**
 * What the screens can ask to change, and what comes back. Production passes
 * Server Actions (src/app), which persist through the Repository; tests and
 * the design references pass `createLocalActions`, which keeps records in
 * memory. Screens can't tell which they have, and never claim success before
 * the answer arrives.
 */
export type WorkspaceActions = {
  completeNextAction(input: { id: NextActionId; expected: Instant }): Promise<Outcome>;
  snoozeNextAction(input: { id: NextActionId; days: number; expected: Instant }): Promise<Outcome>;
  createDraft(input: DraftInput): Promise<Outcome>;
  approveDraft(input: { id: DraftId; expected: Instant }): Promise<Outcome>;
  reviseDraft(input: { id: DraftId; body: string; expected: Instant }): Promise<Outcome>;
  markDraftSent(input: { id: DraftId; expected: Instant }): Promise<Outcome>;
  undo(input: { step: string }): Promise<Outcome>;
};

export type DraftInput = {
  personId: PersonId;
  opportunityId?: OpportunityId;
  channel: Draft["channel"];
  subject?: string;
  body: string;
};

/** The records a change touched, as they now are, and those it removed. */
export type Changes = {
  people?: Person[];
  nextActions?: NextAction[];
  drafts?: Draft[];
  interactions?: Interaction[];
  removed?: { drafts?: DraftId[]; interactions?: InteractionId[] };
};

export type Problem =
  | DomainErrorCode
  | "not_found"
  | "conflict"
  | "onboarding_complete"
  | "undo_unavailable"
  | "invalid"
  | "unavailable";

export type Outcome =
  { ok: true; changes: Changes; undo?: string } | { ok: false; problem: Problem };

/** What to say when a change didn't happen. Calm, specific, never blaming. */
export function problemMessage(problem: Problem): string {
  switch (problem) {
    case "conflict":
      return "That changed somewhere else. Reload to see the latest.";
    case "not_found":
      return "That isn't here any more. Reload to see the latest.";
    case "undo_unavailable":
      return "That can't be undone any more.";
    case "draft_not_approved":
      return "Approve it before marking it as sent.";
    case "draft_not_awaiting_approval":
      return "That draft isn't waiting for approval any more.";
    case "draft_not_editable":
      return "That message has been sent, so it can't be changed.";
    case "email_subject_required":
      return "Add a subject before approving an email.";
    case "next_action_not_open":
      return "That step is already finished.";
    case "due_date_in_past":
    case "invalid_snooze":
      return "That date isn't available. Choose another.";
    case "onboarding_complete":
      return "You're already set up.";
    case "invalid":
      return "Something in that wasn't valid. Check it and try again.";
    case "unavailable":
      return "Couldn't save. Check your connection and try again.";
  }
}
