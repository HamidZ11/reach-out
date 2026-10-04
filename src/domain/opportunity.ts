import { z } from "zod";
import { CompanyIdSchema, OpportunityIdSchema, PersonIdSchema, UserIdSchema } from "./ids";
import { CalendarDateSchema, InstantSchema } from "./time";

/**
 * Ordered stages. Order is for display and sorting; transitions are not forced
 * through every stage because real paths skip (a referral can go straight to
 * interviewing, a mentorship never has an application).
 */
export const OPPORTUNITY_STATUSES = [
  "identified",
  "researching",
  "reaching_out",
  "applied",
  "interviewing",
  "offer",
  "closed",
] as const;
export const OpportunityStatusSchema = z.enum(OPPORTUNITY_STATUSES);
export type OpportunityStatus = z.infer<typeof OpportunityStatusSchema>;

/**
 * "referral" is a path into an organisation through a person when there is no
 * specific posted role yet. When there is a role, link the referrer to it instead.
 */
export const OPPORTUNITY_TYPES = [
  "internship",
  "graduate_role",
  "startup_role",
  "research",
  "mentorship",
  "referral",
  "other",
] as const;
export const OpportunityTypeSchema = z.enum(OPPORTUNITY_TYPES);
export type OpportunityType = z.infer<typeof OpportunityTypeSchema>;

export const OPPORTUNITY_PRIORITIES = ["high", "medium", "low"] as const;
export const OpportunityPrioritySchema = z.enum(OPPORTUNITY_PRIORITIES);
export type OpportunityPriority = z.infer<typeof OpportunityPrioritySchema>;

export const CLOSED_REASONS = [
  "accepted",
  "declined",
  "rejected",
  "withdrawn",
  "no_response",
  "expired",
] as const;
export const ClosedReasonSchema = z.enum(CLOSED_REASONS);
export type ClosedReason = z.infer<typeof ClosedReasonSchema>;

export const OpportunitySchema = z
  .object({
    id: OpportunityIdSchema,
    userId: UserIdSchema,
    title: z.string().trim().min(1),
    companyId: CompanyIdSchema,
    status: OpportunityStatusSchema,
    closedReason: ClosedReasonSchema.optional(),
    type: OpportunityTypeSchema.optional(),
    /** Absent means medium. */
    priority: OpportunityPrioritySchema.optional(),
    deadline: CalendarDateSchema.optional(),
    url: z.url().optional(),
    /** User-authored. */
    notes: z.string().optional(),
    /** People who can help with, or are part of, this opportunity. */
    personIds: z.array(PersonIdSchema),
    createdAt: InstantSchema,
    updatedAt: InstantSchema,
  })
  .refine((o) => (o.status === "closed") === (o.closedReason !== undefined), {
    message: "closedReason is required when, and only when, the opportunity is closed",
    path: ["closedReason"],
  })
  .refine((o) => new Set(o.personIds).size === o.personIds.length, {
    message: "A person can only be linked to an opportunity once",
    path: ["personIds"],
  });
export type Opportunity = z.infer<typeof OpportunitySchema>;

const PRE_APPLICATION: ReadonlySet<OpportunityStatus> = new Set([
  "identified",
  "researching",
  "reaching_out",
]);

/** Before anything has been submitted — the only stages where a deadline still demands action. */
export function isPreApplication(opportunity: Opportunity): boolean {
  return PRE_APPLICATION.has(opportunity.status);
}

const PRIORITY_RANK: Record<OpportunityPriority, number> = { high: 0, medium: 1, low: 2 };

export function priorityRank(opportunity: Opportunity): number {
  return PRIORITY_RANK[opportunity.priority ?? "medium"];
}
