import { z } from "zod";
import {
  CompanyIdSchema,
  InterpretationIdSchema,
  OpportunityIdSchema,
  PersonIdSchema,
  SourceFactIdSchema,
  UserIdSchema,
} from "./ids";
import { CalendarDateSchema, InstantSchema } from "./time";

/**
 * Research context has three layers that are never merged into one field:
 *
 * 1. SourceFact — something checkable, with where it came from.
 *    "Graduated from the University of Manchester in 2024." (public profile)
 * 2. User notes — the user's own words, stored as `notes` / `whyRelevant` on the
 *    record itself. "Met at the careers fair."
 * 3. Interpretation — generated reasoning over facts. Always labelled as generated,
 *    always cites the facts it used, and never treated as a fact by product logic.
 *    "Shared university background is a natural opening."
 */

export const SubjectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("person"), id: PersonIdSchema }),
  z.object({ type: z.literal("company"), id: CompanyIdSchema }),
  z.object({ type: z.literal("opportunity"), id: OpportunityIdSchema }),
]);
export type Subject = z.infer<typeof SubjectSchema>;

export const PROVENANCE_KINDS = [
  "public_profile",
  "company_website",
  "university_website",
  "publication",
  "event",
  "correspondence",
  "other",
] as const;

export const ProvenanceSchema = z.object({
  kind: z.enum(PROVENANCE_KINDS),
  url: z.url().optional(),
  detail: z.string().trim().min(1).optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const SourceFactSchema = z.object({
  id: SourceFactIdSchema,
  userId: UserIdSchema,
  subject: SubjectSchema,
  statement: z.string().trim().min(1),
  provenance: ProvenanceSchema,
  /** When the fact was observed at its source, if known. */
  observedOn: CalendarDateSchema.optional(),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});
export type SourceFact = z.infer<typeof SourceFactSchema>;

export const INTERPRETATION_KINDS = [
  "relevance",
  "outreach_angle",
  "summary",
  "follow_up_suggestion",
] as const;

export const InterpretationSchema = z.object({
  id: InterpretationIdSchema,
  userId: UserIdSchema,
  subject: SubjectSchema,
  kind: z.enum(INTERPRETATION_KINDS),
  text: z.string().trim().min(1),
  /** The facts this reasoning rests on. Interpretations without a basis are not allowed. */
  basedOnFactIds: z.array(SourceFactIdSchema).min(1),
  generatedBy: z.object({
    kind: z.enum(["model", "rule"]),
    name: z.string().trim().min(1),
  }),
  generatedAt: InstantSchema,
  /** The user's verdict. Accepting does not turn an interpretation into a fact. */
  review: z.enum(["suggested", "accepted", "dismissed"]),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});
export type Interpretation = z.infer<typeof InterpretationSchema>;

export function sameSubject(a: Subject, b: Subject): boolean {
  return a.type === b.type && a.id === b.id;
}
