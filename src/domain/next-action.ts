import { z } from "zod";
import { DomainError } from "./errors";
import {
  InteractionIdSchema,
  NextActionIdSchema,
  OpportunityIdSchema,
  PersonIdSchema,
  UserIdSchema,
} from "./ids";
import type { CalendarDate, Instant } from "./time";
import { addDays, CalendarDateSchema, InstantSchema, laterDate } from "./time";

/**
 * The next concrete step on a person or opportunity. Not a general to-do list:
 * every action is attached to a person or an opportunity (or both).
 */
export const NEXT_ACTION_KINDS = [
  "follow_up",
  "reach_out",
  "apply",
  "prepare",
  "research",
  "other",
] as const;
export const NextActionKindSchema = z.enum(NEXT_ACTION_KINDS);
export type NextActionKind = z.infer<typeof NextActionKindSchema>;

const NextActionBase = z.object({
  id: NextActionIdSchema,
  userId: UserIdSchema,
  kind: NextActionKindSchema,
  title: z.string().trim().min(1),
  personId: PersonIdSchema.optional(),
  opportunityId: OpportunityIdSchema.optional(),
  /** The interaction that prompted this action, e.g. the message a follow-up chases. */
  interactionId: InteractionIdSchema.optional(),
  dueOn: CalendarDateSchema,
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});

export const OpenNextActionSchema = NextActionBase.extend({ status: z.literal("open") });
export type OpenNextAction = z.infer<typeof OpenNextActionSchema>;

export const DoneNextActionSchema = NextActionBase.extend({
  status: z.literal("done"),
  completedAt: InstantSchema,
});
export type DoneNextAction = z.infer<typeof DoneNextActionSchema>;

export const DismissedNextActionSchema = NextActionBase.extend({
  status: z.literal("dismissed"),
  dismissedAt: InstantSchema,
});
export type DismissedNextAction = z.infer<typeof DismissedNextActionSchema>;

export const NextActionSchema = z
  .discriminatedUnion("status", [
    OpenNextActionSchema,
    DoneNextActionSchema,
    DismissedNextActionSchema,
  ])
  .refine((a) => a.personId !== undefined || a.opportunityId !== undefined, {
    message: "A next action must be attached to a person or an opportunity",
    path: ["personId"],
  })
  .refine((a) => a.kind !== "follow_up" || a.personId !== undefined, {
    message: "A follow-up must name the person being followed up",
    path: ["personId"],
  });
export type NextAction = z.infer<typeof NextActionSchema>;
export type NextActionStatus = NextAction["status"];

function requireOpen(action: NextAction): OpenNextAction {
  if (action.status !== "open") {
    throw new DomainError("next_action_not_open", `Next action ${action.id} is ${action.status}`);
  }
  return action;
}

export function completeNextAction(action: NextAction, at: Instant): DoneNextAction {
  const open = requireOpen(action);
  return DoneNextActionSchema.parse({ ...open, status: "done", completedAt: at, updatedAt: at });
}

export function dismissNextAction(action: NextAction, at: Instant): DismissedNextAction {
  const open = requireOpen(action);
  return DismissedNextActionSchema.parse({
    ...open,
    status: "dismissed",
    dismissedAt: at,
    updatedAt: at,
  });
}

/** Moves an open action to a new due date, which cannot be in the past. */
export function rescheduleNextAction(
  action: NextAction,
  dueOn: CalendarDate,
  today: CalendarDate,
  at: Instant,
): OpenNextAction {
  const open = requireOpen(action);
  if (dueOn < today) {
    throw new DomainError("due_date_in_past", `Cannot reschedule ${action.id} to ${dueOn}`);
  }
  return OpenNextActionSchema.parse({ ...open, dueOn, updatedAt: at });
}

/**
 * Pushes an action back by whole days, counted from today if it is already due
 * or overdue, otherwise from its current due date.
 */
export function snoozeNextAction(
  action: NextAction,
  days: number,
  today: CalendarDate,
  at: Instant,
): OpenNextAction {
  if (!Number.isInteger(days) || days < 1) {
    throw new DomainError("invalid_snooze", `Snooze must be a whole number of days, got ${days}`);
  }
  const from = laterDate(requireOpen(action).dueOn, today);
  return rescheduleNextAction(action, addDays(from, days), today, at);
}
