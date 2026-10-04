import { z } from "zod";
import { MessageChannelSchema } from "./channels";
import { DomainError } from "./errors";
import {
  DraftIdSchema,
  InteractionIdSchema,
  OpportunityIdSchema,
  PersonIdSchema,
  UserIdSchema,
} from "./ids";
import type { InteractionId } from "./ids";
import type { Instant } from "./time";
import { InstantSchema } from "./time";

/**
 * An outgoing message the user has not sent yet. Nothing leaves the product
 * without explicit approval, and approval covers the exact content: editing an
 * approved draft sends it back for approval.
 *
 * Lifecycle: awaiting_approval → approved → sent, or → discarded.
 */
const DraftBase = z.object({
  id: DraftIdSchema,
  userId: UserIdSchema,
  personId: PersonIdSchema,
  opportunityId: OpportunityIdSchema.optional(),
  channel: MessageChannelSchema,
  subject: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1),
  /** "generated" marks machine-written content. It goes through the same approval gate. */
  origin: z.enum(["user", "generated"]),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});

export const AwaitingApprovalDraftSchema = DraftBase.extend({
  status: z.literal("awaiting_approval"),
});
export type AwaitingApprovalDraft = z.infer<typeof AwaitingApprovalDraftSchema>;

export const ApprovedDraftSchema = DraftBase.extend({
  status: z.literal("approved"),
  approvedAt: InstantSchema,
});
export type ApprovedDraft = z.infer<typeof ApprovedDraftSchema>;

export const SentDraftSchema = DraftBase.extend({
  status: z.literal("sent"),
  approvedAt: InstantSchema,
  sentAt: InstantSchema,
  /** The message_sent interaction this draft became. */
  sentInteractionId: InteractionIdSchema,
});
export type SentDraft = z.infer<typeof SentDraftSchema>;

export const DiscardedDraftSchema = DraftBase.extend({
  status: z.literal("discarded"),
  discardedAt: InstantSchema,
});
export type DiscardedDraft = z.infer<typeof DiscardedDraftSchema>;

export const DraftSchema = z
  .discriminatedUnion("status", [
    AwaitingApprovalDraftSchema,
    ApprovedDraftSchema,
    SentDraftSchema,
    DiscardedDraftSchema,
  ])
  .refine(
    (draft) =>
      draft.channel !== "email" ||
      (draft.status !== "approved" && draft.status !== "sent") ||
      draft.subject !== undefined,
    { message: "An approved or sent email needs a subject", path: ["subject"] },
  );
export type Draft = z.infer<typeof DraftSchema>;
export type DraftStatus = Draft["status"];

/** Not yet sent and not abandoned. */
export function isPendingDraft(draft: Draft): draft is AwaitingApprovalDraft | ApprovedDraft {
  return draft.status === "awaiting_approval" || draft.status === "approved";
}

export function approveDraft(draft: Draft, at: Instant): ApprovedDraft {
  if (draft.status !== "awaiting_approval") {
    throw new DomainError(
      "draft_not_awaiting_approval",
      `Draft ${draft.id} is ${draft.status} and cannot be approved`,
    );
  }
  if (draft.channel === "email" && draft.subject === undefined) {
    throw new DomainError("email_subject_required", `Email draft ${draft.id} has no subject`);
  }
  return ApprovedDraftSchema.parse({ ...draft, status: "approved", approvedAt: at, updatedAt: at });
}

export function reviseDraft(
  draft: Draft,
  changes: { subject?: string; body?: string },
  at: Instant,
): AwaitingApprovalDraft {
  if (!isPendingDraft(draft)) {
    throw new DomainError("draft_not_editable", `Draft ${draft.id} is ${draft.status}`);
  }
  return AwaitingApprovalDraftSchema.parse({
    ...draft,
    subject: changes.subject ?? draft.subject,
    body: changes.body ?? draft.body,
    status: "awaiting_approval",
    updatedAt: at,
  });
}

/** Records that an approved draft went out. The caller records the matching message_sent interaction. */
export function markDraftSent(draft: Draft, interactionId: InteractionId, at: Instant): SentDraft {
  if (draft.status !== "approved") {
    throw new DomainError(
      "draft_not_approved",
      `Draft ${draft.id} is ${draft.status}; only approved drafts can be sent`,
    );
  }
  return SentDraftSchema.parse({
    ...draft,
    status: "sent",
    sentAt: at,
    sentInteractionId: interactionId,
    updatedAt: at,
  });
}

export function discardDraft(draft: Draft, at: Instant): DiscardedDraft {
  if (!isPendingDraft(draft)) {
    throw new DomainError("draft_not_editable", `Draft ${draft.id} is ${draft.status}`);
  }
  return DiscardedDraftSchema.parse({
    ...draft,
    status: "discarded",
    discardedAt: at,
    updatedAt: at,
  });
}
