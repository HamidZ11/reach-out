import { z } from "zod";
import type { Repository } from "@/data/repository";
import { RepositoryError } from "@/data/repository";
import { DomainError } from "@/domain/errors";
import { instant, InstantSchema } from "@/domain/time";
import type { User } from "@/domain/user";
import { GoalsSchema, UserSchema } from "@/domain/user";
import type { Problem } from "@/features/workspace/outcome";

/**
 * Settings' two saves: the profile (name, education, time zone) and what the
 * user is aiming for. Each is validated by the domain's own schema on the
 * server, then saved only if the profile hasn't changed since it was read.
 * The email is the sign-in address and is never changed here.
 */

export const ProfileInput = z.object({
  name: z.string().max(200),
  timeZone: z.string().max(100),
  education: z
    .object({
      institution: z.string().max(200),
      course: z.string().max(200),
      graduationYear: z.number(),
    })
    .nullable(),
  expected: InstantSchema,
});

export const GoalsInput = z.object({ goals: GoalsSchema, expected: InstantSchema });

export type SettingsOutcome = { ok: true; user: User } | { ok: false; problem: Problem };

export type SettingsActions = {
  saveProfile(input: z.input<typeof ProfileInput>): Promise<SettingsOutcome>;
  saveGoals(input: z.input<typeof GoalsInput>): Promise<SettingsOutcome>;
};

export async function saveProfileStep(
  repository: Repository,
  input: z.infer<typeof ProfileInput>,
  now: Date,
): Promise<SettingsOutcome> {
  return save(repository, input.expected, now, (user) => ({
    ...user,
    name: input.name,
    timeZone: input.timeZone,
    education: input.education ?? undefined,
  }));
}

export async function saveGoalsStep(
  repository: Repository,
  input: z.infer<typeof GoalsInput>,
  now: Date,
): Promise<SettingsOutcome> {
  return save(repository, input.expected, now, (user) => ({ ...user, goals: input.goals }));
}

async function save(
  repository: Repository,
  expected: z.infer<typeof InstantSchema>,
  now: Date,
  change: (user: User) => User,
): Promise<SettingsOutcome> {
  try {
    const user = await repository.user.get();
    const next = UserSchema.safeParse({ ...change(user), updatedAt: instant(now.toISOString()) });
    if (!next.success) return { ok: false, problem: "invalid" };
    return { ok: true, user: await repository.user.save(next.data, expected) };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, problem: error.code };
    if (error instanceof RepositoryError) {
      if (error.code === "unauthenticated") throw error;
      return { ok: false, problem: error.code };
    }
    console.error("Saving settings failed", error);
    return { ok: false, problem: "unavailable" };
  }
}
