import { z } from "zod";
import { MessageChannelSchema } from "./channels";
import { CompanyIdSchema, PersonIdSchema, UserIdSchema } from "./ids";
import type { InteractionKind } from "./interaction";
import { InstantSchema } from "./time";

/** Where the user found this person. Required: every contact has a provenance. */
export const PERSON_SOURCE_KINDS = [
  "alumni_network",
  "event",
  "linkedin",
  "company_website",
  "university",
  "publication",
  "introduction",
  "other",
] as const;

export const PersonSourceSchema = z.object({
  kind: z.enum(PERSON_SOURCE_KINDS),
  /** e.g. "University of Manchester Careers Fair" or "Introduced by Daniel Mensah". */
  detail: z.string().trim().min(1).optional(),
});
export type PersonSource = z.infer<typeof PersonSourceSchema>;

/**
 * Qualitative relationship state. Never a score.
 * - new: not contacted yet
 * - contacted: the user has reached out; no response yet
 * - replied: the person has responded (message or meeting)
 * - warm: an established, friendly relationship — set by the user only
 * - dormant: gone quiet — set by the user only
 */
export const RELATIONSHIP_STATUSES = ["new", "contacted", "replied", "warm", "dormant"] as const;
export const RelationshipStatusSchema = z.enum(RELATIONSHIP_STATUSES);
export type RelationshipStatus = z.infer<typeof RelationshipStatusSchema>;

/** Why the user stopped pursuing outreach to this person. */
export const OutreachClosureSchema = z.object({
  closedAt: InstantSchema,
  reason: z.enum(["no_response", "not_a_fit", "completed"]),
});
export type OutreachClosure = z.infer<typeof OutreachClosureSchema>;

const LinkedInUrlSchema = z.url().refine((value) => {
  const host = new URL(value).hostname;
  return host === "linkedin.com" || host.endsWith(".linkedin.com");
}, "Must be a linkedin.com URL");

export const PersonSchema = z
  .object({
    id: PersonIdSchema,
    userId: UserIdSchema,
    name: z.string().trim().min(1),
    /** Role or headline, e.g. "Graduate Software Engineer" or "PhD student". */
    role: z.string().trim().min(1).optional(),
    companyId: CompanyIdSchema.optional(),
    source: PersonSourceSchema,
    email: z.email().optional(),
    linkedinUrl: LinkedInUrlSchema.optional(),
    location: z.string().trim().min(1).optional(),
    /** User-authored: why this person matters to the user's goals. */
    whyRelevant: z.string().trim().min(1).optional(),
    /** User-authored, durable knowledge about the person. Dated events go in Interactions. */
    notes: z.string().optional(),
    relationshipStatus: RelationshipStatusSchema,
    /** Manual preference; the product never sends through a channel automatically. */
    preferredChannel: MessageChannelSchema.optional(),
    outreachClosure: OutreachClosureSchema.optional(),
    createdAt: InstantSchema,
    updatedAt: InstantSchema,
  })
  .refine((person) => person.role !== undefined || person.companyId !== undefined, {
    message: "A person needs a role or a company for context",
    path: ["role"],
  });
export type Person = z.infer<typeof PersonSchema>;

/**
 * The automatic, forward-only effect of a recorded interaction on relationship
 * status. Warm and dormant are user judgements: never set automatically, and an
 * interaction never downgrades a status.
 */
export function relationshipStatusAfter(
  current: RelationshipStatus,
  interaction: InteractionKind,
): RelationshipStatus {
  switch (interaction) {
    case "message_sent":
      return current === "new" || current === "dormant" ? "contacted" : current;
    case "message_received":
    case "meeting":
      return current === "new" || current === "contacted" || current === "dormant"
        ? "replied"
        : current;
    case "note":
      return current;
  }
}
