import { z } from "zod";

/**
 * Branded identifiers. Ids are opaque strings; the brand stops a PersonId
 * being passed where an OpportunityId is expected.
 */

export const UserIdSchema = z.string().min(1).brand<"UserId">();
export type UserId = z.infer<typeof UserIdSchema>;

export const CompanyIdSchema = z.string().min(1).brand<"CompanyId">();
export type CompanyId = z.infer<typeof CompanyIdSchema>;

export const PersonIdSchema = z.string().min(1).brand<"PersonId">();
export type PersonId = z.infer<typeof PersonIdSchema>;

export const OpportunityIdSchema = z.string().min(1).brand<"OpportunityId">();
export type OpportunityId = z.infer<typeof OpportunityIdSchema>;

export const InteractionIdSchema = z.string().min(1).brand<"InteractionId">();
export type InteractionId = z.infer<typeof InteractionIdSchema>;

export const DraftIdSchema = z.string().min(1).brand<"DraftId">();
export type DraftId = z.infer<typeof DraftIdSchema>;

export const NextActionIdSchema = z.string().min(1).brand<"NextActionId">();
export type NextActionId = z.infer<typeof NextActionIdSchema>;

export const SourceFactIdSchema = z.string().min(1).brand<"SourceFactId">();
export type SourceFactId = z.infer<typeof SourceFactIdSchema>;

export const InterpretationIdSchema = z.string().min(1).brand<"InterpretationId">();
export type InterpretationId = z.infer<typeof InterpretationIdSchema>;
