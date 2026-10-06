import { z } from "zod";
import type { Repository, UndoStep } from "@/data/repository";
import { RepositoryError } from "@/data/repository";
import { MessageChannelSchema } from "@/domain/channels";
import {
  approveDraft,
  AwaitingApprovalDraftSchema,
  markDraftSent,
  reviseDraft,
} from "@/domain/draft";
import { DomainError } from "@/domain/errors";
import {
  DraftIdSchema,
  NextActionIdSchema,
  OpportunityIdSchema,
  PersonIdSchema,
} from "@/domain/ids";
import { MessageSentSchema } from "@/domain/interaction";
import { completeNextAction, snoozeNextAction } from "@/domain/next-action";
import { relationshipStatusAfter } from "@/domain/person";
import type { Instant } from "@/domain/time";
import { calendarDateIn, instant, InstantSchema } from "@/domain/time";
import type { Changes, Outcome } from "./outcome";

/**
 * The workflow steps behind Today, People, Pursuing and Outreach: read the
 * record, apply the domain rule, persist the result through the Repository.
 * Server Actions call these with the signed-in user's repository; the local
 * actions call them with an in-memory one. The rules live in src/domain; the
 * repository re-checks ownership, version and transition as it writes.
 *
 * Inputs come from the browser, so each has a schema the caller parses first.
 */

export const CompleteInput = z.object({ id: NextActionIdSchema, expected: InstantSchema });
export const SnoozeInput = z.object({
  id: NextActionIdSchema,
  days: z.int().min(1).max(30),
  expected: InstantSchema,
});
export const DraftCreateInput = z.object({
  personId: PersonIdSchema,
  opportunityId: OpportunityIdSchema.optional(),
  channel: MessageChannelSchema,
  subject: z.string().max(300).optional(),
  body: z.string().trim().min(1).max(20_000),
});
export const DraftReferenceInput = z.object({ id: DraftIdSchema, expected: InstantSchema });
export const DraftReviseInput = DraftReferenceInput.extend({
  body: z.string().trim().min(1).max(20_000),
});
export const UndoInput = z.object({ step: z.string().min(1).max(100) });

const at = (now: Date): Instant => instant(now.toISOString());

/** Runs one step and answers with what changed, or why nothing did. */
async function attempt(
  run: () => Promise<{ changes: Changes; undo?: UndoStep }>,
): Promise<Outcome> {
  try {
    const { changes, undo } = await run();
    return { ok: true, changes, undo };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, problem: error.code };
    if (error instanceof RepositoryError) {
      // A lapsed session is the caller's to handle (it sends you to sign in).
      if (error.code === "unauthenticated") throw error;
      return { ok: false, problem: error.code };
    }
    console.error("A workspace change failed", error);
    return { ok: false, problem: "unavailable" };
  }
}

/** A message's first line of text, as its summary in history. */
function firstLine(body: string): string {
  return (
    body
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? body.trim()
  );
}

function found<T>(record: T | null): T {
  if (record === null) throw new RepositoryError("not_found");
  return record;
}

export function completeNextActionStep(
  repository: Repository,
  input: z.infer<typeof CompleteInput>,
  now: Date,
): Promise<Outcome> {
  return attempt(async () => {
    const action = found(await repository.nextActions.get(input.id));
    const { nextAction, undo } = await repository.nextActions.complete(
      completeNextAction(action, at(now)),
      input.expected,
    );
    return { changes: { nextActions: [nextAction] }, undo };
  });
}

export function snoozeNextActionStep(
  repository: Repository,
  input: z.infer<typeof SnoozeInput>,
  now: Date,
): Promise<Outcome> {
  return attempt(async () => {
    const [action, user] = await Promise.all([
      repository.nextActions.get(input.id).then(found),
      repository.user.get(),
    ]);
    const today = calendarDateIn(now, user.timeZone);
    const { nextAction, undo } = await repository.nextActions.reschedule(
      snoozeNextAction(action, input.days, today, at(now)),
      input.expected,
    );
    return { changes: { nextActions: [nextAction] }, undo };
  });
}

export function createDraftStep(
  repository: Repository,
  input: z.infer<typeof DraftCreateInput>,
  now: Date,
  newId: () => string = () => crypto.randomUUID(),
): Promise<Outcome> {
  return attempt(async () => {
    const draft = AwaitingApprovalDraftSchema.parse({
      id: newId(),
      userId: repository.userId,
      personId: input.personId,
      opportunityId: input.opportunityId,
      channel: input.channel,
      subject: input.subject?.trim() || undefined,
      body: input.body,
      origin: "user",
      status: "awaiting_approval",
      createdAt: at(now),
      updatedAt: at(now),
    });
    const created = await repository.drafts.create(draft);
    return { changes: { drafts: [created.draft] }, undo: created.undo };
  });
}

export function approveDraftStep(
  repository: Repository,
  input: z.infer<typeof DraftReferenceInput>,
  now: Date,
): Promise<Outcome> {
  return attempt(async () => {
    const draft = found(await repository.drafts.get(input.id));
    const approved = await repository.drafts.approve(approveDraft(draft, at(now)), input.expected);
    return { changes: { drafts: [approved.draft] }, undo: approved.undo };
  });
}

export function reviseDraftStep(
  repository: Repository,
  input: z.infer<typeof DraftReviseInput>,
  now: Date,
): Promise<Outcome> {
  return attempt(async () => {
    const draft = found(await repository.drafts.get(input.id));
    const revised = await repository.drafts.revise(
      reviseDraft(draft, { body: input.body }, at(now)),
      input.expected,
    );
    return { changes: { drafts: [revised.draft] }, undo: revised.undo };
  });
}

/**
 * The user sent an approved draft from their own email or LinkedIn. Records
 * the message_sent it became and moves the relationship forward. Nothing is
 * sent from Reachout.
 */
export function markDraftSentStep(
  repository: Repository,
  input: z.infer<typeof DraftReferenceInput>,
  now: Date,
  newId: () => string = () => crypto.randomUUID(),
): Promise<Outcome> {
  return attempt(async () => {
    const draft = found(await repository.drafts.get(input.id));
    const person = found(await repository.people.get(draft.personId));
    const interaction = MessageSentSchema.parse({
      id: newId(),
      userId: repository.userId,
      personId: draft.personId,
      opportunityId: draft.opportunityId,
      kind: "message_sent",
      channel: draft.channel,
      subject: draft.subject,
      body: draft.body,
      occurredAt: at(now),
      summary: draft.subject ?? firstLine(draft.body),
      createdAt: at(now),
      updatedAt: at(now),
    });
    const sent = await repository.drafts.markSent(
      {
        draft: markDraftSent(draft, interaction.id, at(now)),
        interaction,
        relationshipStatus: {
          before: person.relationshipStatus,
          after: relationshipStatusAfter(person.relationshipStatus, "message_sent"),
        },
      },
      input.expected,
    );
    return {
      changes: { drafts: [sent.draft], interactions: [sent.interaction], people: [sent.person] },
      undo: sent.undo,
    };
  });
}

export function undoStep(
  repository: Repository,
  input: z.infer<typeof UndoInput>,
): Promise<Outcome> {
  return attempt(async () => {
    const reverted = await repository.undo(input.step as UndoStep);
    return {
      changes: {
        people: reverted.people,
        drafts: reverted.drafts,
        nextActions: reverted.nextActions,
        removed: reverted.removed,
      },
    };
  });
}
