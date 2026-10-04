import { z } from "zod";
import { UserIdSchema } from "./ids";
import { InstantSchema, isValidTimeZone } from "./time";

/** What the user is trying to get. Asked first in onboarding. */
export const OBJECTIVES = [
  "internship",
  "graduate_role",
  "startup_role",
  "research",
  "mentorship",
  "other",
] as const;
export const ObjectiveSchema = z.enum(OBJECTIVES);
export type Objective = z.infer<typeof ObjectiveSchema>;

const Labels = z.array(z.string().trim().min(1)).min(1);

/** The user's search, established in onboarding and editable in Settings. */
export const GoalsSchema = z.object({
  objective: ObjectiveSchema,
  targetRoles: Labels,
  targetSectors: Labels,
  targetLocations: Labels,
});
export type Goals = z.infer<typeof GoalsSchema>;

export const EducationSchema = z.object({
  institution: z.string().trim().min(1),
  course: z.string().trim().min(1),
  graduationYear: z.int().min(1950).max(2100),
});
export type Education = z.infer<typeof EducationSchema>;

/**
 * The account owner. Every other record belongs to exactly one User.
 * Identity (sign-in) is the auth provider's concern; this is the product profile.
 */
export const UserSchema = z
  .object({
    id: UserIdSchema,
    name: z.string().trim().min(1),
    email: z.email(),
    timeZone: z.string().refine(isValidTimeZone, "Unknown IANA time zone"),
    education: EducationSchema.optional(),
    goals: GoalsSchema.optional(),
    onboardingCompletedAt: InstantSchema.optional(),
    createdAt: InstantSchema,
    updatedAt: InstantSchema,
  })
  .refine((user) => user.onboardingCompletedAt === undefined || user.goals !== undefined, {
    message: "A user who has completed onboarding must have goals",
    path: ["goals"],
  });
export type User = z.infer<typeof UserSchema>;
