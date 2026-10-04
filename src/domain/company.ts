import { z } from "zod";
import { CompanyIdSchema, UserIdSchema } from "./ids";
import { InstantSchema } from "./time";

/**
 * Any organisation the user is pursuing or knows people at: employer, startup,
 * university, lab. Deliberately thin — created implicitly when a person or
 * opportunity names it. The Companies area aggregates people and opportunities
 * rather than asking the user to maintain company records.
 */
export const CompanySchema = z.object({
  id: CompanyIdSchema,
  userId: UserIdSchema,
  name: z.string().trim().min(1),
  website: z.url().optional(),
  sector: z.string().trim().min(1).optional(),
  location: z.string().trim().min(1).optional(),
  /** User-authored. */
  notes: z.string().optional(),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});
export type Company = z.infer<typeof CompanySchema>;

/** Company names are unique per user, ignoring case and surrounding/internal whitespace. */
export function companyNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB");
}
